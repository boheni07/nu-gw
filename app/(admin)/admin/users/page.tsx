// Design Ref: mockup/pages/index.html renderAdminUsersScreen() — 카드 래핑 + 사용자 목록 구조로 정리(module-12)
// §2.5 사용자 관리, §6 화면 흐름 — 사용자 목록/검색 → 부서·직급·역할 배정, 퇴사 처리
import { listDepartments, listUsers } from "@/lib/data/store";
import UsersClient from "./users-client";

export default async function UsersPage() {
  const users = await listUsers();
  const departments = await listDepartments();
  return <UsersClient initialUsers={users} departments={departments} />;
}
