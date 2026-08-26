// Edge 런타임(middleware.ts)과 Node 런타임(session.ts) 양쪽에서 공유하는 상수.
// fs를 사용하는 lib/data/store를 절대 여기서 import하지 않는다(Edge에서 빌드 실패).
export const SESSION_COOKIE = "nugw_session";

/**
 * module-17 총괄관리자 — DB를 초기화해도 항상 시드로 복원되는 최상위 관리자 계정(lib/data/seed.json).
 * 다른 관리자가 실수로 삭제·강등·퇴사 처리하지 못하도록 이 아이디를 특별 보호 대상으로 취급한다.
 */
export const MASTER_ADMIN_USERNAME = "master";
