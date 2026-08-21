// Design Ref: §6 화면 흐름 — 주간업무보고 작성(일보 자동 집계) / 목록
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listWeeklyReportsByUser } from "@/lib/data/store";
import WeeklyReportClient from "./client";

export default async function WeeklyReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = await listWeeklyReportsByUser(user.id);

  return <WeeklyReportClient initialHistory={history} />;
}
