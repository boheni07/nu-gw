// Design Ref: §6 화면 흐름 — 캘린더(전사 통합, 승인된 휴가 자동 표시 + 사내 일정 등록)
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { listDepartments } from "@/lib/data/store";
import CalendarClient from "./client";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const departments = await listDepartments();

  return (
    <div className="stack">
      <CalendarClient departments={departments} currentUserId={user.id} isAdmin={isAdmin(user)} />
    </div>
  );
}
