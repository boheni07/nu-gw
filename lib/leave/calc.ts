// Design Ref: §4.1 연차 산정 로직 — 순수 계산 함수(부수효과 없음, 테스트 용이)
import type { CompanySettings, LeaveBasis, LeavePolicy } from "@/types";

/**
 * 연차산정기준 — module-20부터 부서별 오버라이드를 제거하고 전사 공통 기준(연차정책 설정 화면에서 관리)만 사용한다.
 */
export function resolveLeaveBasis(company: CompanySettings): LeaveBasis {
  return company.defaultLeaveBasis;
}

/** asOfDate 기준 근속연수(소수, 만 년수)를 계산한다. */
export function serviceYears(hireDate: string, asOfDate: string): number {
  const hire = new Date(hireDate + "T00:00:00");
  const asOf = new Date(asOfDate + "T00:00:00");
  const ms = asOf.getTime() - hire.getTime();
  if (ms < 0) return 0;
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/** 근속연수에 해당하는 정책 구간(발생일수)을 찾는다. 최고 구간을 초과해도 최고 구간을 적용한다(구간표는 회사 정책값). */
export function matchLeavePolicy(years: number, policies: LeavePolicy[]): LeavePolicy | undefined {
  const sorted = [...policies].sort((a, b) => a.minYears - b.minYears);
  let matched: LeavePolicy | undefined;
  for (const p of sorted) {
    if (years >= p.minYears) matched = p;
  }
  return matched;
}

/**
 * §4.1 회계연도 기준 발생일수 계산.
 * - periodYear 이전에 이미 입사한 사람: 정책 발생일수 그대로.
 * - periodYear 중도 입사자: 입사월부터 12월까지 잔여 개월 수 비례로 월할 계산.
 */
export function calcFiscalYearGrant(hireDate: string, periodYear: number, policies: LeavePolicy[]): number {
  const hire = new Date(hireDate + "T00:00:00");
  const hireYear = hire.getFullYear();
  const asOf = `${periodYear}-01-01`;
  const years = serviceYears(hireDate, asOf);
  const policy = matchLeavePolicy(Math.max(years, 0), policies);
  if (!policy) return 0;

  if (hireYear < periodYear) return policy.grantDays;
  if (hireYear > periodYear) return 0; // 아직 입사 전

  // 중도 입사 — 입사월부터 12월까지 개월 수 비례(월할)
  const remainingMonths = 12 - (hire.getMonth() + 1) + 1; // 입사월 포함
  const prorated = Math.round(((policy.grantDays * remainingMonths) / 12) * 10) / 10;
  return prorated;
}

/** §4.1 입사일 기준 발생일수 계산 — 사용자 입사 응당일마다 갱신, 근속연수 그대로 구간 매칭(월할 없음). */
export function calcHireDateGrant(hireDate: string, asOfDate: string, policies: LeavePolicy[]): number {
  const years = serviceYears(hireDate, asOfDate);
  const policy = matchLeavePolicy(years, policies);
  return policy?.grantDays ?? 0;
}

/** DAY_RANGE(연차(일)/특별휴가/공가) — 근무일수(주말 제외) 계산 */
export function businessDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlapMinutes(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(toMinutes(aStart), toMinutes(bStart));
  const end = Math.min(toMinutes(aEnd), toMinutes(bEnd));
  return Math.max(0, end - start);
}

export interface HourlyLeaveCalcInput {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  lunchStart: string;
  lunchEnd: string;
  unitHours: number;
  maxHours: number;
  standardWorkHoursPerDay: number;
}

export interface HourlyLeaveCalcResult {
  usedHours: number;
  days: number;
}

export class HourlyLeaveValidationError extends Error {}

/**
 * §4.1 HOUR_RANGE(연차(시간)) 계산.
 * 1) rawHours = end - start
 * 2) 점심시간과 겹치는 구간 자동 제외
 * 3) usedHours가 unitHours의 배수가 아니거나 maxHours 초과 시 상신 자체를 차단
 * 4) days = usedHours / standardWorkHoursPerDay (일 단위로 환산)
 */
export function calcHourlyLeave(input: HourlyLeaveCalcInput): HourlyLeaveCalcResult {
  const startMin = toMinutes(input.startTime);
  const endMin = toMinutes(input.endTime);
  if (endMin <= startMin) {
    throw new HourlyLeaveValidationError("종료시간은 시작시간보다 늦어야 합니다.");
  }
  const rawMinutes = endMin - startMin;
  const overlap = overlapMinutes(input.startTime, input.endTime, input.lunchStart, input.lunchEnd);
  const usedHours = (rawMinutes - overlap) / 60;

  if (usedHours <= 0) {
    throw new HourlyLeaveValidationError("점심시간을 제외하면 신청 가능한 시간이 없습니다.");
  }
  const remainder = Math.round((usedHours % input.unitHours) * 100) / 100;
  if (remainder !== 0) {
    throw new HourlyLeaveValidationError(`연차(시간)은 ${input.unitHours}시간 단위로만 신청할 수 있습니다.`);
  }
  if (usedHours > input.maxHours) {
    throw new HourlyLeaveValidationError(
      `연차(시간)은 1회 최대 ${input.maxHours}시간까지 신청할 수 있습니다. 그 이상은 연차(일)로 신청해주세요.`
    );
  }

  const days = Math.round((usedHours / input.standardWorkHoursPerDay) * 100) / 100;
  return { usedHours, days };
}

// ---------------------------------------------------------------------------
// Design Ref: module-19 §연차(시간) 시작/신청시간 선택형 UI — 09:00~18:00 근무시간(§4.6 퇴근 기준과 동일한
// 고정값, 회사 기본정보에 별도 출퇴근시간 설정 필드가 없음) 안에서 실제로 신청 가능한 조합만 select로 제공한다.
// ---------------------------------------------------------------------------

const WORKDAY_START_MIN = 9 * 60;
const WORKDAY_END_MIN = 18 * 60;

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type HourlyRateFields = Pick<CompanySettings, "lunchStart" | "lunchEnd" | "hourlyLeaveUnitHours" | "hourlyLeaveMaxHours" | "standardWorkHoursPerDay">;

export interface HourlyDurationOption {
  /** 실제 차감되는 시간(점심시간 제외 반영, calcHourlyLeave와 동일 규칙) */
  hours: number;
  endTime: string;
}

/**
 * 시작시간 기준으로 선택 가능한 "신청 시간"(단위시간 배수) 옵션을 계산한다.
 * 18:00을 넘지 않는 범위에서 30분 간격으로 후보 종료시간을 훑어 calcHourlyLeave로 실제 검증하고,
 * 유효한 시간(usedHours)마다 가장 이른 종료시간 1개씩만 남긴다.
 */
export function listHourlyDurationOptions(startTime: string, company: HourlyRateFields): HourlyDurationOption[] {
  const results: HourlyDurationOption[] = [];
  const seen = new Set<number>();
  const startMin = toMinutes(startTime);
  for (let endMin = startMin + 30; endMin <= WORKDAY_END_MIN; endMin += 30) {
    const endTime = minutesToHHMM(endMin);
    try {
      const { usedHours } = calcHourlyLeave({
        startTime,
        endTime,
        lunchStart: company.lunchStart,
        lunchEnd: company.lunchEnd,
        unitHours: company.hourlyLeaveUnitHours,
        maxHours: company.hourlyLeaveMaxHours,
        standardWorkHoursPerDay: company.standardWorkHoursPerDay,
      });
      if (!seen.has(usedHours)) {
        seen.add(usedHours);
        results.push({ hours: usedHours, endTime });
      }
    } catch {
      // 유효하지 않은 조합(단위시간 배수 아님 등)은 건너뛴다.
    }
  }
  return results.sort((a, b) => a.hours - b.hours);
}

/** 09:00~(18:00-단위시간) 범위에서 1시간 단위 시작시간 후보 중, 최소 1개 이상의 유효 신청시간이 있는 것만 반환한다. */
export function listHourlyStartTimeOptions(company: HourlyRateFields): string[] {
  const options: string[] = [];
  for (let m = WORKDAY_START_MIN; m + company.hourlyLeaveUnitHours * 60 <= WORKDAY_END_MIN; m += 60) {
    const startTime = minutesToHHMM(m);
    if (listHourlyDurationOptions(startTime, company).length > 0) {
      options.push(startTime);
    }
  }
  return options;
}
