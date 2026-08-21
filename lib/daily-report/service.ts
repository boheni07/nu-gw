// Design Ref: §3.5 일일업무보고, §4.3 자동 초안 로직, §4.5 휴가 연계 표시 — module-6
import {
  createDailyReport,
  findDailyReport,
  getDailyReport,
  listApprovedLeaveRequestsOverlapping,
  updateDailyReport,
  updateDailyReportIfVersionMatches,
} from "@/lib/data/store";
import { recallApproval, submitForApproval } from "@/lib/approval/engine";
import { previousBusinessDay } from "@/lib/shared/dates";
import type { ApprovalStatus, DailyReport } from "@/types";

export class DailyReportServiceError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "FORBIDDEN" | "DUPLICATE" | "CONFLICT" | "VALIDATION" = "VALIDATION"
  ) {
    super(message);
    this.name = "DailyReportServiceError";
  }
}

export interface DraftInfo {
  reportDate: string;
  previousBusinessDay: string;
  /** 전일 tomorrowPlan을 그대로 가져온 초안(전일 보고 없으면 빈 값, §4.3) */
  todayResultDraft: string;
  /** 전일 본인 승인된 휴가가 있었는지(§4.5 안내 배지) */
  prevDayWasLeave: boolean;
}

/** §4.3 — 작성 화면 진입 시 자동 초안을 계산한다(저장하지 않음, 조회 전용). */
export async function getDraft(userId: string, reportDate: string): Promise<DraftInfo> {
  const prevDay = previousBusinessDay(reportDate);
  const prevReport = await findDailyReport(userId, prevDay);
  const todayResultDraft = prevReport?.tomorrowPlan ?? "";

  const overlapping = await listApprovedLeaveRequestsOverlapping(prevDay, prevDay);
  const prevDayLeaves = overlapping.filter((l) => l.userId === userId);

  return {
    reportDate,
    previousBusinessDay: prevDay,
    todayResultDraft,
    prevDayWasLeave: prevDayLeaves.length > 0,
  };
}

export interface SubmitDailyReportInput {
  userId: string;
  departmentId: string;
  reportDate: string;
  todayResult: string;
  tomorrowPlan: string;
  notes: string;
}

/** 상신 — 하루에 한 건만 허용, 결재 상신까지 한 번에 처리한다(module-6 간소화, DRAFT 단계 생략). */
export async function submitDailyReport(input: SubmitDailyReportInput): Promise<DailyReport> {
  const existing = await findDailyReport(input.userId, input.reportDate);
  if (existing) {
    throw new DailyReportServiceError("해당 날짜의 일일업무보고가 이미 존재합니다.", "DUPLICATE");
  }
  if (!input.todayResult.trim() || !input.tomorrowPlan.trim()) {
    throw new DailyReportServiceError("당일 업무실적과 다음날 업무계획을 입력해주세요.");
  }

  const record = await createDailyReport({
    userId: input.userId,
    reportDate: input.reportDate,
    todayResult: input.todayResult,
    tomorrowPlan: input.tomorrowPlan,
    notes: input.notes,
    status: "PENDING",
    approvalId: null,
  });

  try {
    const approval = await submitForApproval({
      targetType: "DAILY_REPORT",
      targetId: record.id,
      submitterId: input.userId,
      departmentId: input.departmentId,
      targetVersion: record.version,
    });
    return (await updateDailyReport(record.id, { approvalId: approval.id }))!;
  } catch (err) {
    await updateDailyReport(record.id, { status: "REJECTED" });
    throw err;
  }
}

export async function recallDailyReport(id: string, requesterId: string): Promise<DailyReport> {
  const record = await getDailyReport(id);
  if (!record) throw new DailyReportServiceError("보고서를 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new DailyReportServiceError("본인이 작성한 건만 회수할 수 있습니다.", "FORBIDDEN");
  if (!record.approvalId) throw new DailyReportServiceError("상신 정보가 없어 회수할 수 없습니다.", "CONFLICT");

  await recallApproval(record.approvalId, requesterId);
  return (await updateDailyReport(id, { status: "RECALLED" }))!;
}

export interface EditDailyReportInput {
  todayResult?: string;
  tomorrowPlan?: string;
  notes?: string;
}

/** §4.7 — 대기중(1단계 미처리) 수정. */
export async function editDailyReport(
  id: string,
  requesterId: string,
  clientVersion: number,
  input: EditDailyReportInput
): Promise<DailyReport> {
  const record = await getDailyReport(id);
  if (!record) throw new DailyReportServiceError("보고서를 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new DailyReportServiceError("본인이 작성한 건만 수정할 수 있습니다.", "FORBIDDEN");

  const updated = await updateDailyReportIfVersionMatches(id, clientVersion, {
    todayResult: input.todayResult ?? record.todayResult,
    tomorrowPlan: input.tomorrowPlan ?? record.tomorrowPlan,
    notes: input.notes ?? record.notes,
  });
  if (!updated) {
    throw new DailyReportServiceError("이미 처리가 진행되어 수정할 수 없습니다. 최신 내용을 다시 불러와주세요.", "CONFLICT");
  }
  return updated;
}

/** module-2 결재 엔진이 최종 상태에 도달했을 때 lib/approval/sync.ts에서 호출한다. */
export async function syncDailyReportFromApproval(dailyReportId: string, approvalStatus: ApprovalStatus): Promise<void> {
  if (!(await getDailyReport(dailyReportId))) return;
  if (approvalStatus === "APPROVED") await updateDailyReport(dailyReportId, { status: "APPROVED" });
  else if (approvalStatus === "REJECTED") await updateDailyReport(dailyReportId, { status: "REJECTED" });
  else if (approvalStatus === "RECALLED") await updateDailyReport(dailyReportId, { status: "RECALLED" });
}
