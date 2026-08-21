"use client";

// Design Ref: §6 화면 흐름 — 대시보드 "출근"/"퇴근" 체크 카드(별도 메뉴 이동 없이 당일 체크)
// mockup/pages/index.html renderAttendanceActionCard() 의 .att-line 구조 + 퇴근 가능 시각 안내(module-12 디자인 정합화)
import { useEffect, useState } from "react";
import { ClockIcon, LogoutIcon } from "@/lib/ui/icons";

interface TodayRecord {
  checkInAt: string | null;
  checkOutAt: string | null;
  autoCheckedOut: boolean;
}

function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AttendanceCard() {
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [overtimeApprovedToday, setOvertimeApprovedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowLabel, setNowLabel] = useState("");
  const [nowMinutes, setNowMinutes] = useState(0);

  function loadToday() {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const month = todayKey.slice(0, 7);

    const attendanceReq = fetch(`/api/attendance?month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        const day = (data.days ?? []).find((d: { date: string }) => d.date === todayKey);
        setToday(
          day
            ? { checkInAt: day.checkInAt, checkOutAt: day.checkOutAt, autoCheckedOut: !!day.autoCheckedOut }
            : { checkInAt: null, checkOutAt: null, autoCheckedOut: false }
        );
      });
    const overtimeReq = fetch("/api/overtime-requests")
      .then((r) => r.json())
      .then((list: { date: string; status: string }[]) => {
        setOvertimeApprovedToday(list.some((o) => o.date === todayKey && o.status === "APPROVED"));
      });

    Promise.all([attendanceReq, overtimeReq]).finally(() => setLoading(false));
  }

  useEffect(loadToday, []);
  useEffect(() => {
    const now = new Date();
    setNowLabel(fmtTime(now.toISOString()));
    setNowMinutes(now.getHours() * 60 + now.getMinutes());
  }, []);

  async function handle(action: "check-in" | "check-out") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "처리에 실패했습니다.");
        return;
      }
      setToday({ checkInAt: data.checkInAt, checkOutAt: data.checkOutAt, autoCheckedOut: !!data.autoCheckedOut });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;
  // Design Ref: §4.6 — 18:00 이전 퇴근 불가, 19:00 이후는 당일 승인된 초과근무가 있어야 가능
  const canCheckOut = checkedIn && nowMinutes >= 18 * 60 && (nowMinutes < 19 * 60 || overtimeApprovedToday);
  const checkoutNote = !checkedIn
    ? "출근 먼저"
    : nowMinutes < 18 * 60
      ? "18:00 이후 가능"
      : nowMinutes >= 19 * 60 && !overtimeApprovedToday
        ? "19:00 이후는 초과근무 승인 필요"
        : "";

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>오늘 출퇴근</h2>
        {nowLabel && <span className="now-chip"><ClockIcon size={13} /> {nowLabel}</span>}
      </div>
      <div>
        <div className="att-line">
          <span className="att-line-icon">
            <ClockIcon size={16} />
          </span>
          <span className="att-line-label">출근</span>
          <span className={`att-line-time${checkedIn ? "" : " pending"}`}>{fmtTime(today?.checkInAt ?? null)}</span>
          {checkedIn ? (
            <span className="pill success" style={{ marginLeft: "auto" }}>
              완료
            </span>
          ) : (
            <button type="button" className="btn primary" disabled={busy} onClick={() => handle("check-in")}>
              출근 체크
            </button>
          )}
        </div>
        <div className="att-line">
          <span className="att-line-icon">
            <LogoutIcon size={16} />
          </span>
          <span className="att-line-label">퇴근</span>
          <span className={`att-line-time${checkedOut ? "" : " pending"}`}>{fmtTime(today?.checkOutAt ?? null)}</span>
          {today?.autoCheckedOut && (
            <span className="pill neutral" style={{ padding: "1px 7px" }}>
              자동
            </span>
          )}
          {checkedOut ? (
            <span className="pill success" style={{ marginLeft: "auto" }}>
              완료
            </span>
          ) : (
            <>
              <button type="button" className="btn" disabled={busy || !canCheckOut} onClick={() => handle("check-out")}>
                퇴근 체크
              </button>
              {checkoutNote && <span className="att-line-note">{checkoutNote}</span>}
            </>
          )}
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
