// Design Ref: §7 RBAC — 1차 게이트(비로그인 차단). 세부 역할 검증은 각 레이아웃(Node 런타임)에서 수행한다.
// 미들웨어는 Edge 런타임이라 로컬 파일 저장소(fs)에 접근할 수 없으므로, 여기서는 쿠키 존재 여부만 확인한다.
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/approvals",
  "/delegates",
  "/leave",
  "/calendar",
  "/attendance",
  "/overtime",
  "/business-trip",
  "/trip-report",
  "/daily-reports",
  "/weekly-reports",
  "/hr-record",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/approvals/:path*",
    "/delegates/:path*",
    "/leave/:path*",
    "/calendar/:path*",
    "/attendance/:path*",
    "/overtime/:path*",
    "/business-trip/:path*",
    "/trip-report/:path*",
    "/daily-reports/:path*",
    "/weekly-reports/:path*",
    "/hr-record/:path*",
  ],
};
