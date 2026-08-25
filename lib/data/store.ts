// Design Ref: §3.1 회사/조직/사용자 — Postgres(Prisma) 기반 저장소.
// 서버 컴포넌트/Route Handler(Node.js 런타임)에서만 사용한다(브라우저에서 import 금지).
// module-14: 로컬 JSON 파일(db.json) 저장소에서 실제 DB(PostgreSQL)로 교체. 함수 시그니처는 최대한 유지하되
// 모든 함수가 DB I/O를 하므로 async/Promise로 바뀐다 — 호출부는 전부 await가 필요하다.
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/data/prisma";
import type {
  Approval,
  ApprovalLine,
  ApprovalLineStep,
  ApprovalStepLog,
  Attachment,
  AttendanceRecord,
  BusinessTrip,
  CompanySettings,
  DailyReport,
  DelegateAssignment,
  Department,
  DocumentType,
  Event,
  Holiday,
  HrRecord,
  LeaveBalance,
  LeavePolicy,
  LeaveRequest,
  LeaveTypeConfig,
  Notification,
  OvertimeRequest,
  TripAllowanceRate,
  TripReport,
  User,
  WeeklyReport,
} from "@/types";

const SEED_PATH = path.join(process.cwd(), "lib", "data", "seed.json");

interface StoredUser extends User {
  passwordHash: string;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: string; // ISO
}

function cryptoRandomId(): string {
  return randomBytes(24).toString("hex");
}

function undef<T>(v: T | null): T | undefined {
  return v === null ? undefined : v;
}

/**
 * 최초 부팅 시(테이블이 비어있을 때) seed.json을 DB에 1회 적재한다.
 * 이전 db.json 방식의 "파일 없으면 시드 복사" 로직을 대체한다. 이후 재배포에서는 companySettings가
 * 이미 존재하므로 아무 것도 하지 않는다(시드가 런타임 데이터를 덮어쓰지 않음).
 */
let seededPromise: Promise<void> | undefined;
function ensureSeeded(): Promise<void> {
  if (!seededPromise) seededPromise = doSeed();
  return seededPromise;
}

async function doSeed(): Promise<void> {
  const existing = await prisma.companySettings.findFirst();
  if (existing) return;

  const raw = fs.readFileSync(SEED_PATH, "utf-8");
  const seed = JSON.parse(raw) as Record<string, unknown>;

  await prisma.$transaction([
    prisma.companySettings.create({ data: seed.companySettings as never }),
    prisma.tripAllowanceRate.createMany({ data: (seed.tripAllowanceRates as never[]) ?? [] }),
    prisma.department.createMany({ data: (seed.departments as never[]) ?? [] }),
    prisma.user.createMany({ data: (seed.users as never[]) ?? [] }),
    prisma.approvalLine.createMany({ data: (seed.approvalLines as never[]) ?? [] }),
    prisma.approvalLineStep.createMany({ data: (seed.approvalLineSteps as never[]) ?? [] }),
    prisma.leavePolicy.createMany({ data: (seed.leavePolicies as never[]) ?? [] }),
    prisma.leaveTypeConfig.createMany({ data: (seed.leaveTypeConfigs as never[]) ?? [] }),
    prisma.event.createMany({ data: (seed.events as never[]) ?? [] }),
  ]);
}

/* ---------- CompanySettings (시스템 내 1건) ---------- */

export async function getCompanySettings(): Promise<CompanySettings> {
  await ensureSeeded();
  const row = await prisma.companySettings.findFirstOrThrow();
  return row as CompanySettings;
}

export async function updateCompanySettings(patch: Partial<CompanySettings>): Promise<CompanySettings> {
  await ensureSeeded();
  const { id, ...rest } = patch;
  const current = await prisma.companySettings.findFirstOrThrow();
  const updated = await prisma.companySettings.update({ where: { id: current.id }, data: rest });
  return updated as CompanySettings;
}

/* ---------- Department (계층형) ---------- */

export async function listDepartments(): Promise<Department[]> {
  await ensureSeeded();
  return (await prisma.department.findMany()) as Department[];
}

export async function getDepartment(id: string): Promise<Department | undefined> {
  await ensureSeeded();
  return undef(await prisma.department.findUnique({ where: { id } })) as Department | undefined;
}

export async function createDepartment(input: Omit<Department, "id">): Promise<Department> {
  await ensureSeeded();
  return (await prisma.department.create({ data: { id: `dept-${Date.now()}`, ...input } })) as Department;
}

export async function updateDepartment(id: string, patch: Partial<Omit<Department, "id">>): Promise<Department | undefined> {
  await ensureSeeded();
  try {
    return (await prisma.department.update({ where: { id }, data: patch })) as Department;
  } catch {
    return undefined;
  }
}

/**
 * departmentId 자신 + 모든 하위 부서(재귀) id 목록을 반환한다.
 * 결재선 설정에서 "부서 선택 시 하위 부서까지 함께 적용" 옵션에 사용한다.
 */
export function collectDepartmentAndDescendantIds(departmentId: string, allDepartments: Department[]): string[] {
  const ids = [departmentId];
  const children = allDepartments.filter((d) => d.parentId === departmentId);
  for (const child of children) {
    ids.push(...collectDepartmentAndDescendantIds(child.id, allDepartments));
  }
  return ids;
}

