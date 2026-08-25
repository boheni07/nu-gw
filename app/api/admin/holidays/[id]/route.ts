// Design Ref: 회사 기본정보 §공휴일 지정 — DELETE(자동/수동 무관 삭제, ADMIN 전용)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { deleteHoliday } from "@/lib/data/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const { id } = await params;
  const removed = await deleteHoliday(id);
  if (!removed) return NextResponse.json({ error: "공휴일을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
