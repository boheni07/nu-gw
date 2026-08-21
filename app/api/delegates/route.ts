// Design Ref: §3.2 DelegateAssignment — 승인권자 부재 시 대결자 지정(자기 자신에 대해서만 설정)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { createDelegateAssignment, listDelegateAssignments } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "APPROVER")) {
    return NextResponse.json({ error: "결재자 이상만 대결자를 지정할 수 있습니다." }, { status: 403 });
  }
  return NextResponse.json(await listDelegateAssignments(user!.id));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "APPROVER")) {
    return NextResponse.json({ error: "결재자 이상만 대결자를 지정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const delegateUserId = typeof body?.delegateUserId === "string" ? body.delegateUserId : "";
  const startDate = typeof body?.startDate === "string" ? body.startDate : "";
  const endDate = typeof body?.endDate === "string" ? body.endDate : "";

  if (!delegateUserId || !startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "대결자와 올바른 기간(시작일 ≤ 종료일)이 필요합니다." }, { status: 400 });
  }
  if (delegateUserId === user!.id) {
    return NextResponse.json({ error: "본인을 대결자로 지정할 수 없습니다." }, { status: 400 });
  }

  const created = await createDelegateAssignment({ delegatorUserId: user!.id, delegateUserId, startDate, endDate });
  return NextResponse.json(created, { status: 201 });
}