/* ---------- TripAllowanceRate (module-20 §출장비 단가 기준연도별 관리) ---------- */

export async function listTripAllowanceRates(): Promise<TripAllowanceRate[]> {
  await ensureSeeded();
  const rows = await prisma.tripAllowanceRate.findMany({ orderBy: { year: "desc" } });
  return rows as TripAllowanceRate[];
}

/** 계산에 사용할 단가 — 등록된 기준연도 중 가장 최근(year 최댓값) 값을 사용한다. */
export async function getLatestTripAllowanceRate(): Promise<TripAllowanceRate | undefined> {
  await ensureSeeded();
  const row = await prisma.tripAllowanceRate.findFirst({ orderBy: { year: "desc" } });
  return undef(row) as TripAllowanceRate | undefined;
}

/** 기준연도별 단가를 등록하거나(같은 연도가 있으면) 수정한다. */
export async function upsertTripAllowanceRate(input: {
  year: number;
  dailyRate: number;
  mealRate: number;
  lodgingCapPerNight: number;
}): Promise<TripAllowanceRate> {
  await ensureSeeded();
  const row = await prisma.tripAllowanceRate.upsert({
    where: { year: input.year },
    update: { dailyRate: input.dailyRate, mealRate: input.mealRate, lodgingCapPerNight: input.lodgingCapPerNight },
    create: { id: `tar-${input.year}-${cryptoRandomId()}`, ...input },
  });
  return row as TripAllowanceRate;
}

