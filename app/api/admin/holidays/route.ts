// Design Ref: 회사 기본정보 §공휴일 지정 — GET(연도별 목록 조회) / POST(수동 추가, ADMIN 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { createHoliday, findHolidayByDate, listHolidays } from "@/lib/data/store";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    return NextResponse.json({ error: "year가 올바르지 않습니다." }, { status: 400 });
  }

  return NextResponse.json(await listHolidays(year));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!DATE_RE.test(date) || !name) {
    return NextResponse.json({ error: "날짜(YYYY-MM-DD)와 명칭을 입력해주세요." }, { status: 400 });
  }

  const existing = await findHolidayByDate(date);
  if (existing) {
    return NextResponse.json({ error: `이미 등록된 날짜입니다(${existing.name}). 먼저 삭제 후 다시 추가해주세요.` }, { status: 409 });
  }

  const created = await createHoliday({ date, name, source: "MANUAL" });
  return NextResponse.json(created, { status: 201 });
}
