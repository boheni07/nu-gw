// Design Ref: §7 권한(RBAC) 설계
import type { SessionUser, UserRole } from "@/types";

const ROLE_RANK: Record<UserRole, number> = {
  MEMBER: 0,
  APPROVER: 1,
  ADMIN: 2,
};

/** user.role이 required 이상의 권한을 갖는지 확인한다(권한은 상위 호환). */
export function hasRole(user: SessionUser | null, required: UserRole): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[required];
}

export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, "ADMIN");
}