export async function deleteTripAllowanceRate(id: string): Promise<boolean> {
  await ensureSeeded();
  try {
    await prisma.tripAllowanceRate.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/* ---------- User ---------- */

export async function listUsers(): Promise<User[]> {
  await ensureSeeded();
  const rows = await prisma.user.findMany();
  return (rows as StoredUser[]).map(stripPassword);
}

export async function getUserById(id: string): Promise<User | undefined> {
  await ensureSeeded();
  const u = await prisma.user.findUnique({ where: { id } });
  return u ? stripPassword(u as StoredUser) : undefined;
}

export async function getUserByEmail(email: string): Promise<StoredUser | undefined> {
  await ensureSeeded();
  // 이메일 대소문자 무관 비교(원본 로직 유지) — Postgres citext 도입 없이 lower() 비교로 재현한다.
  const rows = await prisma.user.findMany();
  return (rows as StoredUser[]).find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(input: Omit<User, "id">, passwordHash: string): Promise<User> {
  await ensureSeeded();
  const created = await prisma.user.create({ data: { id: `user-${Date.now()}`, ...input, passwordHash } });
  return stripPassword(created as StoredUser);
}

export async function updateUser(id: string, patch: Partial<Omit<User, "id">>): Promise<User | undefined> {
  await ensureSeeded();
  try {
    const updated = await prisma.user.update({ where: { id }, data: patch });
    return stripPassword(updated as StoredUser);
  } catch {
    return undefined;
  }
}

/** module-17 §비밀번호 초기화/재설정 — 관리자 강제초기화·본인 셀프 재설정이 공유하는 저수준 업데이트. */
export async function updateUserPasswordHash(id: string, passwordHash: string): Promise<boolean> {
  await ensureSeeded();
  try {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    return true;
  } catch {
    return false;
  }
}

/** 퇴사 처리 — 삭제가 아닌 상태 변경(감사 추적 가능, 비기능요구 §3). 퇴사일자를 함께 기록한다. */
export async function resignUser(id: string, resignedAt: string): Promise<User | undefined> {
  return updateUser(id, { employmentStatus: "RESIGNED", resignedAt });
}

/** 계정 완전 삭제(관리자 전용). 퇴사 처리와 달리 이력이 남지 않으므로 신중히 사용한다. */
export async function deleteUser(id: string): Promise<boolean> {
  await ensureSeeded();
  try {
    await prisma.user.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

function stripPassword(u: StoredUser): User {
  const { passwordHash, ...rest } = u;
  return rest;
}

/* ---------- Session ---------- */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export async function createSession(userId: string): Promise<Session> {
  await ensureSeeded();
  return prisma.session.create({
    data: {
      id: cryptoRandomId(),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    },
  });
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  await ensureSeeded();
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return undefined;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await deleteSession(sessionId);
    return undefined;
  }
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ensureSeeded();
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/* ---------- ApprovalLine / ApprovalLineStep (Design Ref: §3.2) ---------- */

export interface ApprovalLineWithSteps extends ApprovalLine {
  steps: ApprovalLineStep[];
}

function toLineWithSteps(row: {
  id: string;
  departmentId: string;
  documentType: string;
  isActive: boolean;
  steps: { id: string; approvalLineId: string; stepOrder: number; approverUserId: string; isParallel: boolean }[];
}): ApprovalLineWithSteps {
  return { ...row, documentType: row.documentType as DocumentType, steps: row.steps.slice().sort((a, b) => a.stepOrder - b.stepOrder) };
}

export async function listApprovalLines(): Promise<ApprovalLineWithSteps[]> {
  await ensureSeeded();
  const rows = await prisma.approvalLine.findMany({ include: { steps: true } });
  return rows.map(toLineWithSteps);
}

export async function getApprovalLine(id: string): Promise<ApprovalLineWithSteps | undefined> {
  await ensureSeeded();
  const row = await prisma.approvalLine.findUnique({ where: { id }, include: { steps: true } });
  return row ? toLineWithSteps(row) : undefined;
}

/** 부서 × 문서유형에 대해 현재 활성화된 결재선을 조회한다(§4.2 1단계). */
export async function getActiveApprovalLine(departmentId: string, documentType: DocumentType): Promise<ApprovalLineWithSteps | undefined> {
  await ensureSeeded();
  const row = await prisma.approvalLine.findFirst({
    where: { departmentId, documentType, isActive: true },
    include: { steps: true },
  });
  return row ? toLineWithSteps(row) : undefined;
}

/**
 * 결재선을 생성(또는 같은 부서×문서유형의 기존 결재선을 비활성화하고 새로 생성)한다.
 * 이미 상신된 Approval은 스냅샷(steps)을 갖고 있으므로 영향받지 않는다(§3.2).
 */
export async function upsertApprovalLine(
  departmentId: string,
  documentType: DocumentType,
  steps: Array<{ stepOrder: number; approverUserId: string; isParallel: boolean }>
): Promise<ApprovalLineWithSteps> {
  await ensureSeeded();
  // 기존 활성 결재선은 비활성화(이력 보존 목적으로 삭제하지 않음)
  await prisma.approvalLine.updateMany({
    where: { departmentId, documentType, isActive: true },
    data: { isActive: false },
  });

  const sortedSteps = steps.slice().sort((a, b) => a.stepOrder - b.stepOrder);
  const created = await prisma.approvalLine.create({
    data: {
      id: `al-${cryptoRandomId()}`,
      departmentId,
      documentType,
      isActive: true,
      steps: {
        create: sortedSteps.map((s) => ({
          id: `als-${cryptoRandomId()}`,
          stepOrder: s.stepOrder,
          approverUserId: s.approverUserId,
          isParallel: s.isParallel,
        })),
      },
    },
    include: { steps: true },
  });
  return toLineWithSteps(created);
}

/**
 * 여러 부서에 동일한 결재선(steps)을 일괄 적용한다.
 * module-20 §결재선 설정 — "전사" 선택 시 전체 부서, 특정 부서 선택 시 하위 부서까지 함께 적용하는 데 사용한다.
 */
export async function upsertApprovalLineForDepartments(
  departmentIds: string[],
  documentType: DocumentType,
  steps: Array<{ stepOrder: number; approverUserId: string; isParallel: boolean }>
): Promise<ApprovalLineWithSteps[]> {
  const results: ApprovalLineWithSteps[] = [];
  for (const departmentId of departmentIds) {
    results.push(await upsertApprovalLine(departmentId, documentType, steps));
  }
  return results;
}

export async function setApprovalLineActive(id: string, isActive: boolean): Promise<ApprovalLine | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.approvalLine.update({ where: { id }, data: { isActive } });
    return { ...row, documentType: row.documentType as DocumentType };
  } catch {
    return undefined;
  }
}

/* ---------- Approval / ApprovalStepLog (Design Ref: §3.2, §4.2) ---------- */

function toApproval(row: {
  id: string;
  targetType: string;
  targetId: string;
  approvalLineId: string;
  steps: unknown;
  currentStep: number;
  status: string;
  submitterId: string;
  submittedAt: string;
  completedAt: string | null;
  targetVersion: number;
}): Approval {
  return {
    ...row,
    targetType: row.targetType as DocumentType,
    status: row.status as Approval["status"],
    steps: row.steps as Approval["steps"],
    completedAt: undef(row.completedAt) ?? null,
  };
}

export async function getApproval(id: string): Promise<Approval | undefined> {
  await ensureSeeded();
  const row = await prisma.approval.findUnique({ where: { id } });
  return row ? toApproval(row) : undefined;
}

export async function createApprovalRecord(input: Omit<Approval, "id" | "submittedAt" | "completedAt">): Promise<Approval> {
  await ensureSeeded();
  const row = await prisma.approval.create({
    data: {
      id: `ap-${cryptoRandomId()}`,
      ...input,
      steps: input.steps as never,
      submittedAt: new Date().toISOString(),
      completedAt: null,
    },
  });
  return toApproval(row);
}

export async function updateApprovalRecord(id: string, patch: Partial<Approval>): Promise<Approval | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.approval.update({ where: { id }, data: { ...patch, steps: patch.steps as never } });
    return toApproval(row);
  } catch {
    return undefined;
  }
}

/**
 * 특정 사용자가 현재 처리해야 할(본인 승인 또는 대결) PENDING 결재 목록(§5 GET /approvals/pending).
 * 병렬 승인 그룹(§3.2 isParallel)일 경우, 본인이 속한 stepOrder 그룹 중 아직 본인 승인이 기록되지 않은 건만 반환한다
 * (공동 승인자가 먼저 처리한 건은 본인 목록에서 자동으로 빠진다).
 */
export async function listPendingApprovalsForApprover(userId: string): Promise<Approval[]> {
  await ensureSeeded();
  const delegatorIds = await activeDelegatorsFor(userId, todayKey());
  const pending = await prisma.approval.findMany({ where: { status: "PENDING" } });
  const result: Approval[] = [];
  for (const row of pending) {
    const a = toApproval(row);
    const group = a.steps.filter((s) => s.stepOrder === a.currentStep);
    if (group.length === 0) continue;
    const represented = group.find((s) => s.approverUserId === userId || delegatorIds.has(s.approverUserId))?.approverUserId;
    if (!represented) continue;
    const alreadyApproved = await prisma.approvalStepLog.findFirst({
      where: { approvalId: a.id, stepOrder: a.currentStep, representedUserId: represented, action: { not: "REJECT" } },
    });
    if (!alreadyApproved) result.push(a);
  }
  return result;
}

export async function addApprovalStepLog(input: Omit<ApprovalStepLog, "id" | "processedAt">): Promise<ApprovalStepLog> {
  await ensureSeeded();
  const row = await prisma.approvalStepLog.create({
    data: { id: `log-${cryptoRandomId()}`, ...input, processedAt: new Date().toISOString() },
  });
  return { ...row, action: row.action as ApprovalStepLog["action"] };
}

export async function listApprovalStepLogs(approvalId: string): Promise<ApprovalStepLog[]> {
  await ensureSeeded();
  const rows = await prisma.approvalStepLog.findMany({ where: { approvalId }, orderBy: { processedAt: "asc" } });
  return rows.map((r) => ({ ...r, action: r.action as ApprovalStepLog["action"] }));
}

/** userId가 상신자인 결재 건 전체(문서유형 통합) — module-10 리포트 §4.2용 */
export async function listApprovalsBySubmitter(userId: string): Promise<Approval[]> {
  await ensureSeeded();
  const rows = await prisma.approval.findMany({ where: { submitterId: userId }, orderBy: { submittedAt: "desc" } });
  return rows.map(toApproval);
}

/** userId가 실제로 처리(승인/반려, 대결 포함)한 단계 로그 전체 — module-10 리포트 §4.2용 */
export async function listApprovalStepLogsByActor(userId: string): Promise<ApprovalStepLog[]> {
  await ensureSeeded();
  const rows = await prisma.approvalStepLog.findMany({ where: { approverUserId: userId }, orderBy: { processedAt: "desc" } });
  return rows.map((r) => ({ ...r, action: r.action as ApprovalStepLog["action"] }));
}

/* ---------- DelegateAssignment (Design Ref: §3.2 위임/대결) ---------- */

export async function listDelegateAssignments(delegatorUserId: string): Promise<DelegateAssignment[]> {
  await ensureSeeded();
  return prisma.delegateAssignment.findMany({ where: { delegatorUserId } });
}

export async function createDelegateAssignment(input: Omit<DelegateAssignment, "id">): Promise<DelegateAssignment> {
  await ensureSeeded();
  return prisma.delegateAssignment.create({ data: { id: `del-${cryptoRandomId()}`, ...input } });
}

export async function deleteDelegateAssignment(id: string, delegatorUserId: string): Promise<boolean> {
  await ensureSeeded();
  const { count } = await prisma.delegateAssignment.deleteMany({ where: { id, delegatorUserId } });
  return count > 0;
}

/** userId가 오늘 기준 대결자로 지정된 원 승인자(delegator) id 목록을 반환한다(API 라우트에서 사용). */
export async function listActiveDelegatorsForToday(delegateUserId: string): Promise<string[]> {
  await ensureSeeded();
  return Array.from(await activeDelegatorsFor(delegateUserId, todayKey()));
}

/**
 * delegatorUserId(원 승인자)가 dateKey 기준으로 현재 지정해둔 대결자 id 목록을 반환한다.
 * activeDelegatorsFor의 역방향 조회 — module-10 대결자 알림 확장(§4.3)에서 사용.
 */
export async function listActiveDelegateUserIds(delegatorUserId: string, dateKey: string): Promise<string[]> {
  await ensureSeeded();
  const rows = await prisma.delegateAssignment.findMany({
    where: { delegatorUserId, startDate: { lte: dateKey }, endDate: { gte: dateKey } },
  });
  return rows.map((d) => d.delegateUserId);
}

/** userId가 오늘 기준 대결자로 지정된 원 승인자(delegator) id 집합을 반환한다. */
async function activeDelegatorsFor(delegateUserId: string, dateKey: string): Promise<Set<string>> {
  const rows = await prisma.delegateAssignment.findMany({
    where: { delegateUserId, startDate: { lte: dateKey }, endDate: { gte: dateKey } },
  });
  return new Set(rows.map((d) => d.delegatorUserId));
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- LeavePolicy / LeaveTypeConfig (Design Ref: §3.3) ---------- */

export async function listLeavePolicies(): Promise<LeavePolicy[]> {
  await ensureSeeded();
  return prisma.leavePolicy.findMany({ orderBy: { minYears: "asc" } });
}

export async function createLeavePolicy(input: Omit<LeavePolicy, "id">): Promise<LeavePolicy> {
  await ensureSeeded();
  return prisma.leavePolicy.create({ data: { id: `lp-${cryptoRandomId()}`, ...input } });
}

export async function updateLeavePolicy(id: string, patch: Partial<Omit<LeavePolicy, "id">>): Promise<LeavePolicy | undefined> {
  await ensureSeeded();
  try {
    return await prisma.leavePolicy.update({ where: { id }, data: patch });
  } catch {
    return undefined;
  }
}

export async function deleteLeavePolicy(id: string): Promise<boolean> {
  await ensureSeeded();
  const { count } = await prisma.leavePolicy.deleteMany({ where: { id } });
  return count > 0;
}

export async function listLeaveTypeConfigs(): Promise<LeaveTypeConfig[]> {
  await ensureSeeded();
  const rows = await prisma.leaveTypeConfig.findMany();
  return rows as LeaveTypeConfig[];
}

export async function getLeaveTypeConfig(id: string): Promise<LeaveTypeConfig | undefined> {
  await ensureSeeded();
  const row = await prisma.leaveTypeConfig.findUnique({ where: { id } });
  return row as LeaveTypeConfig | undefined;
}

export async function updateLeaveTypeConfig(
  id: string,
  patch: Partial<Omit<LeaveTypeConfig, "id" | "code">>
): Promise<LeaveTypeConfig | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.leaveTypeConfig.update({ where: { id }, data: patch });
    return row as LeaveTypeConfig;
  } catch {
    return undefined;
  }
}

