// Design Ref: module-13 §출장결과보고 계산 로직 — lib/data/store에 의존하지 않는 순수 함수만 모아둔다.
// (lib/leave/calc.ts와 동일한 이유: fs를 사용하는 store.ts를 거치지 않아야 클라이언트 컴포넌트에서도
// import 가능하다 — 출장일수/기한 미리보기를 서버 재조회 없이 즉시 계산하기 위함)
import type { BusinessTrip } from "@/types";

/** 출장일수(당일 포함, 달력일 기준 — 일비/식비 산정용). Design Ref: mockup calendarDaysBetween() */
export function calendarDaysBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export interface TripReportDueInfo {
  dueKey: string; // YYYY-MM-DD
  daysLeft: number;
  overdue: boolean;
}

/** 시외출장 종료일 + 3일이 결과보고 제출 기한이다(mockup tripReportDueInfo()). */
export function tripReportDueInfo(trip: Pick<BusinessTrip, "endDate">, today: Date = new Date()): TripReportDueInfo {
  const due = new Date(trip.endDate + "T00:00:00");
  due.setDate(due.getDate() + 3);
  const dueKey = due.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  const daysLeft = Math.round((due.getTime() - new Date(todayKey + "T00:00:00").getTime()) / 86400000);
  return { dueKey, daysLeft, overdue: daysLeft < 0 };
}
