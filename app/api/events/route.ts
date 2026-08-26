// Design Ref: §5 API 설계 — CRUD /events (전 직원 등록 가능, 본인 건만 수정·삭제, ADMIN은 전체)
// module-24: 반복일정(매일/매주/매월 + 종료일) 등록 지원 — repeat이 있으면 occurrence를 한 번에 여러 개 만든다.
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createEvent, createEvents, listEvents } from "@/lib/data/store";
import { expandRecurrence, RecurrenceError, type MonthlyMode, type RecurrenceFrequency } from "@/lib/calendar/recurrence";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listEvents());
}

const VALID_FREQUENCIES: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];
const VALID_MONTHLY_MODES: MonthlyMode[] = ["DAY_OF_MONTH", "NTH_WEEKDAY"];

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
  const repeat =
    body?.repeat && VALID_FREQUENCIES.includes(body.repeat.frequency) && typeof body.repeat.until === "string"
      ? {
          frequency: body.repeat.frequency as RecurrenceFrequency,
          until: body.repeat.until,
          daysOfWeek: Array.isArray(body.repeat.daysOfWeek)
            ? body.repeat.daysOfWeek.filter((d: unknown): d is number => typeof d === "number" && d >= 0 && d <= 6)
            : undefined,
          monthlyMode: VALID_MONTHLY_MODES.includes(body.repeat.monthlyMode) ? (body.repeat.monthlyMode as MonthlyMode) : undefined,
        }
      : null;

  if (!title || !startAt || !endAt || endAt < startAt) {
    return NextResponse.json({ error: "제목과 올바른 일시(시작 ≤ 종료)를 입력해주세요." }, { status: 400 });
  }

  const base = { title, location, description, createdBy: user.id, departmentTag };

  if (!repeat) {
    const created = await createEvent({ ...base, startAt, endAt, recurrenceGroupId: null });
    return NextResponse.json({ events: [created] }, { status: 201 });
  }

  try {
    const occurrences = expandRecurrence(startAt, endAt, repeat);
    const recurrenceGroupId = `rec-${randomBytes(12).toString("hex")}`;
    const created = await createEvents(occurrences.map((o) => ({ ...base, startAt: o.startAt, endAt: o.endAt, recurrenceGroupId })));
    return NextResponse.json({ events: created }, { status: 201 });
  } catch (err) {
    if (err instanceof RecurrenceError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
