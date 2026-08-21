// Design Ref: §7 RBAC, module-13 §관리자 연차 현황 — GET /admin/leave-status?year= (재직자 전원 연차 부여/사용/잔여, 관리자 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getLeaveStatusRows } from "@/lib/leave/service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year가 올바르지 않습니다." }, { status: 400 });
  }

  return NextResponse.json(await getLeaveStatusRows(year));
}
