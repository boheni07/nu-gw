// Design Ref: §3.3 연차 관리, §4.1 산정 로직, §4.7 대기중 수정·취소 무결성 — module-3
import {
  adjustLeaveBalanceUsed,
  createAttachment,
  createLeaveBalance,
  createLeaveRequest,
  findLeaveBalance,
  getCompanySettings,
  getDepartment,
  getLeaveRequest,
  getLeaveTypeConfig,
  getUserById,
  listAttachmentsByLeaveRequest,
  listLeavePolicies,
  listLeaveRequestsByUser,
  listUsers,
  updateLeaveRequest,
  updateLeaveRequestIfVersionMatches,
} from "@/lib/data/store";
import { recallApproval, submitForApproval } from "@/lib/approval/engine";
import {
  businessDaysBetween,
  calcFiscalYearGrant,
  calcHireDateGrant,
  calcHourlyLeave,
  HourlyLeaveValidationError,
  resolveLeaveBasis,
} from "@/lib/leave/calc";
import type { Attachment, ApprovalStatus, LeaveBalance, LeaveRequest } from "@/types";

export class LeaveServiceError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "VALIDATION" | "INSUFFICIENT_BALANCE" | "ATTACHMENT_REQUIRED" | "FORBIDDEN" | "CONFLICT" = "VALIDATION"
  ) {
    super(message);
    this.name = "LeaveServiceError";
  }
}

function currentPeriodYear(referenceDate: string): number {
  return new Date(referenceDate + "T00:00:00").getFullYear();
}

/**
 * 개인별 연차 잔여 현황을 조회하고, 없으면 정책에 따라 계산해 최초 1회 생성한다(배치 대신 지연 계산 — module-3 간소화).
 */
export async function getOrCreateLeaveBalance(userId: string, periodYear: number): Promise<LeaveBalance> {
  const existing = await findLeaveBalance(userId, periodYear);
  if (existing) return existing;

  const user = await getUserById(userId);
  if (!user) throw new LeaveServiceError("사용자를 찾을 수 없습니다.", "NOT_FOUND");
  const company = await getCompanySettings();
  const basis = resolveLeaveBasis(company);
  const policies = await listLeavePolicies();

  const granted =
    basis === "FISCAL_YEAR"
      ? calcFiscalYearGrant(user.hireDate, periodYear, policies)
      : calcHireDateGrant(user.hireDate, `${periodYear}-12-31`, policies);

  return createLeaveBalance({ userId, periodYear, granted, used: 0 });
}

export interface SubmitLeaveInput {
  userId: string;
  leaveTypeId: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  /** multipart로 함께 업로드된 파일(선택) */
  attachment?: { fileName: string; storedPath: string } | null;
}

/**
 * §4.1/§4.2-1 — 연차 신청: 계산 → 카테고리별 검증(잔여연차/증빙) → 잔여연차 선반영 → 결재 상신.
 * module-3에서는 별도 DRAFT 단계 없이 단일 요청으로 생성+상신까지 처리한다(bkend.ai 미사용에 따른 간소화).
 */
