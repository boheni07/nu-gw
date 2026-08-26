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
function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function AttendanceCard({ onChanged }: { onChanged?: () => void } = {}) {
  const [today, setToday] = useState<TodayRecord | null>(null);
  // §4.6 — 승인된 초과근무가 있으면 예상 퇴근시간까지만 퇴근 체크를 허용한다.
  const [overtimeExpectedEndTime, setOvertimeExpectedEndTime] = useState<string | null>(null);
  // §4.6 — 승인된 연차(시간)가 있으면 그 시작시간부터 조기 퇴근 체크를 허용한다.
  const [hourlyLeaveStartTime, setHourlyLeaveStartTime] = useState<string | null>(null);
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
      .then((list: { date: string; status: string; expectedEndTime: string }[]) => {
        const approved = list.find((o) => o.date === todayKey && o.status === "APPROVED");
        setOvertimeExpectedEndTime(approved?.expectedEndTime ?? null);
      });
    const leaveReq = fetch("/api/leave-requests")
      .then((r) => r.json())
      .then((list: { startDate: string; startTime: string | null; status: string }[]) => {
        const hourly = Array.isArray(list) ? list.find((l) => l.startDate === todayKey && l.startTime && l.status === "APPROVED") : null;
        setHourlyLeaveStartTime(hourly?.startTime ?? null);
      });

    Promise.all([attendanceReq, overtimeReq, leaveReq]).finally(() => setLoading(false));
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
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;

  // Design Ref: §4.6 — 기본 18:00 이후 퇴근 가능. 당일 승인된 연차(시간)가 있으면 그 시작시간부터(조기 퇴근),
  // 19:00 이후는 당일 승인된 초과근무가 있어야 하고 그 예상 퇴근시간을 넘기면 다시 차단(초과근무 시간 내에서만).
  const hourlyLeaveStartMinutes = hourlyLeaveStartTime ? hhmmToMinutes(hourlyLeaveStartTime) : null;
  const earliestMinutes = hourlyLeaveStartMinutes !== null ? Math.min(18 * 60, hourlyLeaveStartMinutes) : 18 * 60;
  const overtimeEndMinutes = overtimeExpectedEndTime ? hhmmToMinutes(overtimeExpectedEndTime) : null;
  const pastEarliest = nowMinutes >= earliestMinutes;
  const withinFreeWindow = nowMinutes < 19 * 60;
  const withinOvertimeWindow = overtimeEndMinutes !== null && nowMinutes <= overtimeEndMinutes;

  const canCheckOut = checkedIn && pastEarliest && (withinFreeWindow || withinOvertimeWindow);
  const checkoutNote = !checkedIn
    ? "출근 먼저"
    : !pastEarliest
      ? `${minutesToHHMM(earliestMinutes)} 이후 가능`
      : withinFreeWindow
        ? ""
        : overtimeEndMinutes === null
          ? "19:00 이후는 초과근무 승인 필요"
          : nowMinutes > overtimeEndMinutes
            ? `승인된 초과근무(${overtimeExpectedEndTime}까지) 시간이 지났습니다`
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