/* ---------- LeaveBalance (Design Ref: §3.3, §4.1) ---------- */

export async function findLeaveBalance(userId: string, periodYear: number): Promise<LeaveBalance | undefined> {
  await ensureSeeded();
  return undef(await prisma.leaveBalance.findFirst({ where: { userId, periodYear } }));
}

export async function createLeaveBalance(input: Omit<LeaveBalance, "id">): Promise<LeaveBalance> {
  await ensureSeeded();
  return prisma.leaveBalance.create({ data: { id: `lb-${cryptoRandomId()}`, ...input } });
}

/** used를 delta만큼 증감한다(§4.7 선반영/환원에 사용). 음수가 되지 않도록 방어한다. */
export async function adjustLeaveBalanceUsed(userId: string, periodYear: number, delta: number): Promise<LeaveBalance | undefined> {
  await ensureSeeded();
  const current = await prisma.leaveBalance.findFirst({ where: { userId, periodYear } });
  if (!current) return undefined;
  return prisma.leaveBalance.update({ where: { id: current.id }, data: { used: Math.max(0, current.used + delta) } });
}

/** granted(부여일수)를 덮어쓴다(연차산정기준/발생일수 정책 변경 후 재산정에 사용). used는 건드리지 않는다. */
export async function setLeaveBalanceGranted(userId: string, periodYear: number, granted: number): Promise<LeaveBalance | undefined> {
  await ensureSeeded();
  const current = await prisma.leaveBalance.findFirst({ where: { userId, periodYear } });
  if (!current) return undefined;
  return prisma.leaveBalance.update({ where: { id: current.id }, data: { granted } });
}

