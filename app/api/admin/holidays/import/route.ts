// Design Ref: 회사 기본정보 §공휴일 지정 — POST /holidays/import?year= : 연도별 법정공휴일 자동 가져오기(ADMIN 전용).
// Nager.Date 공개 API에서 대체공휴일 포함 공휴일을 조회해, 아직 등록되지 않은 날짜만 source="AUTO"로 추가한다.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { importAutoHolidays, listHolidays } from "@/lib/data/store";
import { fetchPublicHolidays, HolidayFetchError } from "@/lib/holidays/nager";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const fetched = await fetchPublicHolidays(year);
    const addedCount = await importAutoHolidays(fetched);
    const holidays = await listHolidays(year);
    return NextResponse.json({ addedCount, skippedCount: fetched.length - addedCount, holidays });
  } catch (err) {
    if (err instanceof HolidayFetchError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
