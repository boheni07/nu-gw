// Design Ref: §4.2 결재 처리 흐름 (공통 엔진) — module-2
// 연차(module-3)/일일보고(module-6)/주간보고(module-7) 등 이후 모든 문서 모듈이
// 이 파일의 함수만 호출하면 되도록 설계한다(문서별로 결재 로직을 재구현하지 않음).
import {
  addApprovalStepLog,
  createApprovalRecord,
  createNotification,
  getActiveApprovalLine,
  getApproval,
  getUserById,
  listActiveDelegateUserIds,
  listActiveDelegatorsForToday,
  listApprovalsBySubmitter,
  listApprovalStepLogs,
  listApprovalStepLogsByActor,
  updateApprovalRecord,
} from "@/lib/data/store";
import { sendSlackNotification } from "@/lib/integrations/slack";
import type { Approval, ApprovalStepLog, ApprovalStepSnapshot, DocumentType } from "@/types";

// Design Ref: §3.6 알림 — 결재 이벤트(상신/승인/반려) 발생 시 관련자에게 알림을 남긴다(module-8).
// TRIP은 "…신청이 승인되었습니다" 알림 문구에 이어붙였을 때 "출장신청 신청이"처럼 중복되지 않도록
// UI 라벨("출장신청")과 달리 여기서는 "출장"만 사용한다.
const DOC_LABEL: Record<DocumentType, string> = {
  LEAVE: "연차",
  DAILY_REPORT: "일일업무보고",
  WEEKLY_REPORT: "주간업무보고",
  OVERTIME: "초과근무",
  TRIP: "출장",
  TRIP_REPORT: "출장결과보고",
};

/**
 * §4.3(module-10) 대결자 알림 확장 — 원 승인자뿐 아니라, 오늘 기준 그 승인자를 대신하기로 된
 * 대결자에게도 동일 이벤트를 알린다. 대결자가 스스로 결재함에 들어가 확인하지 않아도
 * 처리할 건이 생겼음을 알 수 있어야 위임이 실효성을 갖는다.
 */
async function notifySubmitted(approval: Approval, approverUserIds: string[]) {
  const submitter = await getUserById(approval.submitterId);
  const submitterName = submitter?.name ?? "신청자";
  const todayKey = new Date().toISOString().slice(0, 10);

  for (const approverId of approverUserIds) {
    const approver = await getUserById(approverId);
    const approverName = approver?.name ?? "승인자";
    await createNotification({
      userId: approverId,
      type: "SUBMITTED",
      targetType: approval.targetType,
      targetId: approval.targetId,
      message: `${submitterName}님의 ${DOC_LABEL[approval.targetType]} 결재 요청이 도착했습니다.`,
    });

    for (const delegateId of await listActiveDelegateUserIds(approverId, todayKey)) {
      await createNotification({
        userId: delegateId,
        type: "SUBMITTED",
        targetType: approval.targetType,
        targetId: approval.targetId,
        message: `${approverName}님을 대신해 처리할 ${DOC_LABEL[approval.targetType]} 결재 건이 있습니다.`,
      });
    }
  }

  // Design Ref: §4.2(module-11) — 앱 알림과 별개로 Slack에도 1건만 병행 전송(대결자별 중복 전송 안 함).
  void sendSlackNotification(`[nuGW] ${submitterName}님의 ${DOC_LABEL[approval.targetType]} 결재 요청이 도착했습니다.`);
}

async function notifySubmitterResult(approval: Approval, approved: boolean) {
  await createNotification({
    userId: approval.submitterId,
    type: approved ? "APPROVED" : "REJECTED",
    targetType: approval.targetType,
    targetId: approval.targetId,
    message: `${DOC_LABEL[approval.targetType]} 신청이 ${approved ? "승인" : "반려"}되었습니다.`,
  });

  // Design Ref: §4.2(module-11) — Slack 병행 전송(fire-and-forget, 실패해도 결재 처리에 영향 없음).
  void sendSlackNotification(
    `[nuGW] ${DOC_LABEL[approval.targetType]} 신청이 ${approved ? "승인" : "반려"}되었습니다.`
  );
}

export class ApprovalEngineError extends Error {
  constructor(
    message: string,
    public code:
      | "NO_APPROVAL_LINE"
      | "NOT_FOUND"
      | "NOT_PENDING"
      | "NOT_APPROVER"
      | "ALREADY_PROCESSED"
      | "NOT_RECALLABLE" = "NOT_FOUND"
  ) {
    super(message);
    this.name = "ApprovalEngineError";
  }
}

/** 동일 stepOrder를 공유하는 병렬 승인자 그룹을 반환한다(§3.2 isParallel). */
function getStepGroup(approval: Approval, stepOrder: number): ApprovalStepSnapshot[] {
  return approval.steps.filter((s) => s.stepOrder === stepOrder);
}

/**
 * 문서(연차/일보/주보)를 상신한다.
 * §4.2-1: 사용자의 소속 부서 + 문서유형으로 활성 ApprovalLine 조회 → 스냅샷으로 Approval 생성.
 */
