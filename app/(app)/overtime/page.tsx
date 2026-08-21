// Design Ref: §6 화면 흐름 — 초과근무 신청 / 신청 내역
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listOvertimeRequestsByUser } from "@/lib/data/store";
import OvertimeClient from "./client";

export default async function OvertimePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = await listOvertimeRequestsByUser(user.id);

  return <OvertimeClient initialHistory={history} />;
}
