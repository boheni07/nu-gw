// Design Ref: §4.6 출퇴근 체크 로직, §3.9 초과근무 신청 — module-5
import {
  createAttendanceRecord,
  createOvertimeRequest,
  getApprovedOvertimeForDate,
  getAttendanceRecord,
  getCompanySettings,
  getDepartment,
  getLeaveTypeConfig,
  getOvertimeRequest,
  getUserById,
  hasApprovedOvertimeToday,
  listAttendanceRecordsInRange,
  listApprovedLeaveRequestsOverlapping,
  listLeaveRequestsByUser,
  listOvertimeRequestsByUser,
  listUsers,
  updateAttendanceRecord,
  updateOvertimeRequest,
} from "@/lib/data/store";
import { recallApproval, submitForApproval } from "@/lib/approval/engine";
import { isIpAllowed } from "@/lib/net/ip";
import type { ApprovalStatus, AttendanceRecord, OvertimeRequest } from "@/types";

export class AttendanceServiceError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_CHECKED_IN"
      | "ALREADY_CHECKED_IN"
      | "ALREADY_CHECKED_OUT"
      | "TOO_EARLY"
      | "TOO_LATE"
      | "NEEDS_OVERTIME_APPROVAL"
      | "IP_NOT_ALLOWED"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "VALIDATION" = "VALIDATION"
  ) {
    super(message);
    this.name = "AttendanceServiceError";
  }
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function nowDateKey(now: Date) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
function nowTimeMinutes(now: Date) {
  return now.getHours() * 60 + now.getMinutes();
}
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

const CHECKOUT_OPEN_MINUTES = 18 * 60; // 18:00
const CHECKOUT_FREE_UNTIL_MINUTES = 19 * 60; // 19:00
const AUTO_CLOSE_MINUTES = 18 * 60 + 30; // 18:30

/** §4.6 사내망 제한 — 회사 기본정보에 등록된 허용 IP 대역 밖이면 출근/퇴근 체크를 차단한다. */
async function assertAllowedIp(clientIp: string | null): Promise<void> {
  const company = await getCompanySettings();
  if (!isIpAllowed(clientIp, company.allowedCheckInIpRanges)) {
    throw new AttendanceServiceError("사내 네트워크(IP)에서만 출근/퇴근 체크가 가능합니다.", "IP_NOT_ALLOWED");
  }
}

/**
 * §4.6 연차(시간) 얼리 체크아웃 — 당일 승인된 연차(시간) 신청이 있으면 그 시작시간부터 퇴근 체크를 허용한다
 * (예: 15:00~18:00 반차라면 15:00부터 퇴근 가능). HOUR_RANGE 유형만 startTime을 갖는다.
 */
async function getApprovedHourlyLeaveStartMinutes(userId: string, dateKey: string): Promise<number | null> {
  const requests = await listLeaveRequestsByUser(userId);
  const hourly = requests.find((r) => r.status === "APPROVED" && r.startDate === dateKey && r.startTime);
  return hourly?.startTime ? hhmmToMinutes(hourly.startTime) : null;
}

/** §4.6 출근 체크: 당일 기록이 없으면 생성, 있으면 차단(1일 1회). 사내 IP에서만 가능하다. */
export async function checkIn(userId: string, clientIp: string | null, now: Date = new Date()): Promise<AttendanceRecord> {
  await assertAllowedIp(clientIp);

  const dateKey = nowDateKey(now);
  const existing = await getAttendanceRecord(userId, dateKey);
  if (existing) throw new AttendanceServiceError("이미 출근 체크되었습니다.", "ALREADY_CHECKED_IN");

  return createAttendanceRecord({
    userId,
    date: dateKey,
    checkInAt: now.toISOString(),
    checkOutAt: null,
    status: "NORMAL",
    autoCheckedOut: false,
  });
}

/**
 * §4.6 퇴근 체크 — 사내 IP에서만 가능하며, 서버 시각 기준 판단.
 * - 기본 18:00 이전: 차단. 단, 당일 승인된 연차(시간)가 있으면 그 시작시간부터 허용(조기 퇴근).
 * - 18:00~19:00: 출근 기록이 있으면 누구나 체크 가능.
 * - 19:00 이후: 당일 승인된 OvertimeRequest가 있어야 하며, 그 예상 퇴근시간을 넘기면 차단(초과근무 시간 내에서만 허용).
 */
