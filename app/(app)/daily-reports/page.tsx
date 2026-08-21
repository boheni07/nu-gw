// Design Ref: §6 화면 흐름 — 일일업무보고 작성 / 목록
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listDailyReportsByUser } from "@/lib/data/store";
import DailyReportClient from "./client";

export default async function DailyReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = await listDailyReportsByUser(user.id);

  return <DailyReportClient initialHistory={history} />;
}
