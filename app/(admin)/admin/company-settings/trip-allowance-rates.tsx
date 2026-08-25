"use client";

// Design Ref: module-20 §회사 기본정보 — 출장비 단가(일비/식비/숙박비 상한액)를 기준연도별로 기록·관리한다.
// 연차정책 설정의 "근속연수별 발생일수" 테이블과 동일하게 인라인 편집 가능한 행 추가/삭제 구조로 정리.
import { useState } from "react";
import type { TripAllowanceRate } from "@/types";
import { PlusIcon, TrashIcon } from "@/lib/ui/icons";
import MoneyInput from "@/lib/ui/MoneyInput";

export default function TripAllowanceRatesCard({ initial }: { initial: TripAllowanceRate[] }) {
  const [rates, setRates] = useState(initial.slice().sort((a, b) => b.year - a.year));
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const latestYear = rates[0]?.year;

  async function handleSave(rate: TripAllowanceRate) {
    setError(null);
    const res = await fetch("/api/admin/trip-allowance-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: rate.year,
        dailyRate: rate.dailyRate,
        mealRate: rate.mealRate,
        lodgingCapPerNight: rate.lodgingCapPerNight,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    setRates((prev) => prev.map((r) => (r.id === rate.id ? data : r)).sort((a, b) => b.year - a.year));
  }

  function patchLocal(id: string, patch: Partial<TripAllowanceRate>) {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleAdd() {
    setAdding(true);
    setError(null);
    try {
      const nextYear = (latestYear ?? new Date().getFullYear() - 1) + 1;
      const res = await fetch("/api/admin/trip-allowance-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: nextYear,
          dailyRate: rates[0]?.dailyRate ?? 0,
          mealRate: rates[0]?.mealRate ?? 0,
          lodgingCapPerNight: rates[0]?.lodgingCapPerNight ?? 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "추가에 실패했습니다.");
        return;
      }
      setRates((prev) => [...prev.filter((r) => r.year !== data.year), data].sort((a, b) => b.year - a.year));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(rate: TripAllowanceRate) {
    if (!confirm(`${rate.year}년 기준 단가를 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/trip-allowance-rates/${rate.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRates((prev) => prev.filter((r) => r.id !== rate.id));
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>출장비 단가(기준연도별)</h2>
        <span className="hint">계산에는 가장 최근 기준연도의 값이 사용됩니다</span>
      </div>
      <p className="helptext" style={{ marginTop: -8, marginBottom: 14 }}>
        일비·식비는 "단가 × 출장일수", 숙박비는 실비 청구분이 "상한액 × 숙박일수"를 초과하지 않는 범위에서 자동 계산됩니다.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>기준연도</th>
              <th>일비(원/일)</th>
              <th>식비(원/일)</th>
              <th>숙박비 상한액(원/박)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  등록된 기준연도가 없습니다. 아래 &quot;기준연도 추가&quot; 버튼으로 입력하세요.
                </td>
              </tr>
            )}
            {rates.map((r) => (
              <tr key={r.id}>
                <td className="num">
                  {r.year}
                  {r.year === latestYear && (
                    <span className="pill success" style={{ marginLeft: 6, padding: "1px 7px" }}>
                      현재 적용
                    </span>
                  )}
                </td>
                <td>
                  <MoneyInput value={r.dailyRate} onChange={(v) => patchLocal(r.id, { dailyRate: v })} onBlur={() => handleSave(rates.find((x) => x.id === r.id)!)} />
                </td>
                <td>
                  <MoneyInput value={r.mealRate} onChange={(v) => patchLocal(r.id, { mealRate: v })} onBlur={() => handleSave(rates.find((x) => x.id === r.id)!)} />
                </td>
                <td>
                  <MoneyInput value={r.lodgingCapPerNight} onChange={(v) => patchLocal(r.id, { lodgingCapPerNight: v })} onBlur={() => handleSave(rates.find((x) => x.id === r.id)!)} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={() => handleDelete(r)} aria-label="삭제">
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
        <button type="button" className="btn" disabled={adding} onClick={handleAdd}>
          <PlusIcon /> 기준연도 추가
        </button>
      </div>
    </div>
  );
}