export async function checkOut(userId: string, clientIp: string | null, now: Date = new Date()): Promise<AttendanceRecord> {
  await assertAllowedIp(clientIp);

  const dateKey = nowDateKey(now);
  const record = await getAttendanceRecord(userId, dateKey);
  if (!record || !record.checkInAt) throw new AttendanceServiceError("출근 기록이 없어 퇴근 체크할 수 없습니다.", "NOT_CHECKED_IN");
  if (record.checkOutAt) throw new AttendanceServiceError("이미 퇴근 체크되었습니다.", "ALREADY_CHECKED_OUT");

  const minutes = nowTimeMinutes(now);
  const hourlyLeaveStart = await getApprovedHourlyLeaveStartMinutes(userId, dateKey);
  const earliestMinutes = hourlyLeaveStart !== null ? Math.min(CHECKOUT_OPEN_MINUTES, hourlyLeaveStart) : CHECKOUT_OPEN_MINUTES;

  if (minutes < earliestMinutes) {
    throw new AttendanceServiceError(`${minutesToHHMM(earliestMinutes)} 이후 가능합니다.`, "TOO_EARLY");
  }
  if (minutes >= CHECKOUT_FREE_UNTIL_MINUTES) {
    const overtime = await getApprovedOvertimeForDate(userId, dateKey);
    if (!overtime) {
      throw new AttendanceServiceError("19:00 이후는 승인된 초과근무 신청이 있어야 퇴근 체크할 수 있습니다.", "NEEDS_OVERTIME_APPROVAL");
    }
    const overtimeEndMinutes = hhmmToMinutes(overtime.expectedEndTime);
    if (minutes > overtimeEndMinutes) {
      throw new AttendanceServiceError(
        `승인된 초과근무 시간(${overtime.expectedEndTime}까지)을 지나 퇴근 체크할 수 없습니다. 관리자에게 문의해주세요.`,
        "TOO_LATE"
      );
    }
  }

  return (await updateAttendanceRecord(record.id, { checkOutAt: now.toISOString(), autoCheckedOut: false }))!;
}

/**
 * §4.6 자동 퇴근 처리 — 실제 배치(스케줄러) 대신, 조회 시점에 지연 적용한다(module-5 간소화).
 * 대상: 오늘이 아닌 과거 날짜이거나(오늘이면 18:30 경과) + 출근 기록 있음 + 퇴근 미기록 + 당일 승인된 초과근무 없음.
 */
async function applyAutoCheckoutIfDue(record: AttendanceRecord, today: Date): Promise<AttendanceRecord> {
  if (record.checkOutAt || !record.checkInAt) return record;
  const todayKey = nowDateKey(today);
  const isPastDay = record.date < todayKey;
  const isTodayPastAutoClose = record.date === todayKey && nowTimeMinutes(today) >= AUTO_CLOSE_MINUTES;
  if (!isPastDay && !isTodayPastAutoClose) return record;
  if (await hasApprovedOvertimeToday(record.userId, record.date)) return record; // 초과근무 승인 있으면 자동 마감하지 않음

  return (await updateAttendanceRecord(record.id, { checkOutAt: `${record.date}T18:00:00`, autoCheckedOut: true })) ?? record;
}

export interface MonthlyAttendanceDay {
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  autoCheckedOut: boolean;
  /** 승인된 휴가가 있는 날이면 유형/급여 정보를 포함(§4.6, LeaveRequest 병합) */
  leave: { typeName: string; payType: "PAID" | "UNPAID" } | null;
}

export interface MonthlyAttendanceSummary {
  days: MonthlyAttendanceDay[];
  workDays: number;
  leaveDays: number;
  /** leaveDays 중 무급 휴가 일수(§6 module-12 — 근태 요약에 무급 배지 표시) */
  unpaidLeaveDays: number;
  uncheckedDays: number;
}

/**
 * §4.6 "월별 근태 조회" — AttendanceRecord LEFT JOIN LeaveRequest(status=APPROVED, 기간 겹침).
 * 근무일(월~금) 기준으로 하루씩 순회하며 근태·휴가 상태를 병합한다.
 */