/* ---------- LeaveRequest / Attachment (Design Ref: §3.3) ---------- */

export async function listLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
  await ensureSeeded();
  const rows = await prisma.leaveRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows as LeaveRequest[];
}

export async function getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
  await ensureSeeded();
  const row = await prisma.leaveRequest.findUnique({ where: { id } });
  return row as LeaveRequest | undefined;
}

export async function createLeaveRequest(
  input: Omit<LeaveRequest, "id" | "createdAt" | "editedAt" | "version">
): Promise<LeaveRequest> {
  await ensureSeeded();
  const row = await prisma.leaveRequest.create({
    data: { id: `lr-${cryptoRandomId()}`, ...input, version: 1, editedAt: null, createdAt: new Date().toISOString() },
  });
  return row as LeaveRequest;
}

export async function updateLeaveRequest(id: string, patch: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.leaveRequest.update({ where: { id }, data: patch });
    return row as LeaveRequest;
  } catch {
    return undefined;
  }
}

/**
 * §4.7 동시성 제어 — 단일 원자적 조건부 갱신.
 * WHERE id=:id AND version=:clientVersion AND status='PENDING' 을 Postgres UPDATE로 그대로 수행한다.
 * 영향받은 row가 없으면 undefined(호출부는 409 Conflict로 응답).
 */
export async function updateLeaveRequestIfVersionMatches(
  id: string,
  clientVersion: number,
  patch: Partial<Omit<LeaveRequest, "id" | "version">>
): Promise<LeaveRequest | undefined> {
  await ensureSeeded();
  const { count } = await prisma.leaveRequest.updateMany({
    where: { id, version: clientVersion, status: "PENDING" },
    data: { ...patch, version: { increment: 1 }, editedAt: new Date().toISOString() },
  });
  if (count === 0) return undefined;
  return (await prisma.leaveRequest.findUnique({ where: { id } })) as LeaveRequest;
}

export async function createAttachment(input: Omit<Attachment, "id" | "uploadedAt">): Promise<Attachment> {
  await ensureSeeded();
  return prisma.attachment.create({ data: { id: `att-${cryptoRandomId()}`, ...input, uploadedAt: new Date().toISOString() } });
}

export async function listAttachmentsByLeaveRequest(leaveRequestId: string): Promise<Attachment[]> {
  await ensureSeeded();
  return prisma.attachment.findMany({ where: { leaveRequestId } });
}

/**
 * status=APPROVED이면서 기간이 [rangeStart, rangeEnd]와 겹치는 연차 신청을 전 사용자 대상으로 조회한다.
 * Design Ref: §4.5 캘린더 병합 조회 — LeaveRequest WHERE status='APPROVED' AND 기간이 해당 월과 겹침.
 */
