"use client";

// Design Ref: 목업에는 관리자용 인사기록 관리 화면이 없어(module-15 신설) 다른 관리 화면에서 정립한
// 카드+card-head+테이블+상세 전환 디자인 언어를 동일하게 적용한다.
import { useState } from "react";
import type { HrRecord } from "@/types";
import HrRecordForm from "@/app/(app)/hr-record/form";
import { ChevronIcon } from "@/lib/ui/icons";

export interface HrRecordRow {
  userId: string;
  userName: string;
  deptName: string;
  position: string;
  written: boolean;
  savedAt: string | null;
}

export default function HrRecordsAdminClient({ initialRows }: { initialRows: HrRecordRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<HrRecordRow | null>(null);
  const [record, setRecord] = useState<HrRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = rows.filter((r) => !q.trim() || r.userName.includes(q.trim()) || r.deptName.includes(q.trim()));
  const writtenCount = rows.filter((r) => r.written).length;

  async function openDetail(row: HrRecordRow) {
    setSelected(row);
    setRecord(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hr-records/${row.userId}`);
      const data = await res.json();
      setRecord(data);
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <div className="stack">
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setSelected(null)}>
          <span style={{ display: "inline-block", transform: "rotate(90deg)" }}>
            <ChevronIcon />
          </span>{" "}
          목록으로
        </button>
        <div className="card card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>{selected.userName}</h2>
            <span className="hint">
              {selected.deptName} · {selected.position || "—"}
            </span>
          </div>
        </div>
        {loading || !record ? (
          <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>
        ) : (
          <HrRecordForm
            initial={record}
            requireAgreement={false}
            onSave={async (data) => {
              const res = await fetch(`/api/admin/hr-records/${selected.userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              const json = await res.json();
              if (!res.ok) return { ok: false, error: json.error };
              setRows((prev) =>
                prev.map((r) => (r.userId === selected.userId ? { ...r, written: true, savedAt: json.savedAt } : r))
              );
              return { ok: true, data: json as HrRecord };
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>인사기록카드</h2>
        <span className="hint">작성 {writtenCount}/{rows.length}명</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <input className="input" style={{ width: 220 }} placeholder="이름·부서 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>부서</th>
              <th>직급</th>
              <th>작성 상태</th>
              <th>최종 저장</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  해당하는 직원이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.userId}>
                <td>{r.userName}</td>
                <td>{r.deptName}</td>
                <td>{r.position || "—"}</td>
                <td>
                  <span className={`pill ${r.written ? "success" : "neutral"}`}>{r.written ? "작성완료" : "미작성"}</span>
                </td>
                <td className="num">{r.savedAt ? new Date(r.savedAt).toLocaleDateString("ko-KR") : "—"}</td>
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
    </div>
  );
}
