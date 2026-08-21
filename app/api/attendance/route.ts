// Design Ref: §5 API 설계 — GET /attendance?month= (월간 근태기록 조회, 휴가·급여유형 병합)
// 근태관리는 관리자를 포함해 누구나 본인 내역만 조회할 수 있다(타 직원 조회 기능 제거 — 사용자 요청).
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getMonthlyAttendance } from "@/lib/attendance/service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month는 YYYY-MM 형식이어야 합니다." }, { status: 400 });
  }

  return NextResponse.json(await getMonthlyAttendance(user.id, month));
}