export async function listApprovedLeaveRequestsOverlapping(rangeStart: string, rangeEnd: string): Promise<LeaveRequest[]> {
  await ensureSeeded();
  const rows = await prisma.leaveRequest.findMany({
    where: { status: "APPROVED", startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
  });
  return rows as LeaveRequest[];
}

/* ---------- Event (Design Ref: §3.4 캘린더) ---------- */

export async function listEvents(): Promise<Event[]> {
  await ensureSeeded();
  return prisma.event.findMany();
}

export async function getEvent(id: string): Promise<Event | undefined> {
  await ensureSeeded();
  return undef(await prisma.event.findUnique({ where: { id } }));
}

/** startAt이 [rangeStart, rangeEnd]와 겹치는 일정을 조회한다(월간 뷰용). */
export async function listEventsOverlapping(rangeStart: string, rangeEnd: string): Promise<Event[]> {
  await ensureSeeded();
  return prisma.event.findMany({ where: { startAt: { lte: rangeEnd }, endAt: { gte: rangeStart } } });
}

export async function createEvent(input: Omit<Event, "id">): Promise<Event> {
  await ensureSeeded();
  return prisma.event.create({ data: { id: `ev-${cryptoRandomId()}`, ...input } });
}

export async function updateEvent(id: string, patch: Partial<Omit<Event, "id" | "createdBy">>): Promise<Event | undefined> {
  await ensureSeeded();
  try {
    return await prisma.event.update({ where: { id }, data: patch });
  } catch {
    return undefined;
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  await ensureSeeded();
  const { count } = await prisma.event.deleteMany({ where: { id } });
  return count > 0;
}

/* ---------- AttendanceRecord (Design Ref: §3.7, §4.6) ---------- */

export async function getAttendanceRecord(userId: string, date: string): Promise<AttendanceRecord | undefined> {
  await ensureSeeded();
  const row = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } });
  return row as AttendanceRecord | undefined;
}

export async function listAttendanceRecordsInRange(userId: string, rangeStart: string, rangeEnd: string): Promise<AttendanceRecord[]> {
  await ensureSeeded();
  const rows = await prisma.attendanceRecord.findMany({ where: { userId, date: { gte: rangeStart, lte: rangeEnd } } });
  return rows as AttendanceRecord[];
}

export async function createAttendanceRecord(input: Omit<AttendanceRecord, "id">): Promise<AttendanceRecord> {
  await ensureSeeded();
  const row = await prisma.attendanceRecord.create({ data: { id: `att-${cryptoRandomId()}`, ...input } });
  return row as AttendanceRecord;
}

export async function updateAttendanceRecord(
  id: string,
  patch: Partial<Omit<AttendanceRecord, "id">>
): Promise<AttendanceRecord | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.attendanceRecord.update({ where: { id }, data: patch });
    return row as AttendanceRecord;
  } catch {
    return undefined;
  }
}

/* ---------- OvertimeRequest (Design Ref: §3.9) ---------- */

export async function listOvertimeRequestsByUser(userId: string): Promise<OvertimeRequest[]> {
  await ensureSeeded();
  const rows = await prisma.overtimeRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows as OvertimeRequest[];
}

export async function getOvertimeRequest(id: string): Promise<OvertimeRequest | undefined> {
  await ensureSeeded();
  const row = await prisma.overtimeRequest.findUnique({ where: { id } });
  return row as OvertimeRequest | undefined;
}

export async function hasApprovedOvertimeToday(userId: string, date: string): Promise<boolean> {
  await ensureSeeded();
  const row = await prisma.overtimeRequest.findFirst({ where: { userId, date, status: "APPROVED" } });
  return !!row;
}

export async function createOvertimeRequest(
  input: Omit<OvertimeRequest, "id" | "createdAt" | "editedAt" | "version">
): Promise<OvertimeRequest> {
  await ensureSeeded();
  const row = await prisma.overtimeRequest.create({
    data: { id: `ot-${cryptoRandomId()}`, ...input, version: 1, editedAt: null, createdAt: new Date().toISOString() },
  });
  return row as OvertimeRequest;
}

export async function updateOvertimeRequest(id: string, patch: Partial<OvertimeRequest>): Promise<OvertimeRequest | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.overtimeRequest.update({ where: { id }, data: patch });
    return row as OvertimeRequest;
  } catch {
    return undefined;
  }
}

/* ---------- BusinessTrip / TripReport (Design Ref: module-13) ---------- */

export async function listBusinessTripsByUser(userId: string): Promise<BusinessTrip[]> {
  await ensureSeeded();
  const rows = await prisma.businessTrip.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows as BusinessTrip[];
}

export async function getBusinessTrip(id: string): Promise<BusinessTrip | undefined> {
  await ensureSeeded();
  const row = await prisma.businessTrip.findUnique({ where: { id } });
  return row as BusinessTrip | undefined;
}

export async function createBusinessTrip(
  input: Omit<BusinessTrip, "id" | "createdAt" | "editedAt" | "version">
): Promise<BusinessTrip> {
  await ensureSeeded();
  const row = await prisma.businessTrip.create({
    data: { id: `trip-${cryptoRandomId()}`, ...input, version: 1, editedAt: null, createdAt: new Date().toISOString() },
  });
  return row as BusinessTrip;
}

export async function updateBusinessTrip(id: string, patch: Partial<BusinessTrip>): Promise<BusinessTrip | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.businessTrip.update({ where: { id }, data: patch });
    return row as BusinessTrip;
  } catch {
    return undefined;
  }
}

