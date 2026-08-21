// Design Ref: module-20 §결재선 설정 — 설정된 결재선 삭제(비활성화). 이력 보존을 위해 물리 삭제 대신
// isActive=false로 전환한다(이미 상신된 Approval은 스냅샷을 보관하므로 영향받지 않음, §3.2).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { setApprovalLineActive } from "@/lib/data/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const { id } = await params;
  const updated = await setApprovalLineActive(id, false);
  if (!updated) return NextResponse.json({ error: "결재선을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
