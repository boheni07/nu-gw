// Design Ref: 캘린더 §반복일정(module-24) — 구글 캘린더 방식의 표준 반복 옵션.
// - 매주: 반복할 요일을 여러 개 선택할 수 있다(예: 월/수/금).
// - 매월: "매월 OO일"(day-of-month) 또는 "매월 n째주 요일요일"(nth-weekday) 중 선택.
// 별도 RRULE 저장 없이(간소화), 등록 시점에 각 occurrence를 실제 Event 행으로 미리 만들어(materialize)
// 같은 recurrenceGroupId로 묶는다. 무한 반복은 없고 반드시 종료일(until)까지만 생성한다.

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type MonthlyMode = "DAY_OF_MONTH" | "NTH_WEEKDAY";

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  until: string; // YYYY-MM-DD, 이 날짜까지 포함
  /** WEEKLY 전용 — 0(일)~6(토). 비어있으면 시작일의 요일을 사용한다. */
  daysOfWeek?: number[];
  /** MONTHLY 전용 — 기본 DAY_OF_MONTH(예: 매월 27일). */
  monthlyMode?: MonthlyMode;
}

export const MAX_RECURRENCE_OCCURRENCES = 200;
/** WEEKLY 요일 매칭 탐색 시 무한루프 방지용 하드 캡(약 10년치 일수). */
const MAX_SCAN_DAYS = 3660;

export class RecurrenceError extends Error {}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** ordinal: 1~4=n째 주, -1=마지막 주. 그 달에 존재하지 않으면(예: 5번째 화요일이 없는 달) null. */
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, ordinal: number): Date | null {
  if (ordinal === -1) {
    const last = new Date(year, month0 + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month0, last.getDate() - diff);
  }
  const first = new Date(year, month0, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  const day = 1 + diff + (ordinal - 1) * 7;
  if (day > daysInMonth(year, month0)) return null;
  return new Date(year, month0, day);
}

/** 시작일 기준 "n째 주 요일요일" 표현을 구한다(5번째 발생은 구글 캘린더처럼 "마지막 주"로 취급). */
export function deriveNthWeekday(startDateStr: string): { weekday: number; ordinal: number } {
  const start = new Date(startDateStr + "T00:00:00");
  const weekday = start.getDay();
  const ordinalRaw = Math.ceil(start.getDate() / 7);
  const ordinal = ordinalRaw >= 5 ? -1 : ordinalRaw;
  return { weekday, ordinal };
}

/**
 * startAt/endAt(YYYY-MM-DDTHH:mm:ss)을 기준으로 반복 occurrence들의 {startAt, endAt} 목록을 만든다(첫 회차 포함).
 * 일자 간격(종료일 - 시작일, 여러 날짜에 걸친 일정 대비)은 매 occurrence마다 동일하게 유지한다.
 */
export function expandRecurrence(
  startAt: string,
  endAt: string,
  repeat: RecurrenceInput
): { startAt: string; endAt: string }[] {
  const startDateStr = startAt.slice(0, 10);
  const endDateStr = endAt.slice(0, 10);
  const startTimePart = startAt.slice(10); // "T09:00:00"
  const endTimePart = endAt.slice(10);
  const dayDeltaMs = new Date(endDateStr + "T00:00:00").getTime() - new Date(startDateStr + "T00:00:00").getTime();

  if (repeat.until < startDateStr) {
    throw new RecurrenceError("반복 종료일은 시작일 이후여야 합니다.");
  }

  const startDate = new Date(startDateStr + "T00:00:00");
  const until = new Date(repeat.until + "T00:00:00");
  const occurrences: { startAt: string; endAt: string }[] = [];

  function push(occStart: Date) {
    const occEnd = new Date(occStart.getTime() + dayDeltaMs);
    occurrences.push({ startAt: `${dateKey(occStart)}${startTimePart}`, endAt: `${dateKey(occEnd)}${endTimePart}` });
    if (occurrences.length > MAX_RECURRENCE_OCCURRENCES) {
      throw new RecurrenceError(`반복 일정이 너무 많습니다(최대 ${MAX_RECURRENCE_OCCURRENCES}회). 종료일을 좁혀주세요.`);
    }
  }

  if (repeat.frequency === "DAILY") {
    let cursor = startDate;
    while (cursor.getTime() <= until.getTime()) {
      push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  } else if (repeat.frequency === "WEEKLY") {
    const days = repeat.daysOfWeek && repeat.daysOfWeek.length > 0 ? repeat.daysOfWeek : [startDate.getDay()];
    let cursor = startDate;
    let scanned = 0;
    while (cursor.getTime() <= until.getTime()) {
      if (days.includes(cursor.getDay())) push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      scanned++;
      if (scanned > MAX_SCAN_DAYS) throw new RecurrenceError("반복 종료일이 너무 멀리 있습니다. 종료일을 좁혀주세요.");
    }
  } else {
    // MONTHLY
    const mode: MonthlyMode = repeat.monthlyMode ?? "DAY_OF_MONTH";
    const dayOfMonth = startDate.getDate();
    const { weekday, ordinal } = deriveNthWeekday(startDateStr);
    let year = startDate.getFullYear();
    let month0 = startDate.getMonth();
    let scanned = 0;
    while (year < until.getFullYear() || (year === until.getFullYear() && month0 <= until.getMonth())) {
      const occ = mode === "DAY_OF_MONTH" ? (dayOfMonth <= daysInMonth(year, month0) ? new Date(year, month0, dayOfMonth) : null) : nthWeekdayOfMonth(year, month0, weekday, ordinal);
      if (occ && occ.getTime() >= startDate.getTime() && occ.getTime() <= until.getTime()) push(occ);
      month0++;
      if (month0 > 11) {
        month0 = 0;
        year++;
      }
      scanned++;
      if (scanned > 240) throw new RecurrenceError("반복 종료일이 너무 멀리 있습니다. 종료일을 좁혀주세요.");
    }
  }

  if (occurrences.length === 0) {
    throw new RecurrenceError("선택한 조건에 맞는 반복 일정이 없습니다(요일/종료일을 확인해주세요).");
  }
  return occurrences;
}
