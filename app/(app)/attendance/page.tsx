// Design Ref: §6 화면 흐름 — 출퇴근(조회 전용): 년월 선택(기본 당월), 본인 근태+월간요약.
// 관리자를 포함해 누구나 본인 근태만 조회한다(타 직원 조회 기능 제거 — 사용자 요청).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AttendanceClient from "./client";

export default async function AttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AttendanceClient />;
}
