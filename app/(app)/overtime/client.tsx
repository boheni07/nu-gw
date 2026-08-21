"use client";

// Design Ref: mockup/pages/index.html renderOvertimeScreen() — grid-2(신청 폼 + 신청 내역) +
// 19:00 이전 입력 시 실시간 경고 구조로 정리(module-12 디자인 정합화)
import { useState } from "react";
import type { OvertimeRequest } from "@/types";
import DateInput from "@/lib/ui/DateInput";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
  RECALLED: "회수",
};
const STATUS_PILL: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  RECALLED: "neutral",
};

export default function OvertimeClient({ initialHistory }: { initialHistory: OvertimeRequest[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [date, setDate] = useState("");
  const [expectedEndTime, setExpectedEndTime] = useState("21:00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const endTimeInvalid = !!expectedEndTime && expectedEndTime <= "19:00";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (endTimeInvalid) return;
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/overtime-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          expectedEndTime: form.get("expectedEndTime"),
          workDetail: form.get("workDetail"),
          reason: form.get("reason"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "신청에 실패했습니다.");
        return;
      }
      setHistory((prev) => [data, ...prev]);
      (e.target as HTMLFormElement).reset();
      setDate("");
      setExpectedEndTime("21:00");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecall(id: string) {
    if (!confirm("이 신청을 회수하시겠습니까?")) return;
    const res = await fetch(`/api/overtime-requests/${id}/recall`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "회수에 실패했습니다.");
      return;
    }
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status: data.status } : h)));
  }

  return (
    <div className="grid-2">
      <div className="card card-pad">
        <div className="card-head">
          <h2>초과근무 신청</h2>
        </div>
        <p className="helptext" style={{ margin: "-6px 0 14px" }}>
          반드시 결재 승인이 있어야 하며, 승인된 신청 건이 있는 날에만 19:00 이후 퇴근 체크가 가능합니다.
        </p>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field">
            <label>날짜</label>
            <DateInput value={date} onChange={setDate} required />
          </div>
          <div className="field">
            <label>예상 퇴근시간</label>
            <input
              name="expectedEndTime"
              type="time"
              className="input"
              value={expectedEndTime}
              onChange={(e) => setExpectedEndTime(e.target.value)}
              required
            />
            {endTimeInvalid && <p className="helptext" style={{ color: "var(--danger)" }}>19:00 이후 시간을 입력하세요.</p>}
          </div>
          <div className="field">
            <label>업무내용(상세)</label>
            <textarea name="workDetail" className="input" rows={3} placeholder="예: 프로모션 소재 최종 검수 및 발행 준비" required />
          </div>
          <div className="field">
            <label>사유</label>
            <textarea name="reason" className="input" rows={2} placeholder="예: 출시 일정 임박으로 야간 작업 필요" required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="btn-row">
            <button type="submit" className="btn primary" disabled={submitting || endTimeInvalid}>
              {submitting ? "상신 중…" : "결재 상신"}
            </button>
          </div>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>신청 내역</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>예상 퇴근</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    신청 내역이 없습니다.
                  </td>
                </tr>
              )}
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="num">{h.date}</td>
                  <td className="num">{h.expectedEndTime}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[h.status]}`}>{STATUS_LABEL[h.status]}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {h.status === "PENDING" && (
                      <button type="button" className="btn ghost" onClick={() => handleRecall(h.id)}>
                        회수
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
