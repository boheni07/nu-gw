// Design Ref: §5 API 설계 — GET /weekly-reports/draft?weekStart= (자동 취합 초안, §4.4)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWeeklyDraft } from "@/lib/weekly-report/service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "weekStart는 YYYY-MM-DD 형식이어야 합니다." }, { status: 400 });
  }

  return NextResponse.json(await getWeeklyDraft(user.id, weekStart));
}
