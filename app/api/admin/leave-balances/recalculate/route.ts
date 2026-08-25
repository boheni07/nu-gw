// Design Ref: 연차정책설정 §전사 연차산정기준/근속연수별 발생일수 "적용" — 정책 변경 후 재직자 전원의
// 해당 연도 부여일수(granted)를 현재 기준으로 다시 계산한다(관리자 전용).
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { recalculateLeaveBalances } from "@/lib/leave/service";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 재산정할 수 있습니다." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year가 올바르지 않습니다." }, { status: 400 });
  }

  return NextResponse.json(await recalculateLeaveBalances(year));
}
