// Design Ref: §5 API 설계 — GET(본인 이력) / POST /weekly-reports(상신)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listWeeklyReportsByUser } from "@/lib/data/store";
import { WeeklyReportServiceError, submitWeeklyReport } from "@/lib/weekly-report/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listWeeklyReportsByUser(user.id));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const weekStartDate = typeof body?.weekStartDate === "string" ? body.weekStartDate : "";
  const thisWeekResult = typeof body?.thisWeekResult === "string" ? body.thisWeekResult : "";
  const nextWeekPlan = typeof body?.nextWeekPlan === "string" ? body.nextWeekPlan : "";
  const notes = typeof body?.notes === "string" ? body.notes : "";

  if (!weekStartDate) return NextResponse.json({ error: "대상 주간을 선택해주세요." }, { status: 400 });

  try {
    const record = await submitWeeklyReport({
      userId: user.id,
      departmentId: user.departmentId,
      weekStartDate,
      thisWeekResult,
      nextWeekPlan,
      notes,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof WeeklyReportServiceError || err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
