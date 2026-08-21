import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { updateDepartment } from "@/lib/data/store";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const patch = await request.json().catch(() => null);
  if (!patch) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const { id } = await params;
  const updated = await updateDepartment(id, patch);
  if (!updated) return NextResponse.json({ error: "부서를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}
