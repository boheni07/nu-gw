// Design Ref: 표준 입력항목(전화번호/금액) 실시간 자동변환 — module-16
// 순수 포맷팅 함수만 모아둔다(store.ts를 거치지 않으므로 클라이언트 컴포넌트에서 바로 import 가능).

/**
 * 숫자만 남긴 문자열을 한국 전화번호 표시형식으로 변환한다.
 * - 서울(02): 02-000-0000(9자리) / 02-0000-0000(10자리)
 * - 휴대폰/그 외 지역번호(010, 031~064, 070 등): 000-000-0000(10자리) / 000-0000-0000(11자리)
 * 입력 중에도(자릿수가 덜 찼을 때도) 자연스럽게 하이픈이 붙도록 길이별로 분기한다.
 */
export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;

  if (digits.startsWith("02")) {
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

/** 숫자만 남긴 문자열에 천단위 콤마를 붙인다(예: "1234567" → "1,234,567"). */
export function formatWithCommas(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

/** 콤마 등 숫자가 아닌 문자를 제거하고 number로 변환한다(빈 값이면 0). */
export function parseFormattedNumber(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/**
 * 숫자만 남긴 문자열을 YYYY-MM-DD 형식으로 변환한다(연도 4자리 고정).
 * 네이티브 <input type="date">의 표시형식이 OS/브라우저 로캘에 좌우되는 문제(§module-18)를 피하기 위해
 * 값 자체를 항상 YYYY-MM-DD 텍스트로 다루는 입력에 사용한다.
 */
export function formatDateDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
