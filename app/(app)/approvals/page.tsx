// Design Ref: mockup/pages/index.html renderApprovalsScreen()/renderApprovalPanel() — 탭(대기중/처리완료) +
// 유형 필터 + 상세 패널 구조로 정리(module-12 디자인 정합화)
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getApproval,
  getBusinessTrip,
  getDailyReport,
  getLeaveRequest,
  getOvertimeRequest,
  getTripReport,
  getUserById,
  getWeeklyReport,
  listApprovalStepLogsByActor,
  listDepartments,
  listLeaveTypeConfigs,
  listPendingApprovalsForApprover,
} from "@/lib/data/store";
import type { Approval, Department, DocumentType, LeaveTypeConfig } from "@/types";
import ApprovalsClient, { type ApprovalRow } from "./client";

async function buildDetail(
  targetType: DocumentType,
  targetId: string,
  leaveTypes: LeaveTypeConfig[]
): Promise<{ summary: string; fields: { k: string; v: string }[] }> {
  const leaveTypeName = (id: string) => leaveTypes.find((t) => t.id === id)?.name ?? "연차";

  if (targetType === "LEAVE") {
    const r = await getLeaveRequest(targetId);
    if (!r) return { summary: "-", fields: [] };
    const period = r.startTime ? `${r.startDate} ${r.startTime}~${r.endTime}` : `${r.startDate} ~ ${r.endDate}`;
    return {
      summary: `${leaveTypeName(r.leaveTypeId)} · ${period}`,
      fields: [
        { k: "기간", v: period },
        { k: "일수", v: `${r.days}일` },
        { k: "사유", v: r.reason },
      ],
    };
  }
  if (targetType === "DAILY_REPORT") {
    const r = await getDailyReport(targetId);
    if (!r) return { summary: "-", fields: [] };
    return {
      summary: `${r.reportDate} 일일업무보고`,
      fields: [
        { k: "당일 업무실적", v: r.todayResult },
        { k: "다음날 계획", v: r.tomorrowPlan },
        { k: "보고사항", v: r.notes || "-" },
      ],
    };
  }
  if (targetType === "WEEKLY_REPORT") {
    const r = await getWeeklyReport(targetId);
    if (!r) return { summary: "-", fields: [] };
    return {
      summary: `${r.weekStartDate} ~ ${r.weekEndDate} 주간업무보고`,
      fields: [
        { k: "금주 업무실적", v: r.thisWeekResult },
        { k: "차주 업무계획", v: r.nextWeekPlan },
        { k: "보고사항", v: r.notes || "-" },
      ],
    };
  }
  if (targetType === "OVERTIME") {
    const r = await getOvertimeRequest(targetId);
    if (!r) return { summary: "-", fields: [] };
    return {
      summary: `${r.date} 초과근무(~${r.expectedEndTime})`,
      fields: [
        { k: "희망 퇴근시간", v: r.expectedEndTime },
        { k: "업무내용", v: r.workDetail },
        { k: "사유", v: r.reason },
      ],
    };
  }
  if (targetType === "TRIP") {
    const t = await getBusinessTrip(targetId);
    if (!t) return { summary: "-", fields: [] };
    const typeLabel = t.tripType === "OUT_OF_TOWN" ? "시외출장" : "관내출장";
    const period = t.tripType === "OUT_OF_TOWN" ? `${t.startDate} ~ ${t.endDate}` : `${t.startDate} ${t.startTime}~${t.endTime}`;
    return {
      summary: `${typeLabel} · ${t.destination} (${period})`,
      fields: [
        { k: "기간", v: period },
        { k: "출장지", v: t.destination },
        { k: "출장 목적", v: t.purpose },
        ...(t.transport ? [{ k: "교통편(예정)", v: t.transport }] : []),
      ],
    };
  }
  // TRIP_REPORT
  const r = await getTripReport(targetId);
  if (!r) return { summary: "-", fields: [] };
  const trip = await getBusinessTrip(r.tripId);
  const total = r.transportCost + r.lodgingCost + r.dailyAllowance + r.mealAllowance;
  return {
    summary: `출장결과보고 · ${trip?.destination ?? "-"}`,
    fields: [
      { k: "출장업무 처리내용", v: r.workContent },
      { k: "교통편", v: r.transport },
      { k: "교통비", v: `${r.transportCost.toLocaleString()}원` },
      { k: "숙박비", v: r.hasLodging ? `${r.lodgingCost.toLocaleString()}원` : "해당없음" },
      { k: "일비", v: `${r.dailyAllowance.toLocaleString()}원` },
      { k: "식비", v: `${r.mealAllowance.toLocaleString()}원` },
      { k: "합계 청구액", v: `${total.toLocaleString()}원` },
    ],
  };
}

