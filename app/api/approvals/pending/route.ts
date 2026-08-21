// Design Ref: §5 API 설계 — GET /approvals/pending?approver=me
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listPendingApprovalsForApprover } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listPendingApprovalsForApprover(user.id));
}
