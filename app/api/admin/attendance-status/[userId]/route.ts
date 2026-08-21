// Design Ref: §7 RBAC, module-13 §관리자 근태 현황 — GET /admin/attendance-status/:userId?month= (개인 일자별 상세, 관리자 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getMonthlyAttendance } from "@/lib/attendance/service";
import { getUserById } from "@/lib/data/store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });

  const { userId } = await params;
  if (!(await getUserById(userId))) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month는 YYYY-MM 형식이어야 합니다." }, { status: 400 });
  }

  return NextResponse.json(await getMonthlyAttendance(userId, month));
}
