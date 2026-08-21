"use client";

// Design Ref: mockup/pages/index.html renderLeaveScreen() — grid-2(신청 폼 + 신청 내역) + 실시간 미리보기 카드
// (module-12 디자인 정합화). 미리보기 계산은 lib/leave/calc.ts의 순수 함수를 그대로 재사용해 서버 계산과 일치시킨다.
import { useEffect, useMemo, useState } from "react";
import { businessDaysBetween, calcHourlyLeave, listHourlyDurationOptions, listHourlyStartTimeOptions } from "@/lib/leave/calc";
import type { Attachment, CompanySettings, LeaveBalance, LeaveRequest, LeaveTypeConfig } from "@/types";
import DateInput from "@/lib/ui/DateInput";

const CATEGORY_LABEL: Record<string, string> = {
  ANNUAL_DEDUCT: "연차 차감형",
  SPECIAL: "특별휴가",
  OFFICIAL: "공가",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELLED: "취소",
};
const STATUS_PILL: Record<string, string> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

type HistoryItem = LeaveRequest & { attachments: Attachment[] };

function fmtDay(n: number) {
  return `${n % 1 === 0 ? n : n.toFixed(1)}일`;
}

export default function LeaveClient({
  leaveTypes,
  company,
  balance,
  periodYear,
  initialHistory,
}: {
  leaveTypes: LeaveTypeConfig[];
  company: CompanySettings;
  balance: LeaveBalance;
  periodYear: number;
  initialHistory: HistoryItem[];
}) {
  const [history, setHistory] = useState(initialHistory);
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // §4.7 UX 원칙: 수정 폼은 신규 신청 폼을 그대로 재사용하고, 기존 값이 채워진 채로 열린다.
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null);

  const selectedType = useMemo(() => leaveTypes.find((t) => t.id === leaveTypeId), [leaveTypes, leaveTypeId]);
  const typeName = (id: string) => leaveTypes.find((t) => t.id === id)?.name ?? id;
  const remaining = balance.granted - balance.used;

  // Design Ref: module-19 — 연차(시간) 시작시간은 1시간 단위 select, "신청 시간"은 회사 설정 단위시간 배수 select로
  // 제공한다(자유 입력 대신 실제 신청 가능한 조합만 노출). 두 목록 모두 calcHourlyLeave 규칙으로 검증된 값이다.
  const startTimeOptions = useMemo(() => listHourlyStartTimeOptions(company), [company]);
  const durationOptions = useMemo(
    () => (startTime ? listHourlyDurationOptions(startTime, company) : []),
    [startTime, company]
  );

  // 시작시간이 바뀌면(또는 유형 전환 시 처음 진입하면) 항상 유효한 값으로 맞춰준다.
  useEffect(() => {
    if (selectedType?.inputMode !== "HOUR_RANGE") return;
    if (!startTime || !startTimeOptions.includes(startTime)) {
      setStartTime(startTimeOptions[0] ?? "");
      return;
    }
    if (!durationOptions.some((o) => o.endTime === endTime)) {
      setEndTime(durationOptions[0]?.endTime ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, startTime, startTimeOptions, durationOptions]);

  // Design Ref: §4.1 미리보기 — 서버와 동일한 순수 계산 함수를 재사용해 상신 전 차감일수/잔여연차를 보여준다.
  const preview = useMemo(() => {
    if (!selectedType) return null;
    if (selectedType.inputMode === "HOUR_RANGE") {
      if (!startTime || !endTime) return null;
      try {
        const { usedHours, days } = calcHourlyLeave({
          startTime,
          endTime,
          lunchStart: company.lunchStart,
          lunchEnd: company.lunchEnd,
          unitHours: company.hourlyLeaveUnitHours,
          maxHours: company.hourlyLeaveMaxHours,
          standardWorkHoursPerDay: company.standardWorkHoursPerDay,
        });
        return { valid: true, days, usedHours, afterRemaining: remaining - days, error: null as string | null };
      } catch (e) {
        return { valid: false, days: 0, usedHours: 0, afterRemaining: remaining, error: e instanceof Error ? e.message : "유효하지 않은 시간입니다." };
      }
    }
    if (!startDate || !endDate) return null;
    const days = businessDaysBetween(startDate, endDate);
    return {
      valid: days > 0,
      days,
      usedHours: null,
      afterRemaining: remaining - days,
      error: days <= 0 ? "종료일은 시작일 이후여야 합니다." : null,
    };
  }, [selectedType, startDate, endDate, startTime, endTime, company, remaining]);

  const isDeduct = selectedType?.category === "ANNUAL_DEDUCT";
  const insufficientBalance = isDeduct && !!preview && preview.valid && preview.afterRemaining < 0;

  function resetForm() {
    setLeaveTypeId(leaveTypes[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
    setFile(null);
    setEditing(null);
  }

  function startEdit(item: HistoryItem) {
    setEditing({ id: item.id, version: item.version });
    setLeaveTypeId(item.leaveTypeId);
    setStartDate(item.startDate);
    setEndDate(item.endDate);
    setStartTime(item.startTime ?? "");
    setEndTime(item.endTime ?? "");
    setReason(item.reason);
    setFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (editing) {
        const res = await fetch(`/api/leave-requests/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: editing.version,
            startDate,
            endDate: selectedType?.inputMode === "HOUR_RANGE" ? startDate : endDate,
            startTime: selectedType?.inputMode === "HOUR_RANGE" ? startTime : undefined,
            endTime: selectedType?.inputMode === "HOUR_RANGE" ? endTime : undefined,
            reason,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "수정에 실패했습니다.");
          return;
        }
        setHistory((prev) => prev.map((h) => (h.id === editing.id ? { ...h, ...data } : h)));
        resetForm();
        return;
      }

      const form = new FormData();
      form.set("leaveTypeId", leaveTypeId);
      form.set("reason", reason);
      if (selectedType?.inputMode === "HOUR_RANGE") {
        form.set("startDate", startDate);
        form.set("startTime", startTime);
        form.set("endTime", endTime);
      } else {
        form.set("startDate", startDate);
        form.set("endDate", endDate);
      }
      if (file) form.set("attachment", file);

      const res = await fetch("/api/leave-requests", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "신청에 실패했습니다.");
        return;
      }
      resetForm();
      window.location.reload(); // 잔여연차/첨부URL 등 서버 계산값을 정확히 반영하기 위해 새로고침
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecall(id: string) {
    if (!confirm("이 신청을 회수하시겠습니까?")) return;
    const res = await fetch(`/api/leave-requests/${id}/recall`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "회수에 실패했습니다.");
      return;
    }
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, status: data.status } : h)));
  }

  return (
    <div className="grid-2">
      <div className="card card-pad">
        <div className="card-head">
          <h2>{editing ? "연차 신청 수정" : "연차 신청"}</h2>
        </div>
        {editing && (
          <button
            type="button"
            className="btn ghost"
            style={{ margin: "-8px 0 12px", padding: "5px 10px", fontSize: 12.5 }}
            onClick={resetForm}
          >
            ← 수정 취소하고 새 신청으로
          </button>
        )}

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <div className="field">
            <label>신청 유형</label>
            <select className="input" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} disabled={!!editing}>
              {["ANNUAL_DEDUCT", "SPECIAL", "OFFICIAL"].map((cat) => (
                <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                  {leaveTypes
                    .filter((t) => t.category === cat)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.payType === "UNPAID" ? " · 무급" : ""}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {selectedType?.inputMode === "HOUR_RANGE" ? (
            <>
              <div className="field-row">
                <div className="field">
                  <label>날짜</label>
                  <DateInput value={startDate} onChange={setStartDate} required />
                </div>
                <div className="field">
                  <label>시작시간</label>
                  <select className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required>
                    {startTimeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>신청 시간</label>
                  <select className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required disabled={!startTime}>
                    {durationOptions.map((o) => (
                      <option key={o.endTime} value={o.endTime}>
                        {o.hours}시간 (~{o.endTime} 퇴근)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="helptext">
                점심시간({company.lunchStart}~{company.lunchEnd})은 자동 제외됩니다. {company.hourlyLeaveUnitHours}
                시간 단위로만 신청 가능하며, 1회 최대 {company.hourlyLeaveMaxHours}시간까지입니다.
              </p>
            </>
          ) : (
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
          )}

          <div className="field">
            <label>사유</label>
            <textarea className="input" rows={3} placeholder="예: 개인 사유" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>

          {isDeduct && preview && (
            <div className="card" style={{ background: "var(--surface-alt)", border: "1px dashed var(--border-strong)", padding: "14px 16px" }}>
              <div className="kv">
                {selectedType?.inputMode === "HOUR_RANGE" && preview.valid && (
                  <div className="kv-row">
                    <span className="k">사용시간</span>
                    <span className="v num">{preview.usedHours}시간</span>
                  </div>
                )}
                <div className="kv-row">
                  <span className="k">차감 일수</span>
                  <span className="v num">{preview.valid ? fmtDay(preview.days) : "-"}</span>
                </div>
                <div className="kv-row">
                  <span className="k">신청 후 잔여연차</span>
                  <span className="v num" style={insufficientBalance ? { color: "var(--danger)" } : undefined}>
                    {preview.valid ? fmtDay(preview.afterRemaining) : "-"}
                  </span>
                </div>
              </div>
              {preview.error && <p className="helptext" style={{ color: "var(--danger)", marginTop: 8 }}>{preview.error}</p>}
              {insufficientBalance && !preview.error && (
                <p className="helptext" style={{ color: "var(--danger)", marginTop: 8 }}>
                  잔여연차가 부족합니다.
                </p>
              )}
            </div>
          )}

          {!isDeduct && selectedType && <p className="helptext">이 유형은 연차에서 차감되지 않습니다.</p>}
          {selectedType?.payType === "UNPAID" && (
            <span className="pill danger" style={{ alignSelf: "flex-start" }}>
              무급 휴가입니다 — 해당일 급여에서 제외됩니다
            </span>
          )}

          {selectedType?.requireAttachment && !editing && (
            <div className="field">
              <label>
                증빙파일 <span style={{ fontWeight: 400, color: "var(--danger)" }}>(필수)</span> — PDF/PNG/JPG, 10MB 이하
              </label>
              <div className={`upload-box ${file ? "filled" : ""}`}>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
                {file && <span>{file.name}</span>}
              </div>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="btn-row">
            <button type="submit" className="btn primary" disabled={submitting || insufficientBalance}>
              {submitting ? "처리 중…" : editing ? "수정 저장" : "결재 상신"}
            </button>
          </div>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h2>신청 내역</h2>
          <span className="hint" style={{ textAlign: "right" }}>
            잔여 {remaining}일 / 발생 {balance.granted}일 (기준연도 {periodYear})
            <br />
            {/* Design Ref: §4.2, §6 module-10 — 본인 연차 사용 내역 CSV 다운로드 */}
            <a href="/api/reports/leave?scope=self" style={{ color: "var(--accent)" }}>
              CSV 다운로드
            </a>
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>유형</th>
                <th>기간</th>
                <th>일수</th>
                <th>증빙</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    신청 내역이 없습니다.
                  </td>
                </tr>
              )}
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{typeName(h.leaveTypeId)}</td>
                  <td>
                    {h.startTime ? `${h.startDate} ${h.startTime}~${h.endTime}` : `${h.startDate} ~ ${h.endDate}`}
                  </td>
                  <td>{h.days}일</td>
                  <td>
                    {h.attachments.length > 0 ? (
                      h.attachments.map((a) =>
                        a.fileUrl ? (
                          <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                            {a.fileName}
                          </a>
                        ) : (
                          <span key={a.id}>{a.fileName}</span>
                        )
                      )
                    ) : (
                      <span style={{ color: "var(--text-faint)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${STATUS_PILL[h.status]}`}>{STATUS_LABEL[h.status]}</span>
                    {h.editedAt && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-faint)" }}>수정됨</span>}
                  </td>
                  <td>
                    {h.status === "PENDING" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => startEdit(h)}>
                          수정
                        </button>
                        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => handleRecall(h.id)}>
                          회수
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