export async function submitForApproval(params: {
  targetType: DocumentType;
  targetId: string;
  submitterId: string;
  departmentId: string;
  targetVersion: number;
}): Promise<Approval> {
  const line = await getActiveApprovalLine(params.departmentId, params.targetType);
  if (!line || line.steps.length === 0) {
    throw new ApprovalEngineError(
      "해당 부서·문서유형에 설정된 결재선이 없습니다. 관리자에게 결재선 설정을 요청하세요.",
      "NO_APPROVAL_LINE"
    );
  }

  const approval = await createApprovalRecord({
    targetType: params.targetType,
    targetId: params.targetId,
    approvalLineId: line.id,
    steps: line.steps.map((s) => ({ stepOrder: s.stepOrder, approverUserId: s.approverUserId, isParallel: s.isParallel })),
    currentStep: 1,
    status: "PENDING",
    submitterId: params.submitterId,
    targetVersion: params.targetVersion,
  });

  await notifySubmitted(approval, getStepGroup(approval, 1).map((s) => s.approverUserId));

  return approval;
}

/** effectiveApproverId가 현재 단계의 승인자 그룹(병렬 포함)에 속하는지 검증한다. */
function assertIsApproverForCurrentStep(approval: Approval, effectiveApproverId: string) {
  const group = getStepGroup(approval, approval.currentStep);
  if (group.length === 0) throw new ApprovalEngineError("현재 단계 정보를 찾을 수 없습니다.", "NOT_FOUND");
  if (!group.some((s) => s.approverUserId === effectiveApproverId)) {
    throw new ApprovalEngineError("해당 결재 건의 처리 권한이 없습니다.", "NOT_APPROVER");
  }
}

/** 현재 단계에서 effectiveApproverId가 이미 승인 처리를 마쳤는지 확인한다(병렬 단계 중복 처리 방지). */
async function hasAlreadyApprovedCurrentStep(approvalId: string, stepOrder: number, effectiveApproverId: string): Promise<boolean> {
  const logs = await listApprovalStepLogs(approvalId);
  return logs.some((log) => log.stepOrder === stepOrder && log.representedUserId === effectiveApproverId && log.action !== "REJECT");
}

/** 현재 단계 승인자 그룹 전원이 승인을 완료했는지 확인한다(§3.2 병렬 승인). */
async function isCurrentStepComplete(approval: Approval): Promise<boolean> {
  const group = getStepGroup(approval, approval.currentStep);
  const logs = await listApprovalStepLogs(approval.id);
  const approvedBy = new Set(
    logs.filter((log) => log.stepOrder === approval.currentStep && log.action !== "REJECT").map((log) => log.representedUserId)
  );
  return group.every((s) => approvedBy.has(s.approverUserId));
}

/**
 * §4.2-3: 승인 처리. 현재 단계의 승인자 그룹 전원이 승인해야 다음 단계로 이동한다(병렬 승인, §3.2).
 * 마지막 단계이고 그룹 전원 승인 완료 시 APPROVED.
 * @param actorApproverId 실제 로그인한 사용자(대결자일 수 있음)
 * @param onBehalfOfUserId 대결인 경우 원 승인자 id(§3.2 DelegateAssignment). 본인 처리면 actorApproverId와 동일하게 넘긴다.
 */
