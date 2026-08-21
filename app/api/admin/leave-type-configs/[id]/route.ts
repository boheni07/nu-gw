// Design Ref: §5 API 설계 — /leave-type-configs (ADMIN 전용, 카테고리/증빙 필수 여부/급여유형 수정)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { updateLeaveTypeConfig } from "@/lib/data/store";
import type { LeaveCategory, PayType } from "@/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  // 요청에 실제로 포함된 필드만 patch에 담는다 — 값이 undefined인 키를 그대로 넘기면
  // 객체 스프레드 시 기존 값을 undefined로 덮어써 db.json 저장 시 필드가 통째로 사라지는 문제가 있었다.
  const patch: { requireAttachment?: boolean; payType?: PayType; category?: LeaveCategory } = {};
  if (typeof body.requireAttachment === "boolean") patch.requireAttachment = body.requireAttachment;
  if (typeof body.payType === "string") patch.payType = body.payType;
  if (typeof body.category === "string") patch.category = body.category;

  const { id } = await params;
  const updated = await updateLeaveTypeConfig(id, patch);
  if (!updated) return NextResponse.json({ error: "연차 유형을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}
