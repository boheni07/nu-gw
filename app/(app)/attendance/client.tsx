"use client";

// Design Ref: mockup/pages/index.html renderAttendanceScreen()/renderAttendanceSummaryStats()/renderAttendanceDailyTable()
// — 조회 카드 + 통계 stat 카드 + 일자별(날짜/요일 분리) 테이블 구조(module-12 디자인 정합화).
// 관리자를 포함해 누구나 본인 근태만 조회한다(타 직원 조회 기능 제거 — 사용자 요청).
import { useEffect, useState } from "react";

interface Day {
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  autoCheckedOut: boolean;
  leave: { typeName: string; payType: "PAID" | "UNPAID" } | null;
}
interface MonthlyDetail {
  days: Day[];
  workDays: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  uncheckedDays: number;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function weekdayLabel(dateStr: string) {
  return WEEKDAYS[new Date(dateStr + "T00:00:00").getDay()];
}

export default function AttendanceClient() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  const [detail, setDetail] = useState<MonthlyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/attendance?month=${month}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .finally(() => setLoading(false));
  }, [month]);

  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack">
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label htmlFor="att-month" style={{ margin: 0 }}>
            조회 년월
          </label>
          <input id="att-month" type="month" className="input" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {/* Design Ref: §4.2, §6 module-10 — 본인 근태 이력 CSV 다운로드 */}
        <a href={`/api/reports/attendance?month=${month}&scope=self`} className="btn ghost" style={{ fontSize: 12.5 }}>
          CSV 다운로드
        </a>
      </div>

      {loading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>}

      {!loading && detail && (
        <>
          <div className="grid-stats">
            <div className="card stat">
              <div className="label">출근일수</div>
              <div className="value num">
                {detail.workDays}
                <small>일</small>
              </div>
            </div>
            <div className="card stat">
              <div className="label">휴가일수</div>
              <div className="value num">
                {detail.leaveDays}
                <small>일</small>
              </div>
              {detail.unpaidLeaveDays > 0 && <div className="delta">무급 {detail.unpaidLeaveDays}일 포함</div>}
            </div>
            <div className="card stat">
              <div className="label">미체크일수</div>
              <div className="value num">
                {detail.uncheckedDays}
                <small>일</small>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h2>일자별 근태</h2>
              <span className="hint">{month}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>요일</th>
                    <th>출근</th>
                    <th>퇴근</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.days.map((d) => {
                    const inProgress = !!d.checkInAt && !d.checkOutAt && !d.autoCheckedOut;
                    return (
                      <tr key={d.date}>
                        <td className="num">
                          {d.date}
                          {d.date === todayKey ? " (오늘)" : ""}
                        </td>
                        <td>{weekdayLabel(d.date)}</td>
                        <td className="num">{fmtTime(d.checkInAt)}</td>
                        <td className="num">
                          {fmtTime(d.checkOutAt)}
                          {d.autoCheckedOut && (
                            <span className="pill neutral" style={{ marginLeft: 6, padding: "1px 7px" }}>
                              자동
                            </span>
                          )}
                        </td>
                        <td>
                          {d.leave ? (
                            <span className="pill neutral">
                              {d.leave.typeName}
                              {d.leave.payType === "UNPAID" && (
                                <span className="pill danger" style={{ marginLeft: 6, padding: "1px 7px" }}>
                                  무급
                                </span>
                              )}
                            </span>
                          ) : inProgress ? (
                            <span className="pill warning">근무중</span>
                          ) : d.checkInAt ? (
                            <span className="pill success">정상</span>
                          ) : (
                            <span className="pill warning">미체크</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
