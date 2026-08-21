// module-6/7 등에서 공용으로 쓰는 날짜 유틸(순수 함수)

/** 주어진 날짜의 직전 영업일(주말 제외)을 YYYY-MM-DD로 반환한다. Design Ref: §4.3 */
export function previousBusinessDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isWeekend(dateStr: string): boolean {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}
