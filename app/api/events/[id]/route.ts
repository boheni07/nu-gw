// Design Ref: §5 API 설계 — CRUD /events — 본인 등록 건만 수정·삭제(ADMIN은 전체)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { deleteEvent, getEvent, updateEvent } from "@/lib/data/store";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const existing = await getEvent(id);
  if (!existing) return NextResponse.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
  if (existing.createdBy !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "본인이 등록한 일정만 수정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const { createdBy, id: _id, ...patch } = body;

  const updated = await updateEvent(id, patch);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const existing = await getEvent(id);
  if (!existing) return NextResponse.json({ error: "일정을 찾을 수 없습니다." }, { status: 404 });
  if (existing.createdBy !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "본인이 등록한 일정만 삭제할 수 있습니다." }, { status: 403 });
  }

  await deleteEvent(id);
  return NextResponse.json({ ok: true });
}
