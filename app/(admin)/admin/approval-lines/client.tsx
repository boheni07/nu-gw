"use client";

// Design Ref: mockup/pages/index.html renderAdminApprovalLinesScreen() — 단일 카드 + 부서/문서유형 필터 셀렉트 +
// 단계별 행(pill+삭제 아이콘) 구조로 정리(module-12 디자인 정합화). 실제 앱은 부서별 병렬 승인 그룹을
// 지원하므로(§3.2) 목업의 단일 승인자 자유텍스트 입력 대신 그룹별 사용자 select로 구현한다.
import { useMemo, useState } from "react";
import type { ApprovalLineWithSteps } from "@/lib/data/store";
import type { Department, DocumentType, User } from "@/types";
import { PlusIcon, TrashIcon } from "@/lib/ui/icons";

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  LEAVE: "연차",
  DAILY_REPORT: "일일업무보고",
  WEEKLY_REPORT: "주간업무보고",
  OVERTIME: "초과근무",
  TRIP: "출장신청",
  TRIP_REPORT: "출장결과보고",
};
const DOC_TYPES: DocumentType[] = ["LEAVE", "DAILY_REPORT", "WEEKLY_REPORT", "OVERTIME", "TRIP", "TRIP_REPORT"];
const MAX_STEP_ORDERS = 3;

/** 업무유형별로 문서유형을 묶어 결재선 목록을 카테고리 단위로 보여준다. */
const CATEGORIES: { label: string; types: DocumentType[] }[] = [
  { label: "업무보고", types: ["DAILY_REPORT", "WEEKLY_REPORT"] },
  { label: "출장업무", types: ["TRIP", "TRIP_REPORT"] },
  { label: "초과근무신청", types: ["OVERTIME"] },
  { label: "연차신청", types: ["LEAVE"] },
];

interface StepForm {
  stepOrder: number;
  approverUserId: string;
  isParallel: boolean;
}

/** flat steps 배열을 stepOrder 기준으로 그룹화한다(§3.2 — 동일 stepOrder = 병렬 승인 그룹). */
function groupByStepOrder(steps: StepForm[]): StepForm[][] {
  const groups = new Map<number, StepForm[]>();
  for (const s of steps) {
    if (!groups.has(s.stepOrder)) groups.set(s.stepOrder, []);
    groups.get(s.stepOrder)!.push(s);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, members]) => members);
}

/** 그룹 삭제/추가 후 stepOrder를 1..N으로 재정렬하고, 멤버가 1명뿐인 그룹은 isParallel=false로 정리한다. */
function renumberAndNormalize(groups: StepForm[][]): StepForm[] {
  return groups.flatMap((members, idx) =>
    members.map((m) => ({ ...m, stepOrder: idx + 1, isParallel: members.length > 1 }))
  );
}

