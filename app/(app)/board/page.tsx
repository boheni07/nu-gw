// Design Ref: module-23 사내게시판 — 누구나 글을 올릴 수 있고, 공지로 체크한 글은 목록 상단에 항상 고정 노출된다.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import BoardClient from "./client";

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <BoardClient currentUserId={user.id} isAdmin={isAdmin(user)} />;
}
