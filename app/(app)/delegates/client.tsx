"use client";

// Design Ref: 목업에는 대결자 지정 화면이 없어(module-10에서 신설) 결재선 설정 등 다른 관리 화면에서
// 정립한 카드+card-head+아이콘 버튼 디자인 언어를 동일하게 적용한다(module-12 디자인 정합화).
import { useState } from "react";
import type { DelegateAssignment, User } from "@/types";
import { TrashIcon } from "@/lib/ui/icons";
import DateInput from "@/lib/ui/DateInput";

export default function DelegatesClient({ initial, users }: { initial: DelegateAssignment[]; users: User[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/delegates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegateUserId: form.get("delegateUserId"),
          startDate,
          endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "지정에 실패했습니다.");
        return;
      }
      setItems((prev) => [...prev, data]);
      (e.target as HTMLFormElement).reset();
      setStartDate("");
      setEndDate("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 대결 지정을 해제하시겠습니까?")) return;
    const res = await fetch(`/api/delegates/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((d) => d.id !== id));
  }

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  // Design Ref: §6 module-10 — 대결 지정 화면에서 지난/진행중/예정 이력을 구분해 보여준다.
  const today = new Date().toISOString().slice(0, 10);
  function statusOf(d: DelegateAssignment): { label: string; pill: string } {
    if (d.endDate < today) return { label: "종료됨", pill: "neutral" };
    if (d.startDate > today) return { label: "예정", pill: "warning" };
    return { label: "진행중", pill: "success" };
  }

  const sorted = [...items].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const activeCount = items.filter((d) => statusOf(d).label !== "종료됨").length;

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="card-head">
          <h2>대결자 지정</h2>
        </div>
        <p className="helptext" style={{ margin: "-6px 0 14px" }}>
          지정한 기간 동안 대결자가 내 결재 건을 대신 처리할 수 있습니다.
        </p>
        <form onSubmit={handleCreate} className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1.4 }}>
            <label>대결자</label>
            <select name="delegateUserId" className="input" required>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>시작일</label>
            <DateInput value={startDate} onChange={setStartDate} required />
          </div>
          <div className="field">
            <label>종료일</label>
            <DateInput value={endDate} onChange={setEndDate} required />
          </div>
          <div className="field" style={{ flex: "none" }}>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "저장 중…" : "지정"}
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>지정 이력</h2>
          <span className="hint">진행중·예정 {activeCount}건</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>대결자</th>
                <th>기간</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    지정된 대결자가 없습니다.
                  </td>
                </tr>
              )}
              {sorted.map((d) => {
                const status = statusOf(d);
                return (
                  <tr key={d.id}>
                    <td>{nameOf(d.delegateUserId)}</td>
                    <td>
                      {d.startDate} ~ {d.endDate}
                    </td>
                    <td>
                      <span className={`pill ${status.pill}`}>{status.label}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {status.label !== "종료됨" && (
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ color: "var(--danger)" }}
                          onClick={() => handleDelete(d.id)}
                          aria-label="해제"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
