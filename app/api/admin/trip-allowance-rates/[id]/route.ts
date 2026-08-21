import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { deleteTripAllowanceRate } from "@/lib/data/store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const { id } = await params;
  const ok = await deleteTripAllowanceRate(id);
  if (!ok) return NextResponse.json({ error: "기준연도 단가를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
