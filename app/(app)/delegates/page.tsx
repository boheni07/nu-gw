// Design Ref: §3.2 DelegateAssignment — 승인권자 부재 시 대결자 지정
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { listDelegateAssignments, listUsers } from "@/lib/data/store";
import DelegatesClient from "./client";

export default async function DelegatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "APPROVER")) redirect("/dashboard");

  const assignments = await listDelegateAssignments(user.id);
  const users = (await listUsers()).filter((u) => u.id !== user.id && u.employmentStatus === "ACTIVE");

  return <DelegatesClient initial={assignments} users={users} />;
}