/** 시외출장 중 승인 완료 + 종료일이 지난(결과보고 대상) 건을 전 재직자 대상으로 조회한다(관리자 현황용). */
export async function listCompletedOutOfTownTrips(userId?: string): Promise<BusinessTrip[]> {
  await ensureSeeded();
  const todayK = new Date().toISOString().slice(0, 10);
  const rows = await prisma.businessTrip.findMany({
    where: { ...(userId ? { userId } : {}), tripType: "OUT_OF_TOWN", status: "APPROVED", endDate: { lte: todayK } },
    orderBy: { endDate: "desc" },
  });
  return rows as BusinessTrip[];
}

export async function getTripReportByTripId(tripId: string): Promise<TripReport | undefined> {
  await ensureSeeded();
  const row = await prisma.tripReport.findUnique({ where: { tripId } });
  return row as TripReport | undefined;
}

export async function getTripReport(id: string): Promise<TripReport | undefined> {
  await ensureSeeded();
  const row = await prisma.tripReport.findUnique({ where: { id } });
  return row as TripReport | undefined;
}

export async function createTripReport(input: Omit<TripReport, "id" | "createdAt" | "editedAt" | "version">): Promise<TripReport> {
  await ensureSeeded();
  const row = await prisma.tripReport.create({
    data: {
      id: `trep-${cryptoRandomId()}`,
      ...input,
      transportAttachment: input.transportAttachment as never,
      lodgingAttachment: input.lodgingAttachment as never,
      version: 1,
      editedAt: null,
      createdAt: new Date().toISOString(),
    },
  });
  return row as unknown as TripReport;
}

export async function updateTripReport(id: string, patch: Partial<TripReport>): Promise<TripReport | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.tripReport.update({
      where: { id },
      data: { ...patch, transportAttachment: patch.transportAttachment as never, lodgingAttachment: patch.lodgingAttachment as never },
    });
    return row as unknown as TripReport;
  } catch {
    return undefined;
  }
}

/* ---------- DailyReport (Design Ref: §3.5, §4.3) ---------- */

export async function listDailyReportsByUser(userId: string): Promise<DailyReport[]> {
  await ensureSeeded();
  const rows = await prisma.dailyReport.findMany({ where: { userId }, orderBy: { reportDate: "desc" } });
  return rows as DailyReport[];
}

export async function findDailyReport(userId: string, reportDate: string): Promise<DailyReport | undefined> {
  await ensureSeeded();
  const row = await prisma.dailyReport.findUnique({ where: { userId_reportDate: { userId, reportDate } } });
  return row as DailyReport | undefined;
}

export async function getDailyReport(id: string): Promise<DailyReport | undefined> {
  await ensureSeeded();
  const row = await prisma.dailyReport.findUnique({ where: { id } });
  return row as DailyReport | undefined;
}

export async function createDailyReport(
  input: Omit<DailyReport, "id" | "createdAt" | "editedAt" | "version">
): Promise<DailyReport> {
  await ensureSeeded();
  const row = await prisma.dailyReport.create({
    data: { id: `dr-${cryptoRandomId()}`, ...input, version: 1, editedAt: null, createdAt: new Date().toISOString() },
  });
  return row as DailyReport;
}

export async function updateDailyReport(id: string, patch: Partial<DailyReport>): Promise<DailyReport | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.dailyReport.update({ where: { id }, data: patch });
    return row as DailyReport;
  } catch {
    return undefined;
  }
}

/** §4.7 동시성 제어 — LeaveRequest와 동일한 조건부 갱신 패턴. */
export async function updateDailyReportIfVersionMatches(
  id: string,
  clientVersion: number,
  patch: Partial<Omit<DailyReport, "id" | "version">>
): Promise<DailyReport | undefined> {
  await ensureSeeded();
  const { count } = await prisma.dailyReport.updateMany({
    where: { id, version: clientVersion, status: "PENDING" },
    data: { ...patch, version: { increment: 1 }, editedAt: new Date().toISOString() },
  });
  if (count === 0) return undefined;
  return (await prisma.dailyReport.findUnique({ where: { id } })) as DailyReport;
}

/** 특정 사용자의 [start, end] 구간 일일업무보고를 날짜순으로 조회한다(§4.4 주간 취합용). */
export async function listDailyReportsInRange(userId: string, start: string, end: string): Promise<DailyReport[]> {
  await ensureSeeded();
  const rows = await prisma.dailyReport.findMany({
    where: { userId, reportDate: { gte: start, lte: end } },
    orderBy: { reportDate: "asc" },
  });
  return rows as DailyReport[];
}

/* ---------- WeeklyReport (Design Ref: §3.5, §4.4) ---------- */

export async function listWeeklyReportsByUser(userId: string): Promise<WeeklyReport[]> {
  await ensureSeeded();
  const rows = await prisma.weeklyReport.findMany({ where: { userId }, orderBy: { weekStartDate: "desc" } });
  return rows as WeeklyReport[];
}

export async function findWeeklyReport(userId: string, weekStartDate: string): Promise<WeeklyReport | undefined> {
  await ensureSeeded();
  const row = await prisma.weeklyReport.findUnique({ where: { userId_weekStartDate: { userId, weekStartDate } } });
  return row as WeeklyReport | undefined;
}

