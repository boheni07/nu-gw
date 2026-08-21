"use client";

// Design Ref: module-20 §조직 관리 — 부서를 상위/하위 계층 트리로 보여주고 관리한다.
// (기존에는 "상위 부서" select 컬럼이 있는 평면 테이블이었으나, 실제 계층 구조를 한눈에 파악하기 어려워
// 들여쓰기 트리 뷰로 개선했다. leaveBasis 부서 오버라이드는 module-20에서 폐지되어 연차정책 설정 화면으로 통합됨.)
import { useState } from "react";
import type { Department } from "@/types";
import { CloseIcon, PlusIcon } from "@/lib/ui/icons";

interface DeptNode extends Department {
  children: DeptNode[];
}

/** 평면 목록을 parentId 기준 트리로 구성한다. 순환 참조 등으로 부모를 찾을 수 없는 노드는 최상위로 취급한다. */
function buildTree(departments: Department[]): DeptNode[] {
  const nodes = new Map<string, DeptNode>(departments.map((d) => [d.id, { ...d, children: [] }]));
  const roots: DeptNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export default function DepartmentsClient({ initial }: { initial: Department[] }) {
  const [departments, setDepartments] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const parentId = String(form.get("parentId") || "");
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), parentId: parentId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setDepartments((prev) => [...prev, data]);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: string, patch: { name?: string; parentId?: string | null }) {
    const res = await fetch(`/api/admin/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const data = await res.json();
    setDepartments((prev) => prev.map((d) => (d.id === id ? data : d)));
  }

  /** 자기 자신과 모든 하위 부서는 상위 부서 후보에서 제외한다(순환 방지). */
  function excludedIds(id: string): Set<string> {
    const excluded = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of departments) {
        if (d.parentId && excluded.has(d.parentId) && !excluded.has(d.id)) {
          excluded.add(d.id);
          changed = true;
        }
      }
    }
    return excluded;
  }

  const tree = buildTree(departments);

  function renderNode(node: DeptNode, depth: number): React.ReactNode {
    const excluded = excludedIds(node.id);
    return (
      <div key={node.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 4px",
            paddingLeft: 4 + depth * 24,
            borderBottom: "1px solid var(--border-soft, #eee)",
          }}
        >
          {depth > 0 && <span style={{ color: "var(--text-faint)", fontSize: 13 }}>└</span>}
          <input
            className="input"
            style={{ padding: "4px 8px", fontSize: 12.5, width: 160 }}
            defaultValue={node.name}
            onBlur={(e) => {
              if (e.target.value !== node.name && e.target.value.trim()) handleUpdate(node.id, { name: e.target.value.trim() });
            }}
          />
          <label style={{ fontSize: 12, color: "var(--text-faint)", flex: "none" }}>상위 부서</label>
          <select
            className="input"
            style={{ padding: "4px 8px", fontSize: 12.5, width: 160 }}
            value={node.parentId ?? ""}
            onChange={(e) => handleUpdate(node.id, { parentId: e.target.value || null })}
          >
            <option value="">없음(최상위)</option>
            {departments
              .filter((p) => !excluded.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>부서 목록(계층형)</h2>
        <span className="hint">{departments.length}개</span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button type="button" className="btn primary" onClick={() => setShowCreate(true)}>
          <PlusIcon /> 부서 등록
        </button>
      </div>

      <div className="stack" style={{ gap: 0 }}>
        {tree.length === 0 && <div className="empty">등록된 부서가 없습니다.</div>}
        {tree.map((node) => renderNode(node, 0))}
      </div>

      {showCreate && (
        <div className="overlay" onClick={() => setShowCreate(false)}>
          <form className="panel" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>부서 등록</h2>
              <button type="button" className="icon-btn" onClick={() => setShowCreate(false)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <div className="field">
              <label>부서명</label>
              <input name="name" className="input" required />
            </div>
            <div className="field">
              <label>
                상위 부서 <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(선택)</span>
              </label>
              <select name="parentId" className="input" defaultValue="">
                <option value="">없음(최상위)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="btn-row">
              <button type="submit" className="btn primary" disabled={creating}>
                {creating ? "등록 중…" : "등록"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