export async function submitLeaveRequest(input: SubmitLeaveInput): Promise<LeaveRequest> {
  const user = await getUserById(input.userId);
  if (!user) throw new LeaveServiceError("사용자를 찾을 수 없습니다.", "NOT_FOUND");
  const leaveType = await getLeaveTypeConfig(input.leaveTypeId);
  if (!leaveType) throw new LeaveServiceError("연차 유형을 찾을 수 없습니다.", "NOT_FOUND");
  const company = await getCompanySettings();

  let days: number;
  let startDate: string;
  let endDate: string;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (leaveType.inputMode === "DAY_RANGE") {
    if (!input.startDate || !input.endDate) {
      throw new LeaveServiceError("시작일과 종료일을 입력해주세요.");
    }
    days = businessDaysBetween(input.startDate, input.endDate);
    if (days <= 0) throw new LeaveServiceError("근무일이 포함된 유효한 기간을 선택해주세요.");
    startDate = input.startDate;
    endDate = input.endDate;
  } else {
    if (!input.startDate || !input.startTime || !input.endTime) {
      throw new LeaveServiceError("날짜와 시작·종료시간을 입력해주세요.");
    }
    try {
      const result = calcHourlyLeave({
        startTime: input.startTime,
        endTime: input.endTime,
        lunchStart: company.lunchStart,
        lunchEnd: company.lunchEnd,
        unitHours: company.hourlyLeaveUnitHours,
        maxHours: company.hourlyLeaveMaxHours,
        standardWorkHoursPerDay: company.standardWorkHoursPerDay,
      });
      days = result.days;
    } catch (err) {
      if (err instanceof HourlyLeaveValidationError) throw new LeaveServiceError(err.message);
      throw err;
    }
    startDate = input.startDate;
    endDate = input.startDate;
    startTime = input.startTime;
    endTime = input.endTime;
  }

  if (leaveType.requireAttachment && !input.attachment) {
    throw new LeaveServiceError(`${leaveType.name}은(는) 증빙파일 첨부가 필요합니다.`, "ATTACHMENT_REQUIRED");
  }

  const periodYear = currentPeriodYear(startDate);
  if (leaveType.category === "ANNUAL_DEDUCT") {
    const balance = await getOrCreateLeaveBalance(input.userId, periodYear);
    const remaining = balance.granted - balance.used;
    if (days > remaining) {
      throw new LeaveServiceError(
        `잔여연차(${remaining}일)가 부족합니다. 신청 일수: ${days}일`,
        "INSUFFICIENT_BALANCE"
      );
    }
    await adjustLeaveBalanceUsed(input.userId, periodYear, days); // 선반영(예약)
  }

  const record = await createLeaveRequest({
    userId: input.userId,
    leaveTypeId: input.leaveTypeId,
    startDate,
    endDate,
    startTime,
    endTime,
    days,
    reason: input.reason,
    status: "PENDING",
    approvalId: null,
  });

  if (input.attachment) {
    await createAttachment({
      leaveRequestId: record.id,
      fileName: input.attachment.fileName,
      fileUrl: `/api/files/${input.attachment.storedPath}`,
    });
  }

  try {
    const approval = await submitForApproval({
      targetType: "LEAVE",
      targetId: record.id,
      submitterId: input.userId,
      departmentId: user.departmentId,
      targetVersion: record.version,
    });
    return (await updateLeaveRequest(record.id, { approvalId: approval.id }))!;
  } catch (err) {
    // 결재선이 없어 상신에 실패하면 선반영한 잔여연차를 되돌리고 신청 자체를 실패 처리한다.
    if (leaveType.category === "ANNUAL_DEDUCT") {
      await adjustLeaveBalanceUsed(input.userId, periodYear, -days);
    }
    await updateLeaveRequest(record.id, { status: "REJECTED" });
    throw err;
  }
}

