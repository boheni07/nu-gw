import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { deleteDelegateAssignment } from "@/lib/data/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "APPROVER")) {
    return NextResponse.json({ error: "결재자 이상만 대결자를 지정할 수 있습니다." }, { status: 403 });
  }
  const { id } = await params;
  const removed = await deleteDelegateAssignment(id, user!.id);
  if (!removed) return NextResponse.json({ error: "대결 지정 건을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
