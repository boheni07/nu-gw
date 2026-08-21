"use client";

// Design Ref: 목업에는 관리자용 근태 현황 화면이 없어(module-13 신설) 사용자 관리 등 다른 관리 화면에서
// 정립한 카드+card-head+테이블+상세 패널 디자인 언어를 동일하게 적용한다.
import { useEffect, useState } from "react";
import { CloseIcon } from "@/lib/ui/icons";

interface StatusRow {
  userId: string;
  userName: string;
  deptName: string;
  position: string;
  workDays: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  uncheckedDays: number;
}

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

export default function AttendanceStatusClient() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [detailUser, setDetailUser] = useState<StatusRow | null>(null);
  const [detail, setDetail] = useState<MonthlyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/attendance-status?month=${month}`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [month]);

  function openDetail(row: StatusRow) {
    setDetailUser(row);
    setDetail(null);
    setDetailLoading(true);
    fetch(`/api/admin/attendance-status/${row.userId}?month=${month}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .finally(() => setDetailLoading(false));
  }

  const filtered = rows.filter((r) => !q.trim() || r.userName.includes(q.trim()) || r.deptName.includes(q.trim()));
  const totalUnchecked = rows.reduce((sum, r) => sum + r.uncheckedDays, 0);

  return (
    <div className="stack">
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label htmlFor="ast-month" style={{ margin: 0 }}>
            조회 년월
          </label>
          <input id="ast-month" type="month" className="input" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
          <input
            className="input"
            style={{ width: 180 }}
            placeholder="이름·부서 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <a href={`/api/reports/attendance?month=${month}&scope=all`} className="btn ghost" style={{ fontSize: 12.5 }}>
          전사 CSV 다운로드
        </a>
      </div>

      <div className="grid-stats">
        <div className="card stat">
          <div className="label">대상 인원</div>
          <div className="value num">
            {rows.length}
            <small>명</small>
          </div>
        </div>
        <div className="card stat">
          <div className="label">미체크 합계</div>
          <div className="value num">
            {totalUnchecked}
            <small>건</small>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>직원별 근태 현황</h2>
          <span className="hint">{month}</span>
        </div>
        {loading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>}
        {!loading && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>부서</th>
                  <th>직급</th>
                  <th>출근일수</th>
                  <th>휴가일수</th>
                  <th>미체크일수</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      해당하는 직원이 없습니다.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.userName}</td>
                    <td>{r.deptName}</td>
                    <td>{r.position || "—"}</td>
                    <td className="num">{r.workDays}일</td>
                    <td className="num">
                      {r.leaveDays}일
                      {r.unpaidLeaveDays > 0 && (
                        <span className="pill danger" style={{ marginLeft: 6, padding: "1px 7px" }}>
                          무급 {r.unpaidLeaveDays}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {r.uncheckedDays > 0 ? <span className="pill warning">{r.uncheckedDays}일</span> : <span className="pill success">0일</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="btn ghost" onClick={() => openDetail(r)}>
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailUser && (
        <div className="overlay" onClick={() => setDetailUser(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>
                {detailUser.userName} <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>({detailUser.deptName})</span>
              </h2>
              <button type="button" className="icon-btn" onClick={() => setDetailUser(null)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            {detailLoading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>}
            {!detailLoading && detail && (
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
                          <td className="num">{d.date}</td>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
