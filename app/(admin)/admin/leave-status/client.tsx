"use client";

// Design Ref: 목업에는 관리자용 연차 현황 화면이 없어(module-13 신설) 사용자 관리 등 다른 관리 화면에서
// 정립한 카드+card-head+테이블 디자인 언어를 동일하게 적용한다.
// 연차산정기준(연차정책설정 §전사 연차산정기준)에 따라 의미 있는 조회 방식이 달라진다.
// - 회계연도 기준: 전 직원이 1/1~12/31 동일 주기로 리셋되므로 "조회 연도" 선택이 그대로 유효하다.
// - 입사일 기준: 직원마다 입사월이 달라 갱신 시점(연차 산정연도)이 제각각이라 "연도별 조회"가 의미 없다.
//   대신 항상 오늘 기준 현재 잔여현황만 보여주고, 연도 대신 근속연수를 함께 표시해 해석 기준을 맞춘다.
import { useEffect, useState } from "react";
import type { LeaveBasis } from "@/types";

interface StatusRow {
  userId: string;
  userName: string;
  hireDate: string;
  deptName: string;
  position: string;
  granted: number;
  used: number;
  remaining: number;
  pendingCount: number;
}

const BASIS_LABEL: Record<LeaveBasis, string> = { FISCAL_YEAR: "회계연도 기준", HIRE_DATE: "입사일 기준" };

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1];

/** 표시용 근속연수(만 년/개월) — 실제 발생일수 계산(lib/leave/calc.ts)과는 별개의 화면 보조 정보다. */
function formatTenure(hireDate: string): string {
  const hire = new Date(hireDate + "T00:00:00");
  if (Number.isNaN(hire.getTime())) return "—";
  const today = new Date();
  let months = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth());
  if (today.getDate() < hire.getDate()) months -= 1;
  if (months < 0) return "입사 전";
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return years > 0 ? `${years}년 ${remMonths}개월` : `${remMonths}개월`;
}

export default function LeaveStatusClient({ initialBasis }: { initialBasis: LeaveBasis }) {
  const isHireDateBasis = initialBasis === "HIRE_DATE";
  // 입사일 기준에서는 연도 선택이 의미 없으므로 항상 "오늘 기준" 현재 연도로 고정한다.
  const [year, setYear] = useState(THIS_YEAR);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/leave-status?year=${isHireDateBasis ? THIS_YEAR : year}`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [year, isHireDateBasis]);

  const filtered = rows.filter((r) => !q.trim() || r.userName.includes(q.trim()) || r.deptName.includes(q.trim()));
  const totalGranted = rows.reduce((sum, r) => sum + r.granted, 0);
  const totalUsed = rows.reduce((sum, r) => sum + r.used, 0);
  const totalPending = rows.reduce((sum, r) => sum + r.pendingCount, 0);

  return (
    <div className="stack">
      <div className="card card-pad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="pill neutral">연차산정기준: {BASIS_LABEL[initialBasis]}</span>
            {isHireDateBasis ? (
              <span className="hint">직원마다 입사월이 달라 연도 선택 대신 오늘 기준 현재 잔여현황을 표시합니다.</span>
            ) : (
              <>
                <label htmlFor="lst-year" style={{ margin: 0 }}>
                  조회 연도
                </label>
                <select id="lst-year" className="input" style={{ width: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </>
            )}
            <input
              className="input"
              style={{ width: 180 }}
              placeholder="이름·부서 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <a href="/api/reports/leave?scope=all" className="btn ghost" style={{ fontSize: 12.5 }}>
            전사 CSV 다운로드
          </a>
        </div>
        <p className="helptext" style={{ marginTop: 10 }}>
          연차산정기준은 연차정책설정 화면에서 변경할 수 있습니다.
        </p>
      </div>

      <div className="grid-stats-4">
        <div className="card stat">
          <div className="label">대상 인원</div>
          <div className="value num">
            {rows.length}
            <small>명</small>
          </div>
        </div>
        <div className="card stat">
          <div className="label">부여 합계</div>
          <div className="value num">
            {totalGranted}
            <small>일</small>
          </div>
        </div>
        <div className="card stat">
          <div className="label">사용 합계</div>
          <div className="value num">
            {totalUsed}
            <small>일</small>
          </div>
        </div>
        <div className="card stat">
          <div className="label">대기중 건수</div>
          <div className="value num">
            {totalPending}
            <small>건</small>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>직원별 연차 현황</h2>
          <span className="hint">{isHireDateBasis ? "오늘 기준" : `${year}년`}</span>
        </div>
        {loading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>}
        {!loading && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>입사일</th>
                  {isHireDateBasis && <th>근속연수</th>}
                  <th>부서</th>
                  <th>직급</th>
                  <th>부여일수</th>
                  <th>사용일수</th>
                  <th>잔여일수</th>
                  <th>대기중</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isHireDateBasis ? 9 : 8} className="empty">
                      해당하는 직원이 없습니다.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.userName}</td>
                    <td>{r.hireDate}</td>
                    {isHireDateBasis && <td>{formatTenure(r.hireDate)}</td>}
                    <td>{r.deptName}</td>
                    <td>{r.position || "—"}</td>
                    <td className="num">{r.granted}일</td>
                    <td className="num">{r.used}일</td>
                    <td className="num">
                      <span className={`pill ${r.remaining <= 0 ? "danger" : "success"}`}>{r.remaining}일</span>
                    </td>
                    <td className="num">{r.pendingCount > 0 ? <span className="pill warning">{r.pendingCount}건</span> : "—"}</td>
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
