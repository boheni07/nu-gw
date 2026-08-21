// Design Ref: module-20 §회사 기본정보 — 출장비 단가(일비/식비/숙박비 상한액)를 기준연도별로 기록·관리한다.
// 실제 계산(출장결과보고)에는 항상 가장 최근 기준연도(year 최댓값)의 값을 사용한다.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { listTripAllowanceRates, upsertTripAllowanceRate } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });
  return NextResponse.json(await listTripAllowanceRates());
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const year = Number(body?.year);
  const dailyRate = Number(body?.dailyRate);
  const mealRate = Number(body?.mealRate);
  const lodgingCapPerNight = Number(body?.lodgingCapPerNight);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "올바른 기준연도를 입력해주세요." }, { status: 400 });
  }
  if ([dailyRate, mealRate, lodgingCapPerNight].some((v) => !Number.isFinite(v) || v < 0)) {
    return NextResponse.json({ error: "단가는 0 이상의 숫자여야 합니다." }, { status: 400 });
  }

  const rate = await upsertTripAllowanceRate({ year, dailyRate, mealRate, lodgingCapPerNight });
  return NextResponse.json(rate, { status: 201 });
}
