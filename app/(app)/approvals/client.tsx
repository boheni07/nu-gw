"use client";

// Design Ref: mockup/pages/index.html renderApprovalsScreen()/renderApprovalPanel() — 탭 + 유형 필터 + 상세 패널
import { useMemo, useState } from "react";
import type { DocumentType } from "@/types";
import { CloseIcon } from "@/lib/ui/icons";

export interface ApprovalRow {
  approvalId: string;
  targetType: DocumentType;
  submitterName: string;
  departmentName: string;
  summary: string;
  dateLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isDelegated: boolean;
  comment: string | null;
  fields: { k: string; v: string }[];
  stepInfo: string | null;
}

const TYPE_LABEL: Record<DocumentType, string> = {
  LEAVE: "연차",
  DAILY_REPORT: "일일업무보고",
  WEEKLY_REPORT: "주간업무보고",
  OVERTIME: "초과근무",
  TRIP: "출장신청",
  TRIP_REPORT: "출장결과보고",
};
const TYPE_FILTERS: { key: DocumentType | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "LEAVE", label: "연차" },
  { key: "DAILY_REPORT", label: "일일보고" },
  { key: "WEEKLY_REPORT", label: "주간보고" },
  { key: "OVERTIME", label: "초과근무" },
  { key: "TRIP", label: "출장신청" },
  { key: "TRIP_REPORT", label: "출장결과보고" },
];
const STATUS_PILL: Record<string, string> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };
const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function ApprovalsClient({ pending: initialPending, processed }: { pending: ApprovalRow[]; processed: ApprovalRow[] }) {
  const [pending, setPending] = useState(initialPending);
  const [tab, setTab] = useState<"PENDING" | "DONE">("PENDING");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "ALL">("ALL");
  const [detail, setDetail] = useState<ApprovalRow | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const items = tab === "PENDING" ? pending : processed;
  const filtered = useMemo(
    () => (typeFilter === "ALL" ? items : items.filter((a) => a.targetType === typeFilter)),
    [items, typeFilter]
  );

  function openDetail(row: ApprovalRow) {
    setDetail(row);
    setComment("");
  }

  async function handleAction(action: "approve" | "reject") {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/${detail.approvalId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "처리에 실패했습니다.");
        return;
      }
      setPending((prev) => prev.filter((a) => a.approvalId !== detail.approvalId));
      setDetail(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="tabs">
        <button type="button" className={`tab${tab === "PENDING" ? " active" : ""}`} onClick={() => setTab("PENDING")}>
          대기 중{pending.length > 0 ? ` (${pending.length})` : ""}
        </button>
        <button type="button" className={`tab${tab === "DONE" ? " active" : ""}`} onClick={() => setTab("DONE")}>
          처리완료
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="btn ghost"
              style={{
                padding: "6px 12px",
                background: typeFilter === f.key ? "var(--accent-soft)" : undefined,
                color: typeFilter === f.key ? "var(--accent-strong)" : undefined,
                fontWeight: typeFilter === f.key ? 700 : undefined,
              }}
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Design Ref: §4.2, §6 module-10 — 본인 처리 이력 CSV 다운로드 */}
        <a href="/api/reports/approvals?scope=processed" className="hint" style={{ color: "var(--accent)" }}>
          처리 이력 CSV 다운로드
        </a>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">해당하는 결재 건이 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>유형</th>
                <th>신청자</th>
                <th>내용</th>
                <th>{tab === "PENDING" ? "상신일" : "처리일"}</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.approvalId + a.dateLabel}>
                  <td>
                    <span className="pill neutral">{TYPE_LABEL[a.targetType]}</span>
                    {a.isDelegated && (
                      <span className="pill admin" style={{ marginLeft: 6, fontSize: 10.5 }}>
                        대결
                      </span>
                    )}
                  </td>
                  <td>
                    {a.submitterName} <span style={{ color: "var(--text-faint)" }}>· {a.departmentName}</span>
                  </td>
                  <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.summary}</td>
                  <td className="num">{fmtDate(a.dateLabel)}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn ghost" onClick={() => openDetail(a)}>
                      {a.status === "PENDING" ? "검토" : "상세"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <span className="pill neutral">{TYPE_LABEL[detail.targetType]}</span>
                {detail.isDelegated && (
                  <span className="pill admin" style={{ marginLeft: 6 }}>
                    대결
                  </span>
                )}
                <h2 style={{ marginTop: 10, fontSize: 17 }}>{detail.summary}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setDetail(null)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>

            <div className="kv">
              <div className="kv-row">
                <span className="k">신청자</span>
                <span className="v">
                  {detail.submitterName} · {detail.departmentName}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">{detail.status === "PENDING" ? "상신일" : "처리일"}</span>
                <span className="v num">{fmtDate(detail.dateLabel)}</span>
              </div>
              {detail.stepInfo && (
                <div className="kv-row">
                  <span className="k">진행 단계</span>
                  <span className="v num">{detail.stepInfo}</span>
                </div>
              )}
              <div className="kv-row">
                <span className="k">상태</span>
                <span className={`pill ${STATUS_PILL[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
              </div>
            </div>

            <hr className="divider" />

            <div className="kv">
              {detail.fields.map((f) => (
                <div key={f.k} className="kv-row" style={{ alignItems: "flex-start" }}>
                  <span className="k">{f.k}</span>
                  <span className="v" style={{ textAlign: "right", whiteSpace: "pre-wrap" }}>
                    {f.v}
                  </span>
                </div>
              ))}
            </div>

            {detail.status === "PENDING" ? (
              <>
                <div className="field">
                  <label>
                    결재 의견 <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(선택)</span>
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="의견을 입력하세요"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div className="btn-row" style={{ justifyContent: "stretch" }}>
                  <button type="button" className="btn danger-o" style={{ flex: 1 }} disabled={busy} onClick={() => handleAction("reject")}>
                    반려
                  </button>
                  <button type="button" className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={() => handleAction("approve")}>
                    승인
                  </button>
                </div>
              </>
            ) : (
              <div>
                <span className={`stamp${detail.status === "REJECTED" ? " reject" : ""}`}>
                  {STATUS_LABEL[detail.status]} · {fmtDate(detail.dateLabel)}
                </span>
                {detail.comment && <div className="body-box" style={{ marginTop: 12 }}>&quot;{detail.comment}&quot;</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