/** §4.7 — 대기중(1단계 미처리) 회수. 회수 성공 시 선반영된 잔여연차를 환원한다. */
export async function recallLeaveRequest(leaveRequestId: string, requesterId: string): Promise<LeaveRequest> {
  const record = await getLeaveRequest(leaveRequestId);
  if (!record) throw new LeaveServiceError("신청 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new LeaveServiceError("본인이 신청한 건만 회수할 수 있습니다.", "FORBIDDEN");
  if (!record.approvalId) throw new LeaveServiceError("상신 정보가 없어 회수할 수 없습니다.", "CONFLICT");

  await recallApproval(record.approvalId, requesterId); // 조건 불충족 시 ApprovalEngineError throw

  await refundIfDeducted(record);
  return (await updateLeaveRequest(leaveRequestId, { status: "CANCELLED" }))!;
}

export interface EditLeaveInput {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

/** §4.7 — 대기중(1단계 미처리) 수정. 기존 선반영분을 환원한 뒤 새 일수를 재검증하고 재반영한다. */
export async function editLeaveRequest(
  leaveRequestId: string,
  requesterId: string,
  clientVersion: number,
  input: EditLeaveInput
): Promise<LeaveRequest> {
  const record = await getLeaveRequest(leaveRequestId);
  if (!record) throw new LeaveServiceError("신청 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new LeaveServiceError("본인이 신청한 건만 수정할 수 있습니다.", "FORBIDDEN");

  const leaveType = await getLeaveTypeConfig(record.leaveTypeId);
  if (!leaveType) throw new LeaveServiceError("연차 유형을 찾을 수 없습니다.", "NOT_FOUND");
  const company = await getCompanySettings();

  let days: number;
  let startDate = record.startDate;
  let endDate = record.endDate;
  let startTime = record.startTime;
  let endTime = record.endTime;

  if (leaveType.inputMode === "DAY_RANGE") {
    startDate = input.startDate ?? record.startDate;
    endDate = input.endDate ?? record.endDate;
    days = businessDaysBetween(startDate, endDate);
    if (days <= 0) throw new LeaveServiceError("근무일이 포함된 유효한 기간을 선택해주세요.");
  } else {
    startDate = input.startDate ?? record.startDate;
    startTime = input.startTime ?? record.startTime;
    endTime = input.endTime ?? record.endTime;
    if (!startTime || !endTime) throw new LeaveServiceError("시작·종료시간을 입력해주세요.");
    try {
      const result = calcHourlyLeave({
        startTime,
        endTime,
        lunchStart: company.lunchStart,
        lunchEnd: company.lunchEnd,
        unitHours: company.hourlyLeaveUnitHours,
        maxHours: company.hourlyLeaveMaxHours,
        standardWorkHoursPerDay: company.standardWorkHoursPerDay,
      });
      days = result.days;
    } catch (err) {
      if (err instanceof HourlyLeaveValidationError) throw new LeaveServiceError(err.message);
      throw err;
    }
    endDate = startDate;
  }

  const periodYear = currentPeriodYear(startDate);
  if (leaveType.category === "ANNUAL_DEDUCT") {
    // 기존 선반영분 환원 후 재검증
    await adjustLeaveBalanceUsed(record.userId, currentPeriodYear(record.startDate), -record.days);
    const balance = await getOrCreateLeaveBalance(record.userId, periodYear);
    const remaining = balance.granted - balance.used;
    if (days > remaining) {
      // 검증 실패 — 원복하고 에러
      await adjustLeaveBalanceUsed(record.userId, currentPeriodYear(record.startDate), record.days);
      throw new LeaveServiceError(`잔여연차(${remaining}일)가 부족해 수정할 수 없습니다.`, "INSUFFICIENT_BALANCE");
    }
    await adjustLeaveBalanceUsed(record.userId, periodYear, days);
  }

  const updated = await updateLeaveRequestIfVersionMatches(leaveRequestId, clientVersion, {
    startDate,
    endDate,
    startTime,
    endTime,
    days,
    reason: input.reason ?? record.reason,
  });

  if (!updated) {
    // 버전 불일치(이미 처리된 건) — 방금 반영한 조정분을 되돌린다.
    if (leaveType.category === "ANNUAL_DEDUCT") {
      await adjustLeaveBalanceUsed(record.userId, periodYear, -days);
      await adjustLeaveBalanceUsed(record.userId, currentPeriodYear(record.startDate), record.days);
    }
    throw new LeaveServiceError("이미 처리가 진행되어 수정할 수 없습니다. 최신 내용을 다시 불러와주세요.", "CONFLICT");
  }
  return updated;
}

async function refundIfDeducted(record: LeaveRequest): Promise<void> {
  const leaveType = await getLeaveTypeConfig(record.leaveTypeId);
  if (leaveType?.category === "ANNUAL_DEDUCT") {
    await adjustLeaveBalanceUsed(record.userId, currentPeriodYear(record.startDate), -record.days);
  }
}

/**
 * module-2 결재 엔진이 최종 상태(APPROVED/REJECTED/RECALLED)에 도달했을 때 호출된다(§4.2-3/4 "대상 문서 status 동기화").
 * lib/approval/sync.ts의 디스패처가 targetType="LEAVE"일 때 이 함수를 호출한다.
 */
export async function syncLeaveRequestFromApproval(leaveRequestId: string, approvalStatus: ApprovalStatus): Promise<void> {
  const record = await getLeaveRequest(leaveRequestId);
  if (!record) return;

  if (approvalStatus === "APPROVED") {
    await updateLeaveRequest(leaveRequestId, { status: "APPROVED" });
    return;
  }
  if (approvalStatus === "REJECTED") {
    await refundIfDeducted(record); // 반려 시 선반영분 환원
    await updateLeaveRequest(leaveRequestId, { status: "REJECTED" });
    return;
  }
  if (approvalStatus === "RECALLED") {
    // recallLeaveRequest에서 이미 환원 처리하므로 여기서는 상태만 맞춰준다(직접 /api/approvals/:id/recall 호출 경로 대비).
    if (record.status !== "CANCELLED") await refundIfDeducted(record);
    await updateLeaveRequest(leaveRequestId, { status: "CANCELLED" });
  }
}

export async function listAttachments(leaveRequestId: string): Promise<Attachment[]> {
  return listAttachmentsByLeaveRequest(leaveRequestId);
}

export interface LeaveStatusRow {
  userId: string;
  userName: string;
  deptName: string;
  position: string;
  granted: number;
  used: number;
  remaining: number;
  pendingCount: number;
}

/**
 * module-13 §관리자 연차 현황 — 재직 중인 전 직원의 연차 부여/사용/잔여 현황을 한 번에 조회한다(관리자 전용).
 * periodYear가 없으면 오늘 기준 연도를 사용한다.
 */
export async function getLeaveStatusRows(periodYear?: number): Promise<LeaveStatusRow[]> {
  const year = periodYear ?? new Date().getFullYear();
  const users = (await listUsers()).filter((u) => u.employmentStatus !== "RESIGNED");
  const rows: LeaveStatusRow[] = [];
  for (const u of users) {
    const balance = await getOrCreateLeaveBalance(u.id, year);
    const pendingCount = (await listLeaveRequestsByUser(u.id)).filter((r) => r.status === "PENDING").length;
    const dept = await getDepartment(u.departmentId);
    rows.push({
      userId: u.id,
      userName: u.name,
      deptName: dept?.name ?? "—",
      position: u.position,
      granted: balance.granted,
      used: balance.used,
      remaining: balance.granted - balance.used,
      pendingCount,
    });
  }
  return rows;
}

export interface LeaveReportRow {
  userName: string;
  typeName: string;
  category: string;
  period: string;
  days: number;
  status: string;
  submittedAt: string;
}

const LEAVE_STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", CANCELLED: "취소" };

/** module-10 §4.2 리포트 — 연차 사용 내역. scope="self"면 userId 본인만, "all"이면 전 사용자(부서 필터 가능). */
export async function buildLeaveReportRows(scope: "self" | "all", userId: string, departmentId?: string): Promise<LeaveReportRow[]> {
  const targetUsers =
    scope === "self"
      ? [userId]
      : (await listUsers()).filter((u) => !departmentId || u.departmentId === departmentId).map((u) => u.id);

  const rows: LeaveReportRow[] = [];
  for (const uid of targetUsers) {
    const user = await getUserById(uid);
    const requests = await listLeaveRequestsByUser(uid);
    for (const r of requests) {
      const leaveType = await getLeaveTypeConfig(r.leaveTypeId);
      rows.push({
        userName: user?.name ?? uid,
        typeName: leaveType?.name ?? "연차",
        category: leaveType?.category ?? "",
        period: r.startTime ? `${r.startDate} ${r.startTime}~${r.endTime}` : `${r.startDate}~${r.endDate}`,
        days: r.days,
        status: LEAVE_STATUS_LABEL[r.status] ?? r.status,
        submittedAt: r.createdAt.slice(0, 10),
      });
    }
  }
  return rows;
}
