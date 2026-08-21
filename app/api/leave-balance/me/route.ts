// Design Ref: §5 API 설계 — GET /leave-balance/me
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrCreateLeaveBalance } from "@/lib/leave/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const periodYear = new Date().getFullYear();
  const balance = await getOrCreateLeaveBalance(user.id, periodYear);
  return NextResponse.json({ ...balance, remaining: balance.granted - balance.used });
}
