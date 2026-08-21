// Design Ref: §7 RBAC, module-15 §관리자 인사기록 관리 — GET/PUT /admin/hr-records/:userId (관리자 전용)
// 본인 서약(agreed)은 관리자가 대신 체크/해제하지 않는다 — 기존 값을 그대로 보존한다.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getHrRecord, getUserById, saveHrRecord } from "@/lib/data/store";
import { emptyHrRecord, sanitizeHrRecordPatch } from "@/lib/hr-record/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });

  const { userId } = await params;
  const target = await getUserById(userId);
  if (!target) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const existing = await getHrRecord(userId);
  if (existing) return NextResponse.json(existing);
  return NextResponse.json(emptyHrRecord(userId, target.name, target.email));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });

  const { userId } = await params;
  const target = await getUserById(userId);
  if (!target) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const existing = await getHrRecord(userId);
  const patch = sanitizeHrRecordPatch(body, target.name, target.email, existing?.agreed ?? false);
  const saved = await saveHrRecord(userId, patch);

  return NextResponse.json(saved);
}
