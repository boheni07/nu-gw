"use client";

// Design Ref: mockup/pages/index.html renderBusinessTripScreen() — grid-2(신청 폼 + 신청 내역) +
// 관내/시외 구분에 따른 조건부 입력 구조로 정리(module-13)
import { useState } from "react";
import type { BusinessTrip } from "@/types";
import DateInput from "@/lib/ui/DateInput";

const TRANSPORT_OPTIONS = ["KTX", "고속버스", "항공", "자가용", "법인차량"];
const TYPE_LABEL: Record<BusinessTrip["tripType"], string> = { LOCAL: "관내", OUT_OF_TOWN: "시외" };
const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", RECALLED: "취소" };
const STATUS_PILL: Record<string, string> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", RECALLED: "neutral" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BusinessTripClient({ initialHistory }: { initialHistory: BusinessTrip[] }) {
  const [history, setHistory] = useState(initialHistory);
  const [tripType, setTripType] = useState<BusinessTrip["tripType"]>("OUT_OF_TOWN");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [localDate, setLocalDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOut = tripType === "OUT_OF_TOWN";
  const localTimeInvalid = !isOut && !!startTime && !!endTime && endTime <= startTime;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (localTimeInvalid) return;
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      const body: Record<string, string> = {
        tripType,
        destination: String(form.get("destination") ?? ""),
        purpose: String(form.get("purpose") ?? ""),
      };
      if (isOut) {
        body.startDate = startDate;
        body.endDate = endDate;
        body.transport = String(form.get("transport") ?? "");
      } else {
        body.startDate = localDate;
        body.startTime = startTime;
        body.endTime = endTime;
      }

      const res = await fetch("/api/business-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "신청에 실패했습니다.");
        return;
      }
      setHistory((prev) => [data, ...prev]);
      (e.target as HTMLFormElement).reset();
      setStartDate(todayStr());
      setEndDate(todayStr());
      setLocalDate(todayStr());
      setStartTime("10:00");
      setEndTime("12:00");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("이 출장신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/business-trips/${id}/recall`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "취소에 실패했습니다.");
      return;
    }
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status: data.status } : h)));
  }

  return (
    <div className="grid-2">
      <div className="card card-pad">
        <div className="card-head">
          <h2>출장신청</h2>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field">
            <label>출장 구분</label>
            <select className="input" value={tripType} onChange={(e) => setTripType(e.target.value as BusinessTrip["tripType"])}>
              <option value="LOCAL">관내출장</option>
              <option value="OUT_OF_TOWN">시외출장</option>
            </select>
          </div>

          {isOut ? (
            <div className="field-row">
              <div className="field">
                <label>시작일</label>
                <DateInput value={startDate} onChange={setStartDate} required />
              </div>
              <div className="field">
                <label>종료일</label>
                <DateInput value={endDate} onChange={setEndDate} required />
              </div>
            </div>
          ) : (
            <div className="field-row">
              <div className="field">
                <label>날짜</label>
                <DateInput value={localDate} onChange={setLocalDate} required />
              </div>
              <div className="field">
                <label>시작시간</label>
                <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>종료시간</label>
                <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>
          )}
          {localTimeInvalid && <p className="helptext" style={{ color: "var(--danger)", marginTop: -8 }}>종료시간은 시작시간보다 늦어야 합니다.</p>}

          <div className="field">
            <label>출장지</label>
            <input name="destination" className="input" placeholder="예: 부산 해운대" required />
          </div>

          {isOut && (
            <>
              <div className="field">
                <label>교통편(예정)</label>
                <select name="transport" className="input" defaultValue={TRANSPORT_OPTIONS[0]}>
                  {TRANSPORT_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <p className="helptext" style={{ margin: "-6px 0 0" }}>
                시외출장은 완료 후 3일 이내 "출장결과보고" 메뉴에서 출장비 청구와 함께 결과보고서를 작성해야 합니다.
              </p>
            </>
          )}

          <div className="field">
            <label>출장 목적/내용</label>
            <textarea name="purpose" className="input" rows={3} placeholder="예: 거래처 미팅 및 현장 실사" required />
          </div>

          {error && <p className="error-text">{error}</p>}
          <div className="btn-row">
            <button type="submit" className="btn primary" disabled={submitting || localTimeInvalid}>
              {submitting ? "상신 중…" : "결재 상신"}
            </button>
          </div>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>신청 내역</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>구분</th>
                <th>기간</th>
                <th>출장지</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    신청 내역이 없습니다.
                  </td>
                </tr>
              )}
              {history.map((t) => {
                const period = t.tripType === "LOCAL" ? `${t.startDate} ${t.startTime}~${t.endTime}` : `${t.startDate} ~ ${t.endDate}`;
                return (
                  <tr key={t.id}>
                    <td>
                      <span className="pill neutral">{TYPE_LABEL[t.tripType]}</span>
                    </td>
                    <td className="num">{period}</td>
                    <td>{t.destination}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {t.status === "PENDING" && (
                        <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={() => handleCancel(t.id)}>
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
