"use client";

// Design Ref: mockup/pages/index.html renderAdminCompanyScreen() — field-row + 구분선 섹션 구조로 정리
// (module-12 디자인 정합화). 출근/퇴근시간 섹션은 실제 앱에 없는 기능(고정 출퇴근시간 설정 미구현)이라 제외한다.
// module-20: 전사 기본 연차산정기준은 연차정책 설정 화면으로 이동, 출장비 단가는 기준연도별 카드(TripAllowanceRatesCard)로 분리했다.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanySettings } from "@/types";

export default function CompanySettingsForm({ initial }: { initial: CompanySettings }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Design Ref: §4.3(module-11) — 형식이 다르면 경고만 표시하고 저장은 차단하지 않는다.
  const slackUrlWarning =
    form.slackWebhookUrl && !form.slackWebhookUrl.startsWith("https://hooks.slack.com/")
      ? "일반적인 Slack Webhook URL 형식(https://hooks.slack.com/services/...)이 아닙니다. 저장은 가능하지만 값을 다시 확인해주세요."
      : null;

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setForm(data);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
      <div className="field-row">
        <div className="field">
          <label>회사명</label>
          <input className="input" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required />
        </div>
        <div className="field">
          <label>사업자등록번호</label>
          <input
            className="input"
            value={form.businessRegNo}
            onChange={(e) => set("businessRegNo", e.target.value)}
            placeholder="000-00-00000"
          />
        </div>
        <div className="field">
          <label>대표자</label>
          <input className="input" value={form.ceoName} onChange={(e) => set("ceoName", e.target.value)} />
        </div>
      </div>

      <hr className="divider" />
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>연차(시간) 계산 설정</div>

      <div className="field-row">
        <div className="field">
          <label>1일 환산 기준시간</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.standardWorkHoursPerDay}
            onChange={(e) => set("standardWorkHoursPerDay", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>신청 단위(시간)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.hourlyLeaveUnitHours}
            onChange={(e) => set("hourlyLeaveUnitHours", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>1회 신청 상한(시간)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.hourlyLeaveMaxHours}
            onChange={(e) => set("hourlyLeaveMaxHours", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>근무제</label>
          <input className="input" value={form.workSchedule} onChange={(e) => set("workSchedule", e.target.value)} />
        </div>
        <div className="field">
          <label>점심시간 시작</label>
          <input className="input" type="time" value={form.lunchStart} onChange={(e) => set("lunchStart", e.target.value)} />
        </div>
        <div className="field">
          <label>점심시간 종료</label>
          <input className="input" type="time" value={form.lunchEnd} onChange={(e) => set("lunchEnd", e.target.value)} />
        </div>
      </div>
      <p className="helptext" style={{ marginTop: -8 }}>
        연차(시간) 신청 시 이 점심시간과 겹치는 구간은 자동으로 차감 시간에서 제외됩니다.
      </p>

      <hr className="divider" />
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>알림 연동 설정</div>

      <div className="field">
        <label>Slack Webhook URL(선택)</label>
        <input
          className="input"
          type="url"
          value={form.slackWebhookUrl ?? ""}
          onChange={(e) => set("slackWebhookUrl", e.target.value.trim() === "" ? null : e.target.value.trim())}
          placeholder="https://hooks.slack.com/services/..."
        />
        <p className="helptext">등록하면 결재 상신/승인/반려 시 Slack 채널로도 알림이 전송됩니다. 비워두면 Slack 전송을 하지 않습니다.</p>
        {slackUrlWarning && (
          <p className="helptext" style={{ color: "var(--warning)" }}>
            ⚠ {slackUrlWarning}
          </p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="btn-row" style={{ justifyContent: "flex-start", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
        {savedAt && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{savedAt}에 저장됨</span>}
      </div>
    </form>
  );
}
