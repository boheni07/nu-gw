// Design Ref: §5 API 설계 — CRUD /approval-lines, /approval-line-steps (ADMIN 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import {
  collectDepartmentAndDescendantIds,
  listApprovalLines,
  listDepartments,
  upsertApprovalLineForDepartments,
} from "@/lib/data/store";
import type { DocumentType } from "@/types";

const VALID_DOC_TYPES: DocumentType[] = ["LEAVE", "DAILY_REPORT", "WEEKLY_REPORT", "OVERTIME", "TRIP", "TRIP_REPORT"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });
  return NextResponse.json(await listApprovalLines());
}

interface StepInput {
  stepOrder: number;
  approverUserId: string;
  isParallel: boolean;
}

/**
 * 부서×문서유형의 결재선을 (재)설정한다. 기존 활성 결재선은 비활성화되고 새 결재선이 생성된다
 * (§3.2 — 이미 상신된 건은 스냅샷을 갖고 있어 영향받지 않는다).
 *
 * module-20 §결재선 설정 — departmentId="ALL"이면 전체 부서에, includeChildren=true이면
 * 선택한 부서 + 모든 하위 부서에 동일한 결재선을 일괄 적용한다.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const departmentId = typeof body?.departmentId === "string" ? body.departmentId : "";
  const includeChildren = body?.includeChildren === true;
  const documentType: DocumentType | "" = VALID_DOC_TYPES.includes(body?.documentType) ? body.documentType : "";
  const steps: StepInput[] = Array.isArray(body?.steps) ? body.steps : [];

  if (!departmentId || !documentType || steps.length === 0) {
    return NextResponse.json({ error: "부서·문서유형·1단계 이상의 승인자가 필요합니다." }, { status: 400 });
  }
  for (const s of steps) {
    if (!s.approverUserId || typeof s.stepOrder !== "number") {
      return NextResponse.json({ error: "각 단계에는 순서와 승인자가 필요합니다." }, { status: 400 });
    }
  }

  const allDepartments = await listDepartments();
  const targetDepartmentIds =
    departmentId === "ALL"
      ? allDepartments.map((d) => d.id)
      : includeChildren
        ? collectDepartmentAndDescendantIds(departmentId, allDepartments)
        : [departmentId];

  const lines = await upsertApprovalLineForDepartments(targetDepartmentIds, documentType, steps);
  return NextResponse.json(lines, { status: 201 });
}