export async function approveCurrentStep(
  approvalId: string,
  actorApproverId: string,
  onBehalfOfUserId: string,
  comment: string | null
): Promise<Approval> {
  const approval = await getApproval(approvalId);
  if (!approval) throw new ApprovalEngineError("결재 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (approval.status !== "PENDING") throw new ApprovalEngineError("이미 처리가 완료된 건입니다.", "NOT_PENDING");

  assertIsApproverForCurrentStep(approval, onBehalfOfUserId);
  if (await hasAlreadyApprovedCurrentStep(approvalId, approval.currentStep, onBehalfOfUserId)) {
    throw new ApprovalEngineError("이미 처리했습니다. 다른 승인자의 처리를 기다리고 있습니다.", "ALREADY_PROCESSED");
  }

  await addApprovalStepLog({
    approvalId,
    stepOrder: approval.currentStep,
    approverUserId: actorApproverId,
    representedUserId: onBehalfOfUserId,
    action: onBehalfOfUserId === actorApproverId ? "APPROVE" : "DELEGATE",
    comment,
  });

  // 병렬 승인 그룹이면 전원 승인 전까지는 단계를 이동하지 않는다(§3.2).
  if (!(await isCurrentStepComplete(approval))) {
    return (await getApproval(approvalId))!;
  }

  const isLastStep = approval.currentStep >= Math.max(...approval.steps.map((s) => s.stepOrder));
  if (isLastStep) {
    const updated = (await updateApprovalRecord(approvalId, { status: "APPROVED", completedAt: new Date().toISOString() }))!;
    await notifySubmitterResult(updated, true);
    return updated;
  }
  const updated = (await updateApprovalRecord(approvalId, { currentStep: approval.currentStep + 1 }))!;
  await notifySubmitted(updated, getStepGroup(updated, updated.currentStep).map((s) => s.approverUserId));
  return updated;
}

/** §4.2-4: 반려. 그룹 내 누구든 반려하면 즉시 REJECTED로 종료된다(병렬 승인 대기 여부와 무관). */
export async function rejectCurrentStep(
  approvalId: string,
  actorApproverId: string,
  onBehalfOfUserId: string,
  comment: string | null
): Promise<Approval> {
  const approval = await getApproval(approvalId);
  if (!approval) throw new ApprovalEngineError("결재 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (approval.status !== "PENDING") throw new ApprovalEngineError("이미 처리가 완료된 건입니다.", "NOT_PENDING");

  assertIsApproverForCurrentStep(approval, onBehalfOfUserId);

  await addApprovalStepLog({
    approvalId,
    stepOrder: approval.currentStep,
    approverUserId: actorApproverId,
    representedUserId: onBehalfOfUserId,
    action: "REJECT",
    comment,
  });

  const updated = (await updateApprovalRecord(approvalId, { status: "REJECTED", completedAt: new Date().toISOString() }))!;
  await notifySubmitterResult(updated, false);
  return updated;
}

/**
 * §4.2-5 / §4.7: 회수(RECALLED). currentStep=1 && 처리 이력 없음 상태에서만 신청자 본인이 실행 가능.
 * 신청자 검증(submitterId === requesterId)은 문서 모듈(연차 등)에서 신청 소유권을 이미 알고 있으므로 그쪽에서도 재검증하는 것을 권장한다.
 */
export async function recallApproval(approvalId: string, requesterId: string): Promise<Approval> {
  const approval = await getApproval(approvalId);
  if (!approval) throw new ApprovalEngineError("결재 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (approval.submitterId !== requesterId) {
    throw new ApprovalEngineError("본인이 상신한 건만 회수할 수 있습니다.", "NOT_APPROVER");
  }
  if (approval.status !== "PENDING" || approval.currentStep !== 1) {
    throw new ApprovalEngineError("이미 결재가 진행된 건은 회수할 수 없습니다.", "NOT_RECALLABLE");
  }
  const logs = await listApprovalStepLogs(approvalId);
  if (logs.length > 0) {
    throw new ApprovalEngineError("이미 결재가 진행된 건은 회수할 수 없습니다.", "NOT_RECALLABLE");
  }
  return (await updateApprovalRecord(approvalId, { status: "RECALLED", completedAt: new Date().toISOString() }))!;
}

export async function getApprovalHistory(approvalId: string): Promise<ApprovalStepLog[]> {
  return listApprovalStepLogs(approvalId);
}

/**
 * 로그인한 사용자가 현재 단계의 승인자 그룹(병렬 포함) 본인인지, 대결자(§3.2 DelegateAssignment)로서 처리하는지 판별한다.
 * 이미 본인이 승인 처리를 마친 경우(공동 승인자 중 한 명이 재조회하는 경우)에도 그룹 멤버이므로 true를 반환하되,
 * 실제 승인 시도는 approveCurrentStep에서 중복 처리로 차단된다.
 * 본인/대결자 모두 아니면 null을 반환한다(호출부에서 403 처리).
 */
export async function resolveOnBehalfOfUserId(approval: Approval, actorId: string): Promise<string | null> {
  const group = getStepGroup(approval, approval.currentStep);
  if (group.length === 0) return null;
  if (group.some((s) => s.approverUserId === actorId)) return actorId;
  const delegators = await listActiveDelegatorsForToday(actorId);
  const represented = group.find((s) => delegators.includes(s.approverUserId));
  return represented ? represented.approverUserId : null;
}

export interface ApprovalReportRow {
  documentType: string;
  targetId: string;
  role: "상신" | "처리";
  status: string;
  date: string;
  delegated: boolean;
}

const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", RECALLED: "회수" };

/** module-10 §4.2 리포트 — 결재 이력. mode="submitted"면 본인이 상신한 건, "processed"면 본인이 처리(대결 포함)한 건. */
export async function buildApprovalReportRows(userId: string, mode: "submitted" | "processed"): Promise<ApprovalReportRow[]> {
  if (mode === "submitted") {
    const rows = await listApprovalsBySubmitter(userId);
    return rows.map((a) => ({
      documentType: DOC_LABEL[a.targetType],
      targetId: a.targetId,
      role: "상신" as const,
      status: STATUS_LABEL[a.status] ?? a.status,
      date: a.submittedAt.slice(0, 10),
      delegated: false,
    }));
  }
  const logs = await listApprovalStepLogsByActor(userId);
  const rows: ApprovalReportRow[] = [];
  for (const log of logs) {
    const approval = await getApproval(log.approvalId);
    rows.push({
      documentType: approval ? DOC_LABEL[approval.targetType] : "-",
      targetId: approval?.targetId ?? "-",
      role: "처리",
      status: log.action === "REJECT" ? "반려" : "승인",
      date: log.processedAt.slice(0, 10),
      delegated: log.representedUserId !== log.approverUserId,
    });
  }
  return rows;
}
