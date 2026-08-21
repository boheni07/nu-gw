"use client";

// Design Ref: mockup/pages/index.html renderWeeklyScreen() — grid-2(작성 폼 + 이번 주 일일보고 현황/작성 이력) +
// badge-auto 자동취합 표시 + 상신 완료 상태 카드 구조로 정리(module-12 디자인 정합화)
import { useEffect, useMemo, useState } from "react";
import type { WeeklyReport } from "@/types";
import { CalendarIcon, CheckIcon } from "@/lib/ui/icons";
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
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function dateLabel(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function WeeklyReportClient({ initialHistory }: { initialHistory: WeeklyReport[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [anyDateInWeek, setAnyDateInWeek] = useState(todayKey());
  const [weekRange, setWeekRange] = useState<{ weekStartDate: string; weekEndDate: string } | null>(null);
  const [thisWeekResult, setThisWeekResult] = useState("");
  const [nextWeekPlan, setNextWeekPlan] = useState("");
  const [notes, setNotes] = useState("");
  const [coveredDays, setCoveredDays] = useState(0);
  const [teamLeaves, setTeamLeaves] = useState<{ userName: string; startDate: string; endDate: string }[]>([]);
  const [dailyStatuses, setDailyStatuses] = useState<{ date: string; status: string | null }[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // §4.7 UX 원칙: 수정 폼은 신규 작성 폼을 그대로 재사용하고, 기존 값이 채워진 채로 열린다.
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null);

  const existingForWeek = useMemo(
    () => (weekRange ? history.find((h) => h.weekStartDate === weekRange.weekStartDate && h.status !== "RECALLED") : undefined),
    [history, weekRange]
  );

  useEffect(() => {
    if (editing) return; // 수정 모드에서는 자동 취합 초안을 다시 불러오지 않는다.
    setDraftLoaded(false);
    fetch(`/api/weekly-reports/draft?weekStart=${anyDateInWeek}`)
      .then((r) => r.json())
      .then((data) => {
        setWeekRange({ weekStartDate: data.weekStartDate, weekEndDate: data.weekEndDate });
        setThisWeekResult(data.thisWeekResultDraft ?? "");
        setCoveredDays(data.coveredDays ?? 0);
        setTeamLeaves(data.teamLeaves ?? []);
        setDailyStatuses(data.dailyStatuses ?? []);
      })
      .finally(() => setDraftLoaded(true));
  }, [anyDateInWeek, editing]);

  function resetForm() {
    setAnyDateInWeek(todayKey());
    setNextWeekPlan("");
    setNotes("");
    setEditing(null);
  }

  function startEdit(item: WeeklyReport) {
    setEditing({ id: item.id, version: item.version });
    setWeekRange({ weekStartDate: item.weekStartDate, weekEndDate: item.weekEndDate });
    setThisWeekResult(item.thisWeekResult);
    setNextWeekPlan(item.nextWeekPlan);
    setNotes(item.notes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weekRange) return;
    setError(null);
    setSubmitting(true);
    try {
      if (editing) {
        const res = await fetch(`/api/weekly-reports/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: editing.version, thisWeekResult, nextWeekPlan, notes }),
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

      const res = await fetch("/api/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: weekRange.weekStartDate, thisWeekResult, nextWeekPlan, notes }),
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
    const res = await fetch(`/api/weekly-reports/${id}/recall`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "회수에 실패했습니다.");
      return;
    }
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status: data.status } : h)));
  }

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate)),
    [history]
  );

  return (
    <div className="grid-2">
      <div className="card card-pad">
        <div className="card-head">
          <h2>{editing ? "주간업무보고 수정" : "이번 주 업무보고"}</h2>
          {weekRange && (
            <span className="hint">
              {weekRange.weekStartDate} ~ {weekRange.weekEndDate}
            </span>
          )}
        </div>

        {!editing && (
          <div className="field" style={{ maxWidth: 240 }}>
            <label>대상 주(아무 날짜나 선택하면 해당 주 월~금으로 계산됩니다)</label>
            <DateInput value={anyDateInWeek} max={todayKey()} onChange={setAnyDateInWeek} />
          </div>
        )}

        {teamLeaves.length > 0 && !editing && !existingForWeek && (
          <div className="badge-auto" style={{ marginBottom: 14 }}>
            <CalendarIcon size={13} /> 이번 주 팀원 {new Set(teamLeaves.map((l) => l.userName)).size}명 휴가 —{" "}
            {teamLeaves.map((l) => `${l.userName}(${dateLabel(l.startDate)})`).join(", ")}
          </div>
        )}

        {existingForWeek && !editing ? (
          existingForWeek.status === "PENDING" ? (
            <>
              <div className="card" style={{ background: "var(--surface-alt)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <b style={{ fontSize: 13 }}>상신 완료</b>
                  <span className={`pill ${STATUS_PILL[existingForWeek.status]}`}>{STATUS_LABEL[existingForWeek.status]}</span>
                </div>
                <div className="kv">
                  <div className="kv-row" style={{ alignItems: "flex-start" }}>
                    <span className="k">금주 업무실적</span>
                    <span className="v" style={{ textAlign: "right", whiteSpace: "pre-wrap" }}>
                      {existingForWeek.thisWeekResult}
                    </span>
                  </div>
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <button type="button" className="btn danger-o" onClick={() => handleRecall(existingForWeek.id)}>
                  취소
                </button>
                <button type="button" className="btn" onClick={() => startEdit(existingForWeek)}>
                  수정
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              이번 주 주간업무보고를 이미 상신했습니다.{" "}
              <span className={`pill ${STATUS_PILL[existingForWeek.status]}`}>{STATUS_LABEL[existingForWeek.status]}</span>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
            <div className="field">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ margin: 0 }}>금주 업무실적</label>
                {!editing && coveredDays > 0 && (
                  <span className="badge-auto">
                    <CheckIcon size={12} /> 일일보고 {coveredDays}건 자동 취합
                  </span>
                )}
              </div>
              <textarea className="input" rows={6} value={thisWeekResult} onChange={(e) => setThisWeekResult(e.target.value)} required />
              <p className="helptext">해당 주 일일업무보고의 당일 실적이 날짜순으로 자동 취합됩니다. 요약·정리해 수정하세요.</p>
            </div>
            <div className="field">
              <label>차주 업무계획</label>
              <textarea className="input" rows={3} placeholder="다음 주 예정 업무를 입력하세요" value={nextWeekPlan} onChange={(e) => setNextWeekPlan(e.target.value)} required />
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
              <button type="submit" className="btn primary" disabled={submitting || !draftLoaded}>
                {submitting ? "처리 중…" : editing ? "수정 저장" : "결재 상신"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>이번 주 일일보고 현황</h2>
        </div>
        {dailyStatuses.map((d, i) => (
          <div key={d.date} className="list-row">
            <div style={{ flex: 1, fontWeight: 600 }}>
              {WEEKDAY_LABELS[i]} {dateLabel(d.date)}
            </div>
            <span className={`pill ${d.status ? STATUS_PILL[d.status] : "neutral"}`}>{d.status ? STATUS_LABEL[d.status] : "미작성"}</span>
          </div>
        ))}

        <hr className="divider" style={{ margin: "18px 0" }} />

        <div className="card-head">
          <h2>작성 이력</h2>
        </div>
        {sortedHistory.length === 0 ? (
          <div className="empty">작성 이력이 없습니다.</div>
        ) : (
          sortedHistory.map((h) => (
            <div key={h.id} className="list-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {h.weekStartDate} ~ {h.weekEndDate}
                  {h.editedAt && (
                    <span className="pill neutral" style={{ marginLeft: 6, padding: "1px 7px" }}>
                      수정됨
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.thisWeekResult}
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
