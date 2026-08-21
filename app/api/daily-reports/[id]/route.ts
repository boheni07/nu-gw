// Design Ref: §5 API 설계 — PUT /daily-reports/:id (수정, §4.7)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { DailyReportServiceError, editDailyReport } from "@/lib/daily-report/service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.version !== "number") {
    return NextResponse.json({ error: "version 정보가 필요합니다." }, { status: 400 });
  }

  const { id } = await params;
  try {
    const updated = await editDailyReport(id, user.id, body.version, {
      todayResult: body.todayResult,
      tomorrowPlan: body.tomorrowPlan,
      notes: body.notes,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof DailyReportServiceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
