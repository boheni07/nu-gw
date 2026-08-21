"use client";

// Design Ref: mockup/pages/index.html renderCalendarScreen()/renderDayDetailPanel()/renderEventFormModal()
// — 카드 래핑 + 일 최대 3건 노출(+더보기) + 날짜 상세 패널 + 일정 등록 모달 구조로 정리(module-12 디자인 정합화)
import { useEffect, useMemo, useState } from "react";
import type { Department } from "@/types";
import { CloseIcon } from "@/lib/ui/icons";
import DateInput from "@/lib/ui/DateInput";

interface CalEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  description: string | null;
  createdBy: string;
  createdByName: string;
  departmentTag: string | null;
}
interface CalLeave {
  id: string;
  userId: string;
  userName: string;
  departmentId: string | null;
  typeName: string;
  startDate: string;
  endDate: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_CHIPS = 3;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function toKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayKey() {
  return toKey(new Date());
}

export default function CalendarClient({
  departments,
  currentUserId,
  isAdmin,
}: {
  departments: Department[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [leaves, setLeaves] = useState<CalLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayDetailKey, setDayDetailKey] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState("");

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ month });
    if (deptFilter !== "ALL") qs.set("dept", deptFilter);
    fetch(`/api/calendar?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLeaves(data.leaves ?? []);
      })
      .finally(() => setLoading(false));
  }, [month, deptFilter]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }

  const [monthYear, monthNum] = month.split("-").map(Number);

  const weeks = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const firstOfMonth = new Date(y, m - 1, 1);
    const startOffset = firstOfMonth.getDay(); // 0=일
    const gridStart = new Date(y, m - 1, 1 - startOffset);
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === m - 1 });
    }
    const result: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    // 마지막 주가 전부 다음달이면 생략(6주 필요 없을 때 5주로 축소)
    if (result.length === 6 && result[5].every((c) => !c.inMonth)) result.pop();
    return result;
  }, [month]);

  function eventsOn(dateKey: string) {
    return events.filter((e) => e.startAt.slice(0, 10) <= dateKey && e.endAt.slice(0, 10) >= dateKey);
  }
  function leavesOn(dateKey: string) {
    return leaves.filter((l) => l.startDate <= dateKey && l.endDate >= dateKey);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const startDate = eventDate;
    const startTime = String(form.get("startTime") || "09:00");
    const endTime = String(form.get("endTime") || "10:00");
    const deptTag = String(form.get("departmentTag") || "");

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        startAt: `${startDate}T${startTime}:00`,
        endAt: `${startDate}T${endTime}:00`,
        location: form.get("location"),
        description: form.get("description"),
        departmentTag: deptTag || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setEvents((prev) => [...prev, { ...data, createdByName: "나" }]);
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    setEventDate("");
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const detailDate = dayDetailKey ? new Date(dayDetailKey + "T00:00:00") : null;
  const detailLabel = detailDate
    ? `${detailDate.getMonth() + 1}월 ${detailDate.getDate()}일 (${WEEKDAYS[detailDate.getDay()]})`
    : "";
  const detailLeaves = dayDetailKey ? leavesOn(dayDetailKey) : [];
  const detailEvents = dayDetailKey ? eventsOn(dayDetailKey) : [];

  return (
    <div className="card card-pad">
      <div className="cal-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="btn ghost" style={{ padding: "6px 10px" }} onClick={() => shiftMonth(-1)}>
            ‹
          </button>
          <h2 style={{ fontSize: 16, minWidth: 104, textAlign: "center" }}>
            {monthYear}년 {monthNum}월
          </h2>
          <button type="button" className="btn ghost" style={{ padding: "6px 10px" }} onClick={() => shiftMonth(1)}>
            ›
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select className="input" style={{ width: 150, padding: "7px 10px" }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="ALL">전체 부서</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn primary" onClick={() => setShowForm(true)}>
            + 일정 등록
          </button>
        </div>
      </div>

      <div className="cal-legend" style={{ marginBottom: 12 }}>
        <span>
          <span className="cal-legend-dot" style={{ background: "var(--success)" }} />
          승인된 휴가
        </span>
        <span>
          <span className="cal-legend-dot" style={{ background: "var(--accent)" }} />
          사내 일정
        </span>
      </div>

      <div className="cal-weekhead">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="cal-grid">
        {weeks.flat().map(({ date, inMonth }) => {
          const key = toKey(date);
          const dayEvents = eventsOn(key);
          const dayLeaves = leavesOn(key);
          const items = [
            ...dayLeaves.map((l) => ({ kind: "leave" as const, id: l.id, label: `${l.userName} · ${l.typeName}` })),
            ...dayEvents.map((e) => ({ kind: "event" as const, id: e.id, label: e.title })),
          ];
          const shown = items.slice(0, MAX_CHIPS);
          const overflow = items.length - shown.length;
          return (
            <div key={key} className={`cal-cell ${inMonth ? "" : "out"} ${key === todayKey() ? "today" : ""}`}>
              <div className="cal-daynum">{date.getDate()}</div>
              {shown.map((it) => (
                <button
                  key={it.kind + it.id}
                  type="button"
                  className={`cal-chip ${it.kind}`}
                  title={it.label}
                  onClick={() => setDayDetailKey(key)}
                >
                  {it.label}
                </button>
              ))}
              {overflow > 0 && (
                <button type="button" className="cal-more" onClick={() => setDayDetailKey(key)}>
                  +{overflow}건 더보기
                </button>
              )}
            </div>
          );
        })}
      </div>
      {loading && <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>불러오는 중…</p>}

      {dayDetailKey && (
        <div className="overlay" onClick={() => setDayDetailKey(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>{detailLabel}</h2>
              <button type="button" className="icon-btn" onClick={() => setDayDetailKey(null)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>

            <div className="card-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 13, color: "var(--text-faint)" }}>승인된 휴가 ({detailLeaves.length})</h2>
            </div>
            {detailLeaves.length === 0 ? (
              <div className="empty" style={{ padding: "14px 0" }}>
                해당 날짜에 휴가자가 없습니다.
              </div>
            ) : (
              detailLeaves.map((l) => (
                <div key={l.id} className="list-row">
                  <span className="pill success">{l.typeName}</span>
                  <div style={{ flex: 1 }}>{l.userName}</div>
                </div>
              ))
            )}

            <hr className="divider" />

            <div className="card-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 13, color: "var(--text-faint)" }}>사내 일정 ({detailEvents.length})</h2>
            </div>
            {detailEvents.length === 0 ? (
              <div className="empty" style={{ padding: "14px 0" }}>
                등록된 일정이 없습니다.
              </div>
            ) : (
              detailEvents.map((e) => {
                const canManage = e.createdBy === currentUserId || isAdmin;
                const deptTagName = e.departmentTag ? departments.find((d) => d.id === e.departmentTag)?.name ?? "" : "전사";
                return (
                  <div key={e.id} className="list-row" style={{ alignItems: "flex-start" }}>
                    <span className="pill neutral">{e.startAt.slice(11, 16)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                        {e.location ? `${e.location} · ` : ""}
                        {deptTagName} · {e.createdByName}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ flex: "none", color: "var(--danger)" }}
                        onClick={() => handleDeleteEvent(e.id)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="overlay center" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>사내 일정 등록</h2>
              <button type="button" className="icon-btn" onClick={() => setShowForm(false)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleCreate} className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label>제목</label>
                <input name="title" className="input" placeholder="예: 팀 회의" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>날짜</label>
                  <DateInput value={eventDate} onChange={setEventDate} required />
                </div>
                <div className="field">
                  <label>시작시간</label>
                  <input name="startTime" type="time" className="input" defaultValue="10:00" />
                </div>
                <div className="field">
                  <label>종료시간</label>
                  <input name="endTime" type="time" className="input" defaultValue="11:00" />
                </div>
              </div>
              <div className="field">
                <label>
                  장소 <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(선택)</span>
                </label>
                <input name="location" className="input" placeholder="예: 회의실 A" />
              </div>
              <div className="field">
                <label>공개 범위</label>
                <select name="departmentTag" className="input" defaultValue="">
                  <option value="">전사 공통</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}만
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>
                  설명 <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(선택)</span>
                </label>
                <textarea name="description" className="input" rows={2} />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="btn-row">
                <button type="submit" className="btn primary">
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
