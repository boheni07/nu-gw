// Design Ref: §5 API 설계 — GET/PUT /hr-records/me (본인 인사기록카드 조회/저장, §3.8)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getHrRecord, getUserById, saveHrRecord } from "@/lib/data/store";
import { emptyHrRecord, sanitizeHrRecordPatch } from "@/lib/hr-record/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const existing = await getHrRecord(user.id);
  if (existing) return NextResponse.json(existing);
  return NextResponse.json(emptyHrRecord(user.id, user.name, user.email));
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (body.agreed !== true) {
    return NextResponse.json({ error: "서약에 동의해야 저장할 수 있습니다." }, { status: 400 });
  }

  const dbUser = await getUserById(user.id);
  const patch = sanitizeHrRecordPatch(body, dbUser?.name ?? "", user.email, true);
  const saved = await saveHrRecord(user.id, patch);

  return NextResponse.json(saved);
}
