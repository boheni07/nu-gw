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
    secure: process.env.NODE_ENV === "production",
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
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
  };
}