export async function getWeeklyReport(id: string): Promise<WeeklyReport | undefined> {
  await ensureSeeded();
  const row = await prisma.weeklyReport.findUnique({ where: { id } });
  return row as WeeklyReport | undefined;
}

export async function createWeeklyReport(
  input: Omit<WeeklyReport, "id" | "createdAt" | "editedAt" | "version">
): Promise<WeeklyReport> {
  await ensureSeeded();
  const row = await prisma.weeklyReport.create({
    data: { id: `wr-${cryptoRandomId()}`, ...input, version: 1, editedAt: null, createdAt: new Date().toISOString() },
  });
  return row as WeeklyReport;
}

export async function updateWeeklyReport(id: string, patch: Partial<WeeklyReport>): Promise<WeeklyReport | undefined> {
  await ensureSeeded();
  try {
    const row = await prisma.weeklyReport.update({ where: { id }, data: patch });
    return row as WeeklyReport;
  } catch {
    return undefined;
  }
}

export async function updateWeeklyReportIfVersionMatches(
  id: string,
  clientVersion: number,
  patch: Partial<Omit<WeeklyReport, "id" | "version">>
): Promise<WeeklyReport | undefined> {
  await ensureSeeded();
  const { count } = await prisma.weeklyReport.updateMany({
    where: { id, version: clientVersion, status: "PENDING" },
    data: { ...patch, version: { increment: 1 }, editedAt: new Date().toISOString() },
  });
  if (count === 0) return undefined;
  return (await prisma.weeklyReport.findUnique({ where: { id } })) as WeeklyReport;
}

/* ---------- Notification (Design Ref: §3.6) ---------- */

export async function createNotification(input: Omit<Notification, "id" | "isRead" | "createdAt">): Promise<Notification> {
  await ensureSeeded();
  const row = await prisma.notification.create({
    data: { id: `ntf-${cryptoRandomId()}`, ...input, isRead: false, createdAt: new Date().toISOString() },
  });
  return row as Notification;
}

export async function listNotificationsByUser(userId: string, limit = 30): Promise<Notification[]> {
  await ensureSeeded();
  const rows = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  return rows as Notification[];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  await ensureSeeded();
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
  await ensureSeeded();
  const { count } = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  if (count === 0) return undefined;
  return (await prisma.notification.findUnique({ where: { id } })) as Notification;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  await ensureSeeded();
  const { count } = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  return count;
}

/* ---------- HrRecord (Design Ref: §3.8 인사기록카드) — 사용자 1인당 1건 ---------- */

export async function getHrRecord(userId: string): Promise<HrRecord | undefined> {
  await ensureSeeded();
  const row = await prisma.hrRecord.findUnique({ where: { userId } });
  return row as unknown as HrRecord | undefined;
}

/** module-15 §관리자 인사기록 관리 — 작성된 인사기록카드 전체를 한 번에 조회한다(관리자 전용). */
export async function listHrRecords(): Promise<HrRecord[]> {
  await ensureSeeded();
  const rows = await prisma.hrRecord.findMany();
  return rows as unknown as HrRecord[];
}

/** 최초 저장이면 생성, 이미 있으면 갱신한다(1인당 1건). */
export async function saveHrRecord(userId: string, patch: Omit<HrRecord, "userId" | "savedAt">): Promise<HrRecord> {
  await ensureSeeded();
  const data = {
    ...patch,
    emergencyContact: patch.emergencyContact as never,
    education: patch.education as never,
    career: patch.career as never,
    certificates: patch.certificates as never,
    family: patch.family as never,
    savedAt: new Date().toISOString(),
  };
  const row = await prisma.hrRecord.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return row as unknown as HrRecord;
}

/* ---------- Holiday (Design Ref: 회사 기본정보 §공휴일 지정) ---------- */

export async function listHolidays(year?: number): Promise<Holiday[]> {
  await ensureSeeded();
  const rows = await prisma.holiday.findMany({
    where: year ? { date: { startsWith: `${year}-` } } : undefined,
    orderBy: { date: "asc" },
  });
  return rows as Holiday[];
}

export async function findHolidayByDate(date: string): Promise<Holiday | undefined> {
  await ensureSeeded();
  return undef(await prisma.holiday.findUnique({ where: { date } })) as Holiday | undefined;
}

export async function createHoliday(input: Omit<Holiday, "id">): Promise<Holiday> {
  await ensureSeeded();
  return (await prisma.holiday.create({ data: { id: `hol-${cryptoRandomId()}`, ...input } })) as Holiday;
}

export async function deleteHoliday(id: string): Promise<boolean> {
  await ensureSeeded();
  try {
    await prisma.holiday.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/**
 * 연도별 법정공휴일 자동 가져오기 — 이미 등록된 날짜(자동/수동 무관)는 건드리지 않고 건너뛴다
 * (관리자가 수동으로 수정/삭제한 내용을 덮어쓰지 않기 위함). 새로 추가된 개수를 반환한다.
 */
export async function importAutoHolidays(items: { date: string; name: string }[]): Promise<number> {
  await ensureSeeded();
  let count = 0;
  for (const item of items) {
    const exists = await prisma.holiday.findUnique({ where: { date: item.date } });
    if (exists) continue;
    await prisma.holiday.create({ data: { id: `hol-${cryptoRandomId()}`, date: item.date, name: item.name, source: "AUTO" } });
    count++;
  }
  return count;
}
