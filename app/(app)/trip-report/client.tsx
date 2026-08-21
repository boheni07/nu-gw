"use client";

// Design Ref: mockup/pages/index.html renderTripReportScreen() — grid-2(출장 목록 + 상세/작성 패널),
// 교통비/숙박비(조건부)/일비·식비(자동계산) 구조로 정리(module-13)
import { useState } from "react";
import type { BusinessTrip, TripReport } from "@/types";
import { calendarDaysBetween, tripReportDueInfo } from "@/lib/trip/calc";
import MoneyInput from "@/lib/ui/MoneyInput";

const TRANSPORT_OPTIONS = ["KTX", "고속버스", "항공", "자가용", "법인차량"];
const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", RECALLED: "회수" };
const STATUS_PILL: Record<string, string> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", RECALLED: "neutral" };

export interface TripRow {
  trip: BusinessTrip;
  report: TripReport | null;
  due: { dueKey: string; daysLeft: number; overdue: boolean };
}

export default function TripReportClient({
  initialRows,
  dailyAllowanceRate,
  mealAllowanceRate,
  lodgingCapPerNight,
}: {
  initialRows: TripRow[];
  dailyAllowanceRate: number;
  mealAllowanceRate: number;
  lodgingCapPerNight: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.trip.id ?? null);
  const [transport, setTransport] = useState(TRANSPORT_OPTIONS[0]);
  const [transportCost, setTransportCost] = useState(0);
  const [transportFile, setTransportFile] = useState<File | null>(null);
  const [hasLodging, setHasLodging] = useState(false);
  const [lodgingCost, setLodgingCost] = useState(0);
  const [lodgingFile, setLodgingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = rows.find((r) => r.trip.id === selectedId) ?? null;
  const tripDays = selected ? calendarDaysBetween(selected.trip.startDate, selected.trip.endDate) : 0;
  const lodgingNights = Math.max(tripDays - 1, 0);
  const lodgingCap = lodgingCapPerNight * lodgingNights;
  const autoDaily = dailyAllowanceRate * tripDays;
  const autoMeal = mealAllowanceRate * tripDays;
  const total = transportCost + (hasLodging ? Math.min(lodgingCost, lodgingCap || lodgingCost) : 0) + autoDaily + autoMeal;

  function selectTrip(row: TripRow) {
    setSelectedId(row.trip.id);
    setTransport(row.trip.transport ?? TRANSPORT_OPTIONS[0]);
    setTransportCost(0);
    setTransportFile(null);
    setHasLodging(false);
    setLodgingCost(0);
    setLodgingFile(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const workContent = (e.currentTarget.elements.namedItem("workContent") as HTMLTextAreaElement)?.value.trim() ?? "";
    if (!workContent) {
      setError("출장업무 처리내용을 입력하세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("tripId", selected.trip.id);
      form.set("workContent", workContent);
      form.set("transport", transport);
      form.set("transportCost", String(transportCost));
      form.set("hasLodging", String(hasLodging));
      form.set("lodgingCost", String(hasLodging ? lodgingCost : 0));
      if (transportFile) form.set("transportFile", transportFile);
      if (hasLodging && lodgingFile) form.set("lodgingFile", lodgingFile);

      const res = await fetch("/api/trip-reports", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "상신에 실패했습니다.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.trip.id === selected.trip.id ? { ...r, report: data } : r)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid-2">
      <div className="card card-pad">
        <div className="card-head">
          <h2>출장 목록</h2>
          <span className="hint">완료된 시외출장</span>
        </div>
        {rows.length === 0 && <div className="empty">결과보고 대상 출장이 없습니다.</div>}
        <div className="stack" style={{ gap: 4 }}>
          {rows.map((row) => {
            const isActive = row.trip.id === selectedId;
            let statusTag: React.ReactNode;
            if (row.report) {
              statusTag = <span className={`pill ${STATUS_PILL[row.report.status]}`}>{STATUS_LABEL[row.report.status]}</span>;
            } else if (row.due.overdue) {
              statusTag = <span className="pill danger">기한초과</span>;
            } else {
              statusTag = <span className="pill warning">미작성 (D-{row.due.daysLeft})</span>;
            }
            return (
              <div
                key={row.trip.id}
                className="list-row"
                style={{
                  cursor: "pointer",
                  alignItems: "flex-start",
                  background: isActive ? "var(--accent-soft)" : undefined,
                  borderRadius: isActive ? "var(--r-sm)" : undefined,
                  paddingLeft: isActive ? 8 : undefined,
                  paddingRight: isActive ? 8 : undefined,
                }}
                onClick={() => selectTrip(row)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{row.trip.destination}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>
                    {row.trip.startDate} ~ {row.trip.endDate}
                  </div>
                </div>
                {statusTag}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card card-pad">
        {!selected ? (
          <div className="empty">좌측 목록에서 출장 건을 선택하세요.</div>
        ) : selected.report ? (
          (() => {
            const r = selected.report;
            const rTotal = r.transportCost + r.lodgingCost + r.dailyAllowance + r.mealAllowance;
            return (
              <>
                <div className="card-head">
                  <h2>{selected.trip.destination} 결과보고</h2>
                  <span className={`pill ${STATUS_PILL[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div className="kv-row">
                  <span className="k">출장 기간</span>
                  <span className="v num">
                    {selected.trip.startDate} ~ {selected.trip.endDate}
                  </span>
                </div>
                <div className="kv-row" style={{ marginTop: 8 }}>
                  <span className="k">교통편</span>
                  <span className="v">{r.transport || "-"}</span>
                </div>
                <div className="kv-row" style={{ marginTop: 8 }}>
                  <span className="k">교통비</span>
                  <span className="v num">{r.transportCost.toLocaleString()}원</span>
                </div>
                <div className="kv-row" style={{ marginTop: 8 }}>
                  <span className="k">숙박비</span>
                  <span className="v num">{r.hasLodging ? `${r.lodgingCost.toLocaleString()}원` : "해당없음"}</span>
                </div>
                <div className="kv-row" style={{ marginTop: 8 }}>
                  <span className="k">일비</span>
                  <span className="v num">{r.dailyAllowance.toLocaleString()}원</span>
                </div>
                <div className="kv-row" style={{ marginTop: 8 }}>
                  <span className="k">식비</span>
                  <span className="v num">{r.mealAllowance.toLocaleString()}원</span>
                </div>
                <div className="kv-row" style={{ marginTop: 8 }}>
                  <span className="k">합계 청구액</span>
                  <span className="v num" style={{ color: "var(--accent-strong)" }}>
                    {rTotal.toLocaleString()}원
                  </span>
                </div>
                <hr className="divider" style={{ margin: "14px 0" }} />
                <div className="field">
                  <label>출장업무 처리내용</label>
                  <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{r.workContent}</p>
                </div>
                {r.transportAttachment && (
                  <div className="field">
                    <label>교통비 증빙</label>
                    <a href={r.transportAttachment.fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13 }}>
                      {r.transportAttachment.fileName}
                    </a>
                  </div>
                )}
                {r.hasLodging && r.lodgingAttachment && (
                  <div className="field">
                    <label>숙박비 증빙</label>
                    <a href={r.lodgingAttachment.fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 13 }}>
                      {r.lodgingAttachment.fileName}
                    </a>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <>
            <div className="card-head">
              <h2>출장결과보고 작성</h2>
              <span className="hint">
                {selected.trip.destination} · {tripDays}일
              </span>
            </div>
            <div className={selected.due.overdue ? "pill danger" : "badge-auto"} style={{ marginBottom: 14 }}>
              {selected.due.overdue
                ? `제출 기한(${selected.due.dueKey})이 지났습니다`
                : `제출 기한 ${selected.due.dueKey} 까지 (D-${selected.due.daysLeft})`}
            </div>

            <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
              <div className="field">
                <label>출장업무 처리내용</label>
                <textarea name="workContent" className="input" rows={4} placeholder="출장에서 수행한 업무와 결과를 입력하세요" required />
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>교통비</div>
              <div className="field-row">
                <div className="field">
                  <label>교통편</label>
                  <select className="input" value={transport} onChange={(e) => setTransport(e.target.value)}>
                    {TRANSPORT_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>교통비(원)</label>
                  <MoneyInput value={transportCost} onChange={setTransportCost} />
                </div>
              </div>
              <div className="field">
                <label>교통비 증빙자료</label>
                <div className={`upload-box ${transportFile ? "filled" : ""}`}>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setTransportFile(e.target.files?.[0] ?? null)} />
                  {transportFile && <span>{transportFile.name}</span>}
                </div>
              </div>

              <hr className="divider" />
              <label className="checkbox-row">
                <input type="checkbox" checked={hasLodging} onChange={(e) => setHasLodging(e.target.checked)} />
                <span>숙박 있음</span>
              </label>
              {hasLodging && (
                <>
                  <div className="field">
                    <label>숙박비(원)</label>
                    <MoneyInput value={lodgingCost} onChange={setLodgingCost} />
                    {lodgingCap > 0 && (
                      <p className="helptext">
                        상한액 {lodgingCapPerNight.toLocaleString()}원/박 × {lodgingNights}박 = {lodgingCap.toLocaleString()}원까지 인정됩니다(초과분은 자동으로 반영되지 않습니다).
                      </p>
                    )}
                  </div>
                  <div className="field">
                    <label>숙박비 증빙자료</label>
                    <div className={`upload-box ${lodgingFile ? "filled" : ""}`}>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setLodgingFile(e.target.files?.[0] ?? null)} />
                      {lodgingFile && <span>{lodgingFile.name}</span>}
                    </div>
                  </div>
                </>
              )}

              <hr className="divider" />
              <div className="card" style={{ background: "var(--surface-alt)" }}>
                <div className="kv" style={{ padding: "12px 16px" }}>
                  <div className="kv-row">
                    <span className="k">
                      일비 ({dailyAllowanceRate.toLocaleString()}원 × {tripDays}일)
                    </span>
                    <span className="v num">{autoDaily.toLocaleString()}원</span>
                  </div>
                  <div className="kv-row" style={{ marginTop: 6 }}>
                    <span className="k">
                      식비 ({mealAllowanceRate.toLocaleString()}원 × {tripDays}일)
                    </span>
                    <span className="v num">{autoMeal.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
              <div className="card" style={{ background: "var(--surface-alt)", border: "1px dashed var(--border-strong)" }}>
                <div className="kv-row" style={{ padding: "12px 16px" }}>
                  <span className="k">합계 청구액</span>
                  <span className="v num">{total.toLocaleString()}원</span>
                </div>
              </div>

              {error && <p className="error-text">{error}</p>}
              <div className="btn-row">
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? "상신 중…" : "결재 상신"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
