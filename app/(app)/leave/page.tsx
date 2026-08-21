// Design Ref: §6 화면 흐름 — 연차 신청 화면(유형 선택 → 기간 입력 → 카테고리별 분기 → 상신) + 내역
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCompanySettings, listLeaveRequestsByUser, listLeaveTypeConfigs } from "@/lib/data/store";
import { getOrCreateLeaveBalance, listAttachments } from "@/lib/leave/service";
import LeaveClient from "./client";

export default async function LeavePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const periodYear = new Date().getFullYear();
  const balance = await getOrCreateLeaveBalance(user.id, periodYear);
  const leaveTypes = await listLeaveTypeConfigs();
  const company = await getCompanySettings();
  const requests = await listLeaveRequestsByUser(user.id);
  const history = await Promise.all(requests.map(async (r) => ({ ...r, attachments: await listAttachments(r.id) })));

  return (
    <div className="stack">
      <LeaveClient
        leaveTypes={leaveTypes}
        company={company}
        balance={balance}
        periodYear={periodYear}
        initialHistory={history}
      />
    </div>
  );
}
