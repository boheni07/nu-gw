// Design Ref: §5 API 설계 — CRUD /events (전 직원 등록 가능, 본인 건만 수정·삭제, ADMIN은 전체)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createEvent, listEvents } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listEvents());
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const startAt = typeof body?.startAt === "string" ? body.startAt : "";
  const endAt = typeof body?.endAt === "string" ? body.endAt : "";
  const location = typeof body?.location === "string" && body.location.trim() ? body.location.trim() : null;
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const departmentTag = typeof body?.departmentTag === "string" && body.departmentTag ? body.departmentTag : null;

  if (!title || !startAt || !endAt || endAt < startAt) {
    return NextResponse.json({ error: "제목과 올바른 일시(시작 ≤ 종료)를 입력해주세요." }, { status: 400 });
  }

  const created = await createEvent({ title, startAt, endAt, location, description, createdBy: user.id, departmentTag });
  return NextResponse.json(created, { status: 201 });
}
