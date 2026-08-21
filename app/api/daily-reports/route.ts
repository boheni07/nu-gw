// Design Ref: §5 API 설계 — GET(본인 이력) / POST /daily-reports(상신)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listDailyReportsByUser } from "@/lib/data/store";
import { DailyReportServiceError, submitDailyReport } from "@/lib/daily-report/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listDailyReportsByUser(user.id));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const reportDate = typeof body?.reportDate === "string" ? body.reportDate : "";
  const todayResult = typeof body?.todayResult === "string" ? body.todayResult : "";
  const tomorrowPlan = typeof body?.tomorrowPlan === "string" ? body.tomorrowPlan : "";
  const notes = typeof body?.notes === "string" ? body.notes : "";

  if (!reportDate) return NextResponse.json({ error: "대상 일자를 입력해주세요." }, { status: 400 });

  try {
    const record = await submitDailyReport({
      userId: user.id,
      departmentId: user.departmentId,
      reportDate,
      todayResult,
      tomorrowPlan,
      notes,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof DailyReportServiceError || err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