export async function getMonthlyAttendance(userId: string, month: string): Promise<MonthlyAttendanceSummary> {
  const [year, monthNum] = month.split("-").map(Number);
  const rangeStart = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const rangeEnd = `${month}-${pad2(lastDay)}`;

  const now = new Date();
  const rawRecords = await listAttendanceRecordsInRange(userId, rangeStart, rangeEnd);
  const records = await Promise.all(rawRecords.map((r) => applyAutoCheckoutIfDue(r, now)));
  const recordByDate = new Map(records.map((r) => [r.date, r]));
  const overlapping = await listApprovedLeaveRequestsOverlapping(rangeStart, rangeEnd);
  const approvedLeaves = overlapping.filter((l) => l.userId === userId);

  const days: MonthlyAttendanceDay[] = [];
  let workDays = 0;
  let leaveDays = 0;
  let unpaidLeaveDays = 0;
  let uncheckedDays = 0;
  const todayKey = nowDateKey(now);

  for (let d = 1; d <= lastDay; d++) {
    const dateKey = `${month}-${pad2(d)}`;
    if (dateKey > todayKey) break; // 미래 날짜는 집계하지 않음
    const dow = new Date(year, monthNum - 1, d).getDay();
    if (dow === 0 || dow === 6) continue; // 주말 제외(근무일 기준)

    const leave = approvedLeaves.find((l) => l.startDate <= dateKey && l.endDate >= dateKey);
    const record = recordByDate.get(dateKey);

    let leaveInfo: MonthlyAttendanceDay["leave"] = null;
    if (leave) {
      const leaveType = await getLeaveTypeConfig(leave.leaveTypeId);
      leaveInfo = { typeName: leaveType?.name ?? "휴가", payType: leaveType?.payType ?? "PAID" };
      leaveDays++;
      if (leaveInfo.payType === "UNPAID") unpaidLeaveDays++;
    } else if (record?.checkInAt) {
      workDays++;
    } else {
      uncheckedDays++;
    }

    days.push({
      date: dateKey,
      checkInAt: record?.checkInAt ?? null,
      checkOutAt: record?.checkOutAt ?? null,
      autoCheckedOut: record?.autoCheckedOut ?? false,
      leave: leaveInfo,
    });
  }

  return { days, workDays, leaveDays, unpaidLeaveDays, uncheckedDays };
}

export interface AttendanceStatusRow {
  userId: string;
  userName: string;
  deptName: string;
  position: string;
  workDays: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  uncheckedDays: number;
}

/**
 * module-13 §관리자 근태 현황 — 재직 중인 전 직원의 월간 근태 요약을 한 번에 조회한다(관리자 전용).
 * 개인 화면(getMonthlyAttendance)의 재직자 순회 버전으로, 부서/직급 정보를 함께 병합한다.
 */
export async function getAttendanceStatusRows(month: string): Promise<AttendanceStatusRow[]> {
  const users = (await listUsers()).filter((u) => u.employmentStatus !== "RESIGNED");
  const rows: AttendanceStatusRow[] = [];
  for (const u of users) {
    const summary = await getMonthlyAttendance(u.id, month);
    const dept = await getDepartment(u.departmentId);
    rows.push({
      userId: u.id,
      userName: u.name,
      deptName: dept?.name ?? "—",
      position: u.position,
      workDays: summary.workDays,
      leaveDays: summary.leaveDays,
      unpaidLeaveDays: summary.unpaidLeaveDays,
      uncheckedDays: summary.uncheckedDays,
    });
  }
  return rows;
}

/* ---------- OvertimeRequest ---------- */

export interface SubmitOvertimeInput {
  userId: string;
  departmentId: string;
  date: string;
  expectedEndTime: string; // HH:MM
  workDetail: string;
  reason: string;
}