// module-10 수정: MEMBER도 대결자로 지정되면 결재 처리 권한이 API 레벨에서 생기므로(§4.3 대결자 알림 확장),
// 역할 게이트를 제거하고 listPendingApprovalsForApprover의 결과(본인 담당분+대결분)로만 접근을 판단한다.
export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const departments = await listDepartments();
  const leaveTypes = await listLeaveTypeConfigs();
  const deptName = (id: string) => departments.find((d: Department) => d.id === id)?.name ?? "-";

  async function toPendingRow(a: Approval): Promise<ApprovalRow> {
    const submitter = await getUserById(a.submitterId);
    const currentGroup = a.steps.filter((s) => s.stepOrder === a.currentStep);
    const isDelegated = currentGroup.length > 0 && !currentGroup.some((s) => s.approverUserId === user!.id);
    const detail = await buildDetail(a.targetType, a.targetId, leaveTypes);
    return {
      approvalId: a.id,
      targetType: a.targetType,
      submitterName: submitter?.name ?? "알 수 없음",
      departmentName: submitter ? deptName(submitter.departmentId) : "-",
      summary: detail.summary,
      dateLabel: a.submittedAt,
      status: "PENDING",
      awaitingMyAction: true,
      isDelegated,
      comment: null,
      fields: detail.fields,
      stepInfo: `${a.currentStep}/${Math.max(...a.steps.map((s) => s.stepOrder))}단계`,
    };
  }

  const pendingApprovals = await listPendingApprovalsForApprover(user.id);
  const pending = await Promise.all(pendingApprovals.map(toPendingRow));

  const logs = await listApprovalStepLogsByActor(user.id);
  const processedRows: (ApprovalRow | null)[] = await Promise.all(
    logs.map(async (log) => {
      const approval = await getApproval(log.approvalId);
      if (!approval) return null;
      const submitter = await getUserById(approval.submitterId);
      const detail = await buildDetail(approval.targetType, approval.targetId, leaveTypes);
      // 병렬 승인 단계에서는 "내가 승인 버튼을 눌렀다"와 "결재 건 전체가 승인 완료됐다"가 다를 수 있다
      // (다른 병렬 승인자가 아직 처리하지 않았으면 전체 상태는 여전히 PENDING). 로그의 내 행위가 아니라
      // 결재 건의 실제 현재 상태(approval.status)를 그대로 보여줘야 "승인됐는데 캘린더/목록엔 안 보인다" 같은
      // 혼선이 생기지 않는다.
      const totalSteps = Math.max(...approval.steps.map((s) => s.stepOrder));
      const row: ApprovalRow = {
        approvalId: approval.id,
        targetType: approval.targetType,
        submitterName: submitter?.name ?? "알 수 없음",
        departmentName: submitter ? deptName(submitter.departmentId) : "-",
        summary: detail.summary,
        dateLabel: log.processedAt,
        status: approval.status,
        awaitingMyAction: false,
        isDelegated: log.representedUserId !== log.approverUserId,
        comment: log.comment,
        fields: detail.fields,
        stepInfo:
          log.action === "APPROVE" && approval.status === "PENDING"
            ? `내 처리 완료 · 다른 승인자 대기중(${approval.currentStep}/${totalSteps}단계)`
            : null,
      };
      return row;
    })
  );
  const processed: ApprovalRow[] = processedRows.filter((r): r is ApprovalRow => r !== null);

  return (
    <div className="stack">
      <ApprovalsClient pending={pending} processed={processed} />
    </div>
  );
}
