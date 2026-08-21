"use client";

// Design Ref: mockup/pages/index.html renderAdminLeavePolicyScreen() — 인라인 편집 가능한 정책 테이블 +
// 유형 테이블(카테고리도 직접 수정 가능) 구조로 정리(module-12 디자인 정합화)
import { useState } from "react";
import type { LeaveBasis, LeaveCategory, LeavePolicy, LeaveTypeConfig, PayType } from "@/types";
import { PlusIcon, TrashIcon } from "@/lib/ui/icons";

const CATEGORY_LABEL: Record<string, string> = {
  ANNUAL_DEDUCT: "연차 차감형",
  SPECIAL: "특별휴가",
  OFFICIAL: "공가",
};
const INPUT_MODE_LABEL: Record<string, string> = { DAY_RANGE: "일 단위", HOUR_RANGE: "시간 단위" };

export default function LeavePolicyClient({
  initialDefaultLeaveBasis,
  initialPolicies,
  initialTypes,
}: {
  initialDefaultLeaveBasis: LeaveBasis;
  initialPolicies: LeavePolicy[];
  initialTypes: LeaveTypeConfig[];
}) {
  const [defaultLeaveBasis, setDefaultLeaveBasis] = useState(initialDefaultLeaveBasis);
  const [savingBasis, setSavingBasis] = useState(false);
  const [policies, setPolicies] = useState(initialPolicies);
  const [types, setTypes] = useState(initialTypes);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleBasisChange(next: LeaveBasis) {
    setDefaultLeaveBasis(next);
    setSavingBasis(true);
    try {
      const res = await fetch("/api/admin/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLeaveBasis: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "연차산정기준 저장에 실패했습니다.");
      }
    } finally {
      setSavingBasis(false);
    }
  }

  async function handlePolicyPatch(id: string, patch: { minYears?: number; maxYears?: number; grantDays?: number }) {
    const res = await fetch(`/api/admin/leave-policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "수정에 실패했습니다.");
      return;
    }
    setError(null);
    setPolicies((prev) => prev.map((p) => (p.id === id ? data : p)));
  }

  async function handleAddPolicy() {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minYears: 0, maxYears: 1, grantDays: 11 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "추가에 실패했습니다.");
        return;
      }
      setPolicies((prev) => [...prev, data].sort((a, b) => a.minYears - b.minYears));
    } finally {
      setAdding(false);
    }
  }

  async function handleDeletePolicy(id: string) {
    if (!confirm("이 구간을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/leave-policies/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleTypePatch(id: string, patch: { requireAttachment?: boolean; payType?: PayType; category?: LeaveCategory }) {
    const res = await fetch(`/api/admin/leave-type-configs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const data = await res.json();
    setTypes((prev) => prev.map((t) => (t.id === id ? data : t)));
  }

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="card-head">
          <h2>전사 연차산정기준</h2>
          {savingBasis && <span className="hint">저장 중…</span>}
        </div>
        <div className="field" style={{ maxWidth: 320 }}>
          <select className="input" value={defaultLeaveBasis} onChange={(e) => handleBasisChange(e.target.value as LeaveBasis)}>
            <option value="FISCAL_YEAR">회계연도 기준</option>
            <option value="HIRE_DATE">입사일 기준</option>
          </select>
          <p className="helptext">전 직원에게 동일하게 적용됩니다(부서별 개별 설정은 지원하지 않습니다).</p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>근속연수별 발생일수</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>근속연수(이상)</th>
                <th>근속연수(미만)</th>
                <th>발생일수</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    등록된 구간이 없습니다. 아래 &quot;구간 추가&quot; 버튼으로 입력하세요.
                  </td>
                </tr>
              )}
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      step="0.5"
                      defaultValue={p.minYears}
                      style={{ width: 80, padding: "4px 8px" }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.minYears && !Number.isNaN(v)) handlePolicyPatch(p.id, { minYears: v });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      step="0.5"
                      defaultValue={p.maxYears}
                      style={{ width: 80, padding: "4px 8px" }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.maxYears && !Number.isNaN(v)) handlePolicyPatch(p.id, { maxYears: v });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      step="0.5"
                      defaultValue={p.grantDays}
                      style={{ width: 80, padding: "4px 8px" }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== p.grantDays && !Number.isNaN(v)) handlePolicyPatch(p.id, { grantDays: v });
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={() => handleDeletePolicy(p.id)} aria-label="삭제">
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn" disabled={adding} onClick={handleAddPolicy}>
            <PlusIcon /> 구간 추가
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>연차 유형</h2>
          <span className="hint">카테고리·증빙 필수 여부 관리</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>유형명</th>
                <th>입력 방식</th>
                <th>카테고리</th>
                <th>증빙 필수</th>
                <th>급여 유형</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    <span className="pill neutral">{INPUT_MODE_LABEL[t.inputMode]}</span>
                  </td>
                  <td>
                    <select
                      className="input"
                      style={{ width: 150, padding: "6px 8px" }}
                      value={t.category}
                      onChange={(e) => handleTypePatch(t.id, { category: e.target.value as LeaveCategory })}
                    >
                      <option value="ANNUAL_DEDUCT">{CATEGORY_LABEL.ANNUAL_DEDUCT}</option>
                      <option value="SPECIAL">{CATEGORY_LABEL.SPECIAL}</option>
                      <option value="OFFICIAL">{CATEGORY_LABEL.OFFICIAL}</option>
                    </select>
                  </td>
                  <td>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={t.requireAttachment}
                        onChange={(e) => handleTypePatch(t.id, { requireAttachment: e.target.checked })}
                      />
                    </label>
                  </td>
                  <td>
                    <select
                      className="input"
                      style={{ width: 110, padding: "6px 8px" }}
                      value={t.payType}
                      onChange={(e) => handleTypePatch(t.id, { payType: e.target.value as PayType })}
                    >
                      <option value="PAID">유급</option>
                      <option value="UNPAID">무급</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="helptext" style={{ marginTop: 10 }}>
          변경 사항은 즉시 반영됩니다(연차 신청 화면의 카테고리 그룹에 바로 적용).
        </p>
      </div>
    </div>
  );
}
