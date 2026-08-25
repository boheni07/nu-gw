"use client";

// Design Ref: 회사 기본정보 §공휴일 지정(module-21 신설) — 연도별 법정공휴일을 자동으로 가져오거나
// 회사 자체 휴일(창립기념일 등)을 수동으로 추가할 수 있다. 연차정책설정의 근속연수별 발생일수 카드와
// 동일한 "행 추가/삭제" 테이블 언어를 따른다.
import { useEffect, useState } from "react";
import type { Holiday } from "@/types";
import { PlusIcon, TrashIcon } from "@/lib/ui/icons";

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1, THIS_YEAR + 2];
const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function weekdayOf(date: string): string {
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAY_LABEL[d.getDay()];
}

export default function HolidaysCard({ initialYear, initialHolidays }: { initialYear: number; initialHolidays: Holiday[] }) {
  const [year, setYear] = useState(initialYear);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(`${year}-01-01`);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (year === initialYear) {
      setHolidays(initialHolidays);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/admin/holidays?year=${year}`)
      .then((r) => r.json())
      .then((data) => setHolidays(Array.isArray(data) ? data : []))
      .catch(() => setError("공휴일 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function handleImport() {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/holidays/import?year=${year}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "법정공휴일을 가져오는 데 실패했습니다.");
        return;
      }
      setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
      setNotice(
        data.addedCount > 0
          ? `${year}년 법정공휴일 ${data.addedCount}건을 추가했습니다.${data.skippedCount > 0 ? ` (이미 등록된 ${data.skippedCount}건은 건너뜀)` : ""}`
          : `${year}년 법정공휴일이 이미 모두 등록되어 있습니다.`
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleAddManual() {
    if (!newDate || !newName.trim()) {
      setError("날짜와 명칭을 입력해주세요.");
      return;
    }
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "추가에 실패했습니다.");
        return;
      }
      if (data.date.startsWith(`${year}-`)) {
        setHolidays((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      }
      setNewName("");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(h: Holiday) {
    if (!confirm(`"${h.name}"(${h.date})을(를) 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/holidays/${h.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setHolidays((prev) => prev.filter((x) => x.id !== h.id));
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>공휴일 지정</h2>
        <span className="hint">연차(일) 근무일수 계산 등 전사 공통 휴일 목록</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <label htmlFor="hol-year" style={{ margin: 0 }}>
          연도
        </label>
        <select
          id="hol-year"
          className="input"
          style={{ width: 110 }}
          value={year}
          onChange={(e) => {
            const y = Number(e.target.value);
            setYear(y);
            setNewDate(`${y}-01-01`);
          }}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <button type="button" className="btn" disabled={importing} onClick={handleImport}>
          {importing ? "가져오는 중…" : `${year}년 법정공휴일 자동 가져오기`}
        </button>
      </div>
      <p className="helptext" style={{ marginTop: -8, marginBottom: 14 }}>
        외부 공휴일 정보(Nager.Date)에서 대체공휴일을 포함해 가져옵니다. 이미 등록된 날짜(수동 추가분 포함)는 덮어쓰지 않습니다.
      </p>

      {notice && <p className="helptext" style={{ color: "var(--success)" }}>{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      {loading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>}
      {!loading && holidays.length === 0 && (
        <p className="empty">{year}년에 등록된 공휴일이 없습니다. 위 버튼으로 자동 가져오거나 아래에서 직접 추가하세요.</p>
      )}
      {!loading && holidays.length > 0 && (
        <div className="holiday-grid">
          {holidays.map((h) => (
            <div className="holiday-item" key={h.id}>
              <div className="meta">
                <span className="date">{h.date}</span>
                <span className="weekday">({weekdayOf(h.date)})</span>
                <span className="name">{h.name}</span>
              </div>
              <div className="actions">
                <span className={`pill ${h.source === "AUTO" ? "neutral" : "warning"}`}>{h.source === "AUTO" ? "자동" : "수동"}</span>
                <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={() => handleDelete(h)} aria-label="삭제">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="field-row" style={{ marginTop: 14, alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0, flex: "0 0 160px" }}>
          <label>날짜</label>
          <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>명칭</label>
          <input
            className="input"
            placeholder="예: 창립기념일"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <button type="button" className="btn" disabled={adding} onClick={handleAddManual}>
            <PlusIcon /> 수동 추가
          </button>
        </div>
      </div>
    </div>
  );
}
