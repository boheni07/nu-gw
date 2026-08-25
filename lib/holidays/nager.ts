// Design Ref: 회사 기본정보 §공휴일 지정 — 연도별 법정공휴일 자동 가져오기.
// Nager.Date(date.nager.at) 공개 API(무료, 키 불필요)에서 대한민국(KR) 공휴일을 조회한다.
// 대체공휴일을 포함해 정부 지정 공휴일을 그대로 반환하며, localName이 한국어 명칭이라 별도 번역이 필요 없다.

export interface FetchedHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export class HolidayFetchError extends Error {}

export async function fetchPublicHolidays(year: number): Promise<FetchedHoliday[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new HolidayFetchError(`공휴일 정보를 가져오지 못했습니다. (status ${res.status})`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new HolidayFetchError("공휴일 정보 형식이 올바르지 않습니다.");
    return data.map((item: { date: string; localName: string; name: string }) => ({
      date: item.date,
      name: item.localName || item.name,
    }));
  } catch (err) {
    if (err instanceof HolidayFetchError) throw err;
    throw new HolidayFetchError("공휴일 정보를 가져오는 중 오류가 발생했습니다(외부 API 연결 실패). 잠시 후 다시 시도해주세요.");
  } finally {
    clearTimeout(timeout);
  }
}
