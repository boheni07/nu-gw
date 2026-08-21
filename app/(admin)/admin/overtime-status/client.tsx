"use client";

// Design Ref: 목업에는 관리자용 초과근무 현황 화면이 없어(module-13 신설) 사용자 관리 등 다른 관리 화면에서
// 정립한 카드+card-head+테이블 디자인 언어를 동일하게 적용한다.
import { useEffect, useState } from "react";

interface StatusRow {
  id: string;
  userId: string;
  userName: string;
  deptName: string;
  date: string;
  expectedEndTime: string;
  workDetail: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", RECALLED: "회수" };
const STATUS_PILL: Record<string, string> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", RECALLED: "neutral" };

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function OvertimeStatusClient() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  const [status, setStatus] = useState<"ALL" | StatusRow["status"]>("ALL");
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/overtime-status?month=${month}`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [month]);

  const filtered = rows.filter(
    (r) => (status === "ALL" || r.status === status) && (!q.trim() || r.userName.includes(q.trim()) || r.deptName.includes(q.trim()))
  );
  const approvedCount = rows.filter((r) => r.status === "APPROVED").length;
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div className="stack">
      <div className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label htmlFor="ost-month" style={{ margin: 0 }}>
            조회 년월
          </label>
          <input id="ost-month" type="month" className="input" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
          <select className="input" style={{ width: 120 }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="ALL">전체 상태</option>
            <option value="PENDING">대기</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">반려</option>
            <option value="RECALLED">회수</option>
          </select>
          <input
            className="input"
            style={{ width: 180 }}
            placeholder="이름·부서 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="grid-stats">
        <div className="card stat">
          <div className="label">신청 건수</div>
          <div className="value num">
            {rows.length}
            <small>건</small>
          </div>
        </div>
        <div className="card stat">
          <div className="label">승인 건수</div>
          <div className="value num">
            {approvedCount}
            <small>건</small>
          </div>
        </div>
        <div className="card stat">
          <div className="label">대기중</div>
          <div className="value num">
            {pendingCount}
            <small>건</small>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>초과근무 신청 현황</h2>
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
                  <th>날짜</th>
                  <th>예상 퇴근</th>
                  <th>업무내용</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      해당하는 신청 건이 없습니다.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.userName}</td>
                    <td>{r.deptName}</td>
                    <td className="num">{r.date}</td>
                    <td className="num">{r.expectedEndTime}</td>
                    <td style={{ maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.workDetail}>
                      {r.workDetail}
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
