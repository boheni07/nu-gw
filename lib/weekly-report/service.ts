// Design Ref: §3.5 주간업무보고, §4.4 자동 취합 로직, §4.5 휴가 연계 표시 — module-7
import {
  createWeeklyReport,
  findWeeklyReport,
  getUserById,
  getWeeklyReport,
  listApprovedLeaveRequestsOverlapping,
  listDailyReportsInRange,
  updateWeeklyReport,
  updateWeeklyReportIfVersionMatches,
} from "@/lib/data/store";
import { recallApproval, submitForApproval } from "@/lib/approval/engine";
import type { ApprovalStatus, WeeklyReport } from "@/types";

export class WeeklyReportServiceError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "FORBIDDEN" | "DUPLICATE" | "CONFLICT" | "VALIDATION" = "VALIDATION"
  ) {
    super(message);
    this.name = "WeeklyReportServiceError";
  }
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** weekStartDate(월요일)로부터 금요일(weekEndDate)을 계산한다. 월요일이 아니면 해당 주의 월요일로 보정한다. */
export function normalizeWeekStart(dateStr: string): { weekStartDate: string; weekEndDate: string } {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=일 ... 1=월
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (x: Date) => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  return { weekStartDate: fmt(monday), weekEndDate: fmt(friday) };
}

function dateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export interface WeeklyDraftInfo {
  weekStartDate: string;
  weekEndDate: string;
  /** 해당 주 일일업무보고 todayResult를 날짜순으로 이어붙인 초안(§4.4) */
  thisWeekResultDraft: string;
  /** 취합에 사용된 일자 수(일일업무보고가 있는 날만 포함) */
  coveredDays: number;
  /** 해당 주간 본인/같은 부서 팀원의 승인된 휴가 — 인원수·일자 배지용(§4.5) */
  teamLeaves: { userName: string; startDate: string; endDate: string }[];
  /** 해당 주(월~금) 일자별 본인 일일업무보고 작성 현황(§6 module-12 — "이번 주 일일보고 현황" 사이드 카드) */
  dailyStatuses: { date: string; status: string | null }[];
}

/** §4.4 — 작성 화면 진입 시 자동 취합 초안을 계산한다(저장하지 않음, 조회 전용). */
export async function getWeeklyDraft(userId: string, weekStartInput: string): Promise<WeeklyDraftInfo> {
  const { weekStartDate, weekEndDate } = normalizeWeekStart(weekStartInput);
  const dailyReports = await listDailyReportsInRange(userId, weekStartDate, weekEndDate);

  const thisWeekResultDraft = dailyReports.map((r) => `[${dateLabel(r.reportDate)}] ${r.todayResult}`).join("\n");

  const user = await getUserById(userId);
  const overlappingLeaves = await listApprovedLeaveRequestsOverlapping(weekStartDate, weekEndDate);
  const teamLeaves: WeeklyDraftInfo["teamLeaves"] = [];
  for (const l of overlappingLeaves) {
    const requester = await getUserById(l.userId);
    if (requester && (l.userId === userId || requester.departmentId === user?.departmentId)) {
      teamLeaves.push({ userName: requester.name, startDate: l.startDate, endDate: l.endDate });
    }
  }

  const dailyByDate = new Map(dailyReports.map((r) => [r.reportDate, r.status]));
  const monday = new Date(weekStartDate + "T00:00:00");
  const dailyStatuses = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return { date, status: dailyByDate.get(date) ?? null };
  });

  return {
    weekStartDate,
    weekEndDate,
    thisWeekResultDraft,
    coveredDays: dailyReports.length,
    teamLeaves,
    dailyStatuses,
  };
}

export interface SubmitWeeklyReportInput {
  userId: string;
  departmentId: string;
  weekStartDate: string;
  thisWeekResult: string;
  nextWeekPlan: string;
  notes: string;
}

export async function submitWeeklyReport(input: SubmitWeeklyReportInput): Promise<WeeklyReport> {
  const { weekStartDate, weekEndDate } = normalizeWeekStart(input.weekStartDate);
  const existing = await findWeeklyReport(input.userId, weekStartDate);
  if (existing) {
    throw new WeeklyReportServiceError("해당 주간의 주간업무보고가 이미 존재합니다.", "DUPLICATE");
  }
  if (!input.thisWeekResult.trim() || !input.nextWeekPlan.trim()) {
    throw new WeeklyReportServiceError("금주 업무실적과 차주 업무계획을 입력해주세요.");
  }

  const record = await createWeeklyReport({
    userId: input.userId,
    weekStartDate,
    weekEndDate,
    thisWeekResult: input.thisWeekResult,
    nextWeekPlan: input.nextWeekPlan,
    notes: input.notes,
    status: "PENDING",
    approvalId: null,
  });

  try {
    const approval = await submitForApproval({
      targetType: "WEEKLY_REPORT",
      targetId: record.id,
      submitterId: input.userId,
      departmentId: input.departmentId,
      targetVersion: record.version,
    });
    return (await updateWeeklyReport(record.id, { approvalId: approval.id }))!;
  } catch (err) {
    await updateWeeklyReport(record.id, { status: "REJECTED" });
    throw err;
  }
}

export async function recallWeeklyReport(id: string, requesterId: string): Promise<WeeklyReport> {
  const record = await getWeeklyReport(id);
  if (!record) throw new WeeklyReportServiceError("보고서를 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new WeeklyReportServiceError("본인이 작성한 건만 회수할 수 있습니다.", "FORBIDDEN");
  if (!record.approvalId) throw new WeeklyReportServiceError("상신 정보가 없어 회수할 수 없습니다.", "CONFLICT");

  await recallApproval(record.approvalId, requesterId);
  return (await updateWeeklyReport(id, { status: "RECALLED" }))!;
}

export interface EditWeeklyReportInput {
  thisWeekResult?: string;
  nextWeekPlan?: string;
  notes?: string;
}

/** §4.7 — 대기중(1단계 미처리) 수정. */
export async function editWeeklyReport(
  id: string,
  requesterId: string,
  clientVersion: number,
  input: EditWeeklyReportInput
): Promise<WeeklyReport> {
  const record = await getWeeklyReport(id);
  if (!record) throw new WeeklyReportServiceError("보고서를 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new WeeklyReportServiceError("본인이 작성한 건만 수정할 수 있습니다.", "FORBIDDEN");

  const updated = await updateWeeklyReportIfVersionMatches(id, clientVersion, {
    thisWeekResult: input.thisWeekResult ?? record.thisWeekResult,
    nextWeekPlan: input.nextWeekPlan ?? record.nextWeekPlan,
    notes: input.notes ?? record.notes,
  });
  if (!updated) {
    throw new WeeklyReportServiceError("이미 처리가 진행되어 수정할 수 없습니다. 최신 내용을 다시 불러와주세요.", "CONFLICT");
  }
  return updated;
}

/** module-2 결재 엔진이 최종 상태에 도달했을 때 lib/approval/sync.ts에서 호출한다. */
export async function syncWeeklyReportFromApproval(weeklyReportId: string, approvalStatus: ApprovalStatus): Promise<void> {
  if (!(await getWeeklyReport(weeklyReportId))) return;
  if (approvalStatus === "APPROVED") await updateWeeklyReport(weeklyReportId, { status: "APPROVED" });
  else if (approvalStatus === "REJECTED") await updateWeeklyReport(weeklyReportId, { status: "REJECTED" });
  else if (approvalStatus === "RECALLED") await updateWeeklyReport(weeklyReportId, { status: "RECALLED" });
}
