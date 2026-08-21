// Design Ref: §7 RBAC, module-13 §관리자 초과근무 현황 — GET /admin/overtime-status?month= (재직자 전원 신청 이력, 관리자 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getOvertimeStatusRows } from "@/lib/attendance/service";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month는 YYYY-MM 형식이어야 합니다." }, { status: 400 });
  }

  return NextResponse.json(await getOvertimeStatusRows(month));
}
