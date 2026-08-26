// Design Ref: §3.1 User — 세션 쿠키 기반 인증(외부 BaaS 미사용)
// Next.js 15: cookies()가 비동기이므로 이 파일의 모든 함수는 async다.
import { cookies } from "next/headers";
import { createSession, deleteSession, getSession, getUserById } from "@/lib/data/store";
import type { SessionUser } from "@/types";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

export async function issueSession(userId: string) {
  const session = await createSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    // Secure 쿠키는 HTTPS(또는 localhost)에서만 브라우저가 저장한다. 이 앱은 프로덕션 빌드에서도
    // Docker(docker-compose)로 평문 HTTP(3000 포트)만 서비스하므로 NODE_ENV 기준으로 켜면 다른 PC에서
    // LAN IP(http://<ip>:3000)로 접속 시 로그인 API는 성공(200)해도 쿠키가 저장되지 않아 로그인이
    // 안 되는 것처럼 보인다(같은 PC의 http://localhost는 브라우저가 예외로 봐서 증상이 안 보일 수 있음).
    // 리버스 프록시 등으로 HTTPS를 앞단에 두게 되면 COOKIE_SECURE=true 환경변수로 다시 켠다.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export async function clearSession() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) await deleteSession(sessionId);
  store.delete(SESSION_COOKIE);
}

/** 현재 요청의 로그인 사용자를 조회한다(Server Component / Route Handler 전용). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.employmentStatus === "RESIGNED") return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    departmentId: user.departmentId,
  };
}