export async function submitOvertimeRequest(input: SubmitOvertimeInput): Promise<OvertimeRequest> {
  const [h, m] = input.expectedEndTime.split(":").map(Number);
  if (h * 60 + m < 19 * 60) {
    throw new AttendanceServiceError("예상 퇴근시간은 19:00 이후여야 합니다.", "VALIDATION");
  }
  if (!input.workDetail.trim() || !input.reason.trim()) {
    throw new AttendanceServiceError("업무내용과 사유를 입력해주세요.", "VALIDATION");
  }

  const record = await createOvertimeRequest({
    userId: input.userId,
    date: input.date,
    expectedEndTime: input.expectedEndTime,
    workDetail: input.workDetail,
    reason: input.reason,
    status: "PENDING",
    approvalId: null,
  });

  const approval = await submitForApproval({
    targetType: "OVERTIME",
    targetId: record.id,
    submitterId: input.userId,
    departmentId: input.departmentId,
    targetVersion: record.version,
  });
  return (await updateOvertimeRequest(record.id, { approvalId: approval.id }))!;
}

export async function recallOvertimeRequest(id: string, requesterId: string): Promise<OvertimeRequest> {
  const record = await getOvertimeRequest(id);
  if (!record) throw new AttendanceServiceError("신청 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new AttendanceServiceError("본인이 신청한 건만 회수할 수 있습니다.", "FORBIDDEN");
  if (!record.approvalId) throw new AttendanceServiceError("상신 정보가 없어 회수할 수 없습니다.", "VALIDATION");

  await recallApproval(record.approvalId, requesterId);
  return (await updateOvertimeRequest(id, { status: "RECALLED" }))!;
}

export interface OvertimeStatusRow {
  id: string;
  userId: string;
  userName: string;
  deptName: string;
  date: string;
  expectedEndTime: string;
  workDetail: string;
  reason: string;
  status: OvertimeRequest["status"];
  createdAt: string;
}

/**
 * module-13 §관리자 초과근무 현황 — 재직 중인 전 직원의 초과근무 신청 이력을 한 번에 조회한다(관리자 전용).
 * month가 주어지면 해당 월(YYYY-MM)로 필터링한다.
 */
export async function getOvertimeStatusRows(month?: string): Promise<OvertimeStatusRow[]> {
  const users = (await listUsers()).filter((u) => u.employmentStatus !== "RESIGNED");
  const rows: OvertimeStatusRow[] = [];
  for (const u of users) {
    const dept = await getDepartment(u.departmentId);
    const deptName = dept?.name ?? "—";
    const requests = await listOvertimeRequestsByUser(u.id);
    for (const r of requests.filter((r) => !month || r.date.startsWith(month))) {
      rows.push({
        id: r.id,
        userId: u.id,
        userName: u.name,
        deptName,
        date: r.date,
        expectedEndTime: r.expectedEndTime,
        workDetail: r.workDetail,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export interface AttendanceReportRow {
  userName: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
}

/** module-10 §4.2 리포트 — 근태 이력. scope="self"면 requesterUserId 본인, "all"이면 전 직원. */
export async function buildAttendanceReportRows(
  scope: "self" | "all",
  requesterUserId: string,
  month: string
): Promise<AttendanceReportRow[]> {
  const targetUserIds =
    scope === "self" ? [requesterUserId] : (await listUsers()).filter((u) => u.employmentStatus !== "RESIGNED").map((u) => u.id);

  const rows: AttendanceReportRow[] = [];
  for (const uid of targetUserIds) {
    const user = await getUserById(uid);
    const userName = user?.name ?? uid;
    const summary = await getMonthlyAttendance(uid, month);
    for (const d of summary.days) {
      rows.push({
        userName,
        date: d.date,
        checkInAt: d.checkInAt,
        checkOutAt: d.checkOutAt,
        status: d.leave ? `휴가(${d.leave.typeName}${d.leave.payType === "UNPAID" ? "·무급" : ""})` : d.checkInAt ? "정상" : "미체크",
      });
    }
  }
  return rows;
}

/** module-2 결재 엔진이 최종 상태에 도달했을 때 lib/approval/sync.ts에서 호출한다. */
export async function syncOvertimeRequestFromApproval(overtimeRequestId: string, approvalStatus: ApprovalStatus): Promise<void> {
  const record = await getOvertimeRequest(overtimeRequestId);
  if (!record) return;
  if (approvalStatus === "APPROVED") await updateOvertimeRequest(overtimeRequestId, { status: "APPROVED" });
  else if (approvalStatus === "REJECTED") await updateOvertimeRequest(overtimeRequestId, { status: "REJECTED" });
  else if (approvalStatus === "RECALLED") await updateOvertimeRequest(overtimeRequestId, { status: "RECALLED" });
}
