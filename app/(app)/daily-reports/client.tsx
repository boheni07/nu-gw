"use client";

// Design Ref: mockup/pages/index.html renderDailyScreen() — grid-2(작성 폼 + 최근 작성 이력) +
// 상신 완료 상태 카드 + badge-auto 자동반영 표시 구조로 정리(module-12 디자인 정합화)
import { useEffect, useMemo, useState } from "react";
import type { DailyReport } from "@/types";
import { CalendarIcon } from "@/lib/ui/icons";
import DateInput from "@/lib/ui/DateInput";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
  RECALLED: "회수",
};
const STATUS_PILL: Record<string, string> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  RECALLED: "neutral",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel() {
  return new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default function DailyReportClient({ initialHistory }: { initialHistory: DailyReport[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [reportDate, setReportDate] = useState(todayKey());
  const [todayResult, setTodayResult] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [prevDayWasLeave, setPrevDayWasLeave] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // §4.7 UX 원칙: 수정 폼은 신규 작성 폼을 그대로 재사용하고, 기존 값이 채워진 채로 열린다.
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null);

  // 선택한 날짜에 이미 상신(회수 제외)된 보고서가 있으면 폼 대신 상태 카드를 보여준다(중복 상신 방지, §4.7).
  const existingForDate = useMemo(
    () => history.find((h) => h.reportDate === reportDate && h.status !== "RECALLED"),
    [history, reportDate]
  );

  useEffect(() => {
    if (editing) return; // 수정 모드에서는 자동 초안을 다시 불러오지 않는다.
    if (existingForDate) return; // 이미 상신된 날짜면 초안을 불러올 필요 없다.
    setDraftLoaded(false);
    fetch(`/api/daily-reports/draft?date=${reportDate}`)
      .then((r) => r.json())
      .then((data) => {
        setTodayResult(data.todayResultDraft ?? "");
        setPrevDayWasLeave(!!data.prevDayWasLeave);
        setAutoFilled(!!data.todayResultDraft);
      })
      .finally(() => setDraftLoaded(true));
  }, [reportDate, editing, existingForDate]);

  function resetForm() {
    setReportDate(todayKey());
    setTomorrowPlan("");
    setNotes("");
    setEditing(null);
    setAutoFilled(false);
  }

  function startEdit(item: DailyReport) {
    setEditing({ id: item.id, version: item.version });
    setReportDate(item.reportDate);
    setTodayResult(item.todayResult);
    setTomorrowPlan(item.tomorrowPlan);
    setNotes(item.notes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (editing) {
        const res = await fetch(`/api/daily-reports/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: editing.version, todayResult, tomorrowPlan, notes }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "수정에 실패했습니다.");
          return;
        }
        setHistory((prev) => prev.map((h) => (h.id === editing.id ? { ...h, ...data } : h)));
        resetForm();
        return;
      }

      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportDate, todayResult, tomorrowPlan, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "상신에 실패했습니다.");
        return;
      }
      setHistory((prev) => [data, ...prev]);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecall(id: string) {
    if (!confirm("이 보고서를 회수하시겠습니까?")) return;
    const res = await fetch(`/api/daily-reports/${id}/recall`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "회수에 실패했습니다.");
      return;
    }
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status: data.status } : h)));
  }

  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.reportDate.localeCompare(a.reportDate)), [history]);

  return (
    <div className="grid-2">
      <div className="card card-pad">
        <div className="card-head">
          <h2>{editing ? "일일업무보고 수정" : "오늘의 업무보고"}</h2>
          <span className="hint">{todayLabel()}</span>
        </div>

        {!editing && (
          <div className="field" style={{ maxWidth: 200 }}>
            <label>대상 일자</label>
            <DateInput value={reportDate} max={todayKey()} onChange={setReportDate} />
          </div>
        )}

        {prevDayWasLeave && !editing && !existingForDate && (
          <div className="badge-auto" style={{ marginBottom: 14 }}>
            <CalendarIcon size={13} /> 전일은 휴가였습니다 — 자동 초안이 비어있는 이유입니다
          </div>
        )}

        {existingForDate && !editing ? (
          existingForDate.status === "PENDING" ? (
            <>
              <div className="card" style={{ background: "var(--surface-alt)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <b style={{ fontSize: 13 }}>상신 완료</b>
                  <span className={`pill ${STATUS_PILL[existingForDate.status]}`}>{STATUS_LABEL[existingForDate.status]}</span>
                </div>
                <div className="kv">
                  <div className="kv-row" style={{ alignItems: "flex-start" }}>
                    <span className="k">당일 업무실적</span>
                    <span className="v" style={{ textAlign: "right", whiteSpace: "pre-wrap" }}>
                      {existingForDate.todayResult}
                    </span>
                  </div>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <button type="button" className="btn danger-o" onClick={() => handleRecall(existingForDate.id)}>
                  취소
                </button>
                <button type="button" className="btn" onClick={() => startEdit(existingForDate)}>
                  수정
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              {reportDate === todayKey() ? "오늘" : reportDate} 일일업무보고를 이미 상신했습니다.{" "}
              <span className={`pill ${STATUS_PILL[existingForDate.status]}`}>{STATUS_LABEL[existingForDate.status]}</span>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
            <div className="field">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ margin: 0 }}>당일 업무실적</label>
                {!editing && autoFilled && (
                  <span className="badge-auto">전일 계획에서 자동 반영</span>
                )}
              </div>
              <textarea
                className="input"
                rows={4}
                value={todayResult}
                onChange={(e) => setTodayResult(e.target.value)}
                required
                placeholder={draftLoaded || editing ? undefined : "불러오는 중…"}
              />
              <p className="helptext">전일 다음날 계획이 자동으로 채워집니다. 자유롭게 수정하세요.</p>
            </div>
            <div className="field">
              <label>다음날 업무계획</label>
              <textarea className="input" rows={3} placeholder="내일 예정된 업무를 입력하세요" value={tomorrowPlan} onChange={(e) => setTomorrowPlan(e.target.value)} required />
            </div>
            <div className="field">
              <label>
                보고사항 <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(선택)</span>
              </label>
              <textarea className="input" rows={2} placeholder="공유가 필요한 특이사항이 있다면 입력하세요" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="btn-row">
              {editing && (
                <button type="button" className="btn ghost" onClick={resetForm}>
                  수정 취소
                </button>
              )}
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "처리 중…" : editing ? "수정 저장" : "결재 상신"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>최근 작성 이력</h2>
        </div>
        {sortedHistory.length === 0 ? (
          <div className="empty">작성 이력이 없습니다.</div>
        ) : (
          sortedHistory.map((h) => (
            <div key={h.id} className="list-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {h.reportDate}
                  {h.editedAt && (
                    <span className="pill neutral" style={{ marginLeft: 6, padding: "1px 7px" }}>
                      수정됨
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.todayResult}
                </div>
              </div>
              <span className={`pill ${STATUS_PILL[h.status]}`}>{STATUS_LABEL[h.status]}</span>
              {h.status === "PENDING" && (
                <button type="button" className="btn ghost" style={{ flex: "none" }} onClick={() => startEdit(h)}>
                  수정
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
