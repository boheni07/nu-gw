// Design Ref: §4.6 출퇴근 체크 사내망 제한(module-22) — 요청 헤더에서 클라이언트 IP를 뽑고,
// 회사 기본정보에 등록된 허용 IP 대역(CIDR/단일 IP, 쉼표 구분)과 비교한다.
// 이 앱은 리버스 프록시(nginx, docker-compose 참고) 뒤에서 실행되며, 프록시가 X-Real-IP/
// X-Forwarded-For 헤더에 실제 클라이언트 IP를 채워준다(Next.js Route Handler는 raw socket에 접근할 수 없음).

/** IPv4 문자열 → 32비트 정수. 유효하지 않으면 null. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

/** "1.2.3.4" 또는 "1.2.3.0/24" 형태 하나를 파싱한다. */
function parseRange(entry: string): { base: number; mask: number } | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  const [addr, prefixStr] = trimmed.split("/");
  const base = ipv4ToInt(addr);
  if (base === null) return null;
  const prefix = prefixStr !== undefined ? Number(prefixStr) : 32;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { base: base & mask, mask };
}

/**
 * 요청 헤더에서 클라이언트 IP를 추출한다. X-Forwarded-For는 "client, proxy1, proxy2..." 순이므로 첫 값을 쓴다.
 * 프록시가 없으면(X-Forwarded-For/X-Real-IP 모두 없으면) null — 이 경우 호출측에서 "확인 불가"로 처리한다.
 */
export function extractClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

/**
 * ip가 rangesCsv(쉼표 구분 CIDR/단일 IP 목록)에 포함되는지 확인한다.
 * rangesCsv가 비어 있으면(공백만 있어도) 제한 없음으로 간주해 항상 true를 반환한다.
 * IPv6는 지원하지 않는다(사내망은 대개 IPv4) — IPv6 주소가 들어오면 false 처리한다.
 */
export function isIpAllowed(ip: string | null, rangesCsv: string): boolean {
  const ranges = rangesCsv
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (ranges.length === 0) return true; // 제한 설정 안 함 = 어디서든 허용

  if (!ip) return false;
  // "::ffff:192.168.0.1" 같은 IPv4-mapped IPv6 표기 정리
  const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const ipInt = ipv4ToInt(normalized);
  if (ipInt === null) return false;

  return ranges.some((entry) => {
    const range = parseRange(entry);
    if (!range) return false;
    return (ipInt & range.mask) === range.base;
  });
}
