// Design Ref: §5 API 설계 — CRUD /leave-policies (ADMIN 전용, 근속연수 구간별 발생일수)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { createLeavePolicy, listLeavePolicies } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listLeavePolicies());
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const minYears = Number(body?.minYears);
  const maxYears = Number(body?.maxYears);
  const grantDays = Number(body?.grantDays);
  if (!Number.isFinite(minYears) || !Number.isFinite(maxYears) || !Number.isFinite(grantDays) || maxYears <= minYears) {
    return NextResponse.json({ error: "올바른 근속연수 구간(최소<최대)과 발생일수를 입력해주세요." }, { status: 400 });
  }

  const created = await createLeavePolicy({ minYears, maxYears, grantDays });
  return NextResponse.json(created, { status: 201 });
}