export default function ApprovalLinesClient({
  departments,
  users,
  initialLines,
}: {
  departments: Department[];
  users: User[];
  initialLines: ApprovalLineWithSteps[];
}) {
  const [lines, setLines] = useState(initialLines);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [documentType, setDocumentType] = useState<DocumentType>("LEAVE");
  const [includeChildren, setIncludeChildren] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllScope = departmentId === "ALL";
  const childCount = departments.filter((d) => d.parentId === departmentId).length;

  const currentLine = useMemo(
    () => (isAllScope ? undefined : lines.find((l) => l.departmentId === departmentId && l.documentType === documentType)),
    [lines, departmentId, documentType, isAllScope]
  );

  const [steps, setSteps] = useState<StepForm[]>(() => toStepForm(currentLine));

  function selectTarget(dept: string, docType: DocumentType) {
    setDepartmentId(dept);
    setDocumentType(docType);
    setIncludeChildren(false);
    const line = dept === "ALL" ? undefined : lines.find((l) => l.departmentId === dept && l.documentType === docType);
    setSteps(toStepForm(line));
    setError(null);
  }

  function toStepForm(line?: ApprovalLineWithSteps): StepForm[] {
    if (!line || line.steps.length === 0) {
      const deptUsers = users.filter((u) => u.departmentId === departmentId);
      return [{ stepOrder: 1, approverUserId: deptUsers[0]?.id ?? users[0]?.id ?? "", isParallel: false }];
    }
    return line.steps.map((s) => ({ stepOrder: s.stepOrder, approverUserId: s.approverUserId, isParallel: s.isParallel }));
  }

  const groups = groupByStepOrder(steps);

  function addStepGroup() {
    if (groups.length >= MAX_STEP_ORDERS) return;
    setSteps((prev) => [...prev, { stepOrder: groups.length + 1, approverUserId: users[0]?.id ?? "", isParallel: false }]);
  }

  /** 같은 stepOrder(groupIdx)에 병렬 공동 승인자를 추가한다. */
  function addParallelApprover(groupIdx: number) {
    const stepOrder = groups[groupIdx][0].stepOrder;
    const nextGroups = groups.map((members, idx) =>
      idx === groupIdx ? [...members, { stepOrder, approverUserId: users[0]?.id ?? "", isParallel: true }] : members
    );
    setSteps(renumberAndNormalize(nextGroups));
  }

  function removeApprover(groupIdx: number, memberIdx: number) {
    const nextGroups = groups
      .map((members, idx) => (idx === groupIdx ? members.filter((_, mi) => mi !== memberIdx) : members))
      .filter((members) => members.length > 0);
    if (nextGroups.length === 0) return; // 최소 1단계는 유지
    setSteps(renumberAndNormalize(nextGroups));
  }

  function updateApprover(groupIdx: number, memberIdx: number, approverUserId: string) {
    const nextGroups = groups.map((members, idx) =>
      idx === groupIdx ? members.map((m, mi) => (mi === memberIdx ? { ...m, approverUserId } : m)) : members
    );
    setSteps(renumberAndNormalize(nextGroups));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/approval-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId, documentType, steps, includeChildren }),
      });
      const data: ApprovalLineWithSteps[] = await res.json();
      if (!res.ok) {
        setError((data as unknown as { error?: string }).error ?? "저장에 실패했습니다.");
        return;
      }
      const updatedDeptIds = new Set(data.map((l) => l.departmentId));
      setLines((prev) => [...prev.filter((l) => !(updatedDeptIds.has(l.departmentId) && l.documentType === documentType)), ...data]);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLine(line: ApprovalLineWithSteps) {
    if (!confirm(`${deptNameOf(line.departmentId)} · ${DOC_TYPE_LABEL[line.documentType]} 결재선을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/approval-lines/${line.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setLines((prev) => prev.filter((l) => l.id !== line.id));
    if (departmentId === line.departmentId && documentType === line.documentType) {
      setSteps(toStepForm(undefined));
    }
  }

  const nameOf = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId;
  const deptNameOf = (deptId: string) => departments.find((d) => d.id === deptId)?.name ?? deptId;

  /** 결재선 한 건을 "1단계(A) → 2단계(B·C)" 형태의 요약 문자열로 만든다. */
  function summaryFor(line?: ApprovalLineWithSteps): string {
    if (!line || line.steps.length === 0) return "";
    const grouped = groupByStepOrder(
      line.steps.map((s) => ({ stepOrder: s.stepOrder, approverUserId: s.approverUserId, isParallel: s.isParallel }))
    );
    return grouped.map((members) => members.map((m) => nameOf(m.approverUserId)).join("·")).join(" → ");
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
    <div className="card card-pad content-narrow">
      <div className="card-head">
        <h2>결재선 설정</h2>
        {isAllScope ? (
          <span className="pill admin">전사 일괄 적용</span>
        ) : (
          <span className={`pill ${currentLine ? "success" : "neutral"}`}>{currentLine ? "설정됨" : "미설정"}</span>
        )}
      </div>
      <p className="helptext" style={{ marginTop: -8, marginBottom: 14 }}>
        부서 × 문서유형별로 1~3단계 결재선을 구성합니다. 저장 시 기존 결재선은 비활성화되고 새로
        생성됩니다(이미 상신된 건에는 영향 없음). <b>전사</b>를 선택하면 모든 부서에, 부서를 선택하고
        "하위 부서 포함"을 체크하면 해당 부서와 하위 부서 전체에 동일한 결재선이 일괄 적용됩니다.
      </p>

      <div className="field-row" style={{ marginBottom: 8 }}>
        <div className="field">
          <label>부서</label>
          <select className="input" value={departmentId} onChange={(e) => selectTarget(e.target.value, documentType)}>
            <option value="ALL">전사(전체 부서)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>문서유형</label>
          <select className="input" value={documentType} onChange={(e) => selectTarget(departmentId, e.target.value as DocumentType)}>
            {DOC_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {DOC_TYPE_LABEL[dt]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isAllScope && childCount > 0 && (
        <label className="checkbox-row" style={{ marginBottom: 18 }}>
          <input type="checkbox" checked={includeChildren} onChange={(e) => setIncludeChildren(e.target.checked)} />
          <span>하위 부서 포함(하위 {childCount}개 부서에도 동일하게 적용)</span>
        </label>
      )}
      {(isAllScope || childCount === 0) && <div style={{ marginBottom: 10 }} />}

      <p className="helptext" style={{ marginBottom: 14 }}>
        같은 단계에 승인자를 여러 명 추가하면 <b>병렬 승인</b>이 됩니다 — 해당 단계는 전원이 승인해야 다음 단계로 넘어갑니다.
      </p>

      <div className="stack" style={{ gap: 10 }}>
        {groups.map((members, groupIdx) => (
          <div key={groupIdx}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="pill neutral" style={{ flex: "none" }}>
                {members[0].stepOrder}단계
              </span>
              {members.length > 1 && <span className="pill admin">병렬 {members.length}명</span>}
            </div>

            {members.map((step, memberIdx) => (
              <div key={memberIdx} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <select className="input" style={{ flex: 1 }} value={step.approverUserId} onChange={(e) => updateApprover(groupIdx, memberIdx, e.target.value)}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.position || u.role})
                    </option>
                  ))}
                </select>
                {(members.length > 1 || groups.length > 1) && (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ flex: "none", color: "var(--danger)" }}
                    onClick={() => removeApprover(groupIdx, memberIdx)}
                    aria-label="승인자 삭제"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}

            <button type="button" className="btn ghost" style={{ fontSize: 12 }} onClick={() => addParallelApprover(groupIdx)}>
              <PlusIcon size={12} /> 병렬 승인자 추가
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={addStepGroup} disabled={groups.length >= MAX_STEP_ORDERS}>
          <PlusIcon size={12} /> 단계 추가(최대 {MAX_STEP_ORDERS}단계)
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="btn-row" style={{ marginTop: 18 }}>
        <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>

    <div className="card card-pad">
      <div className="card-head">
        <h2>설정된 결재선</h2>
        <span className="hint">업무유형별로 부서 × 문서유형 결재선 설정 현황을 확인하세요</span>
      </div>
      <div className="stack" style={{ gap: 18 }}>
        {CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className="nav-group" style={{ padding: "0 0 8px" }}>
              {cat.label}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>부서</th>
                    <th>문서유형</th>
                    <th>결재선</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {departments.flatMap((dept) =>
                    cat.types.map((dt) => {
                      const line = lines.find((l) => l.departmentId === dept.id && l.documentType === dt);
                      const active = departmentId === dept.id && documentType === dt;
                      return (
                        <tr
                          key={`${dept.id}-${dt}`}
                          onClick={() => selectTarget(dept.id, dt)}
                          style={{ cursor: "pointer", background: active ? "var(--surface-hover, rgba(0,0,0,0.03))" : undefined }}
                        >
                          <td>{deptNameOf(dept.id)}</td>
                          <td>{DOC_TYPE_LABEL[dt]}</td>
                          <td>{line ? summaryFor(line) : <span className="hint">미설정</span>}</td>
                          <td>
                            <span className={`pill ${line ? "success" : "neutral"}`}>{line ? "설정됨" : "미설정"}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {line && (
                              <button
                                type="button"
                                className="btn ghost"
                                style={{ color: "var(--danger)" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLine(line);
                                }}
                                aria-label="삭제"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
