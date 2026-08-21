"use client";

// Design Ref: §3.8 인사기록카드 — 본인 화면(client.tsx)과 관리자 화면(admin/hr-records)이 공유하는 폼.
// module-15: 관리자는 본인 서약(agreed)을 대신 체크/해제할 수 없으므로 requireAgreement로 분기한다.
import { useState } from "react";
import type {
  CareerEntry,
  CertificateEntry,
  EducationEntry,
  FamilyEntry,
  HrRecord,
  MilitaryStatus,
} from "@/types";
import { PlusIcon, TrashIcon } from "@/lib/ui/icons";
import { formatPhoneNumber } from "@/lib/ui/format";
import DateInput from "@/lib/ui/DateInput";

export default function HrRecordForm({
  initial,
  onSave,
  requireAgreement,
}: {
  initial: HrRecord;
  onSave: (data: HrRecord) => Promise<{ ok: boolean; data?: HrRecord; error?: string }>;
  /** true(본인 화면): 저장 전 서약 동의 체크 필수. false(관리자 화면): 서약 체크박스를 읽기 전용으로 표시하고 검증하지 않는다. */
  requireAgreement: boolean;
}) {
  const [form, setForm] = useState<HrRecord>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initial.savedAt);

  function set<K extends keyof HrRecord>(key: K, value: HrRecord[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requireAgreement && !form.agreed) {
      setError("서약에 동의해야 저장할 수 있습니다.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSave(form);
      if (!result.ok || !result.data) {
        setError(result.error ?? "저장에 실패했습니다.");
        return;
      }
      setForm(result.data);
      setSavedAt(result.data.savedAt);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section className="card card-pad">
        <div className="card-head">
          <h2>기본 인적사항</h2>
          <span className="hint">표준서식</span>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>성명(한글)</label>
            <input className="input" value={form.nameKr} onChange={(e) => set("nameKr", e.target.value)} required />
          </div>
          <div className="field">
            <label>성명(영문)</label>
            <input className="input" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
          </div>
          <div className="field">
            <label>생년월일</label>
            <DateInput value={form.birth} onChange={(v) => set("birth", v)} />
          </div>
          <div className="field">
            <label>성별</label>
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">선택 안 함</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </div>
          <div className="field">
            <label>휴대전화</label>
            <input
              className="input"
              placeholder="010-0000-0000"
              value={form.mobile}
              onChange={(e) => set("mobile", formatPhoneNumber(e.target.value))}
            />
          </div>
          <div className="field">
            <label>이메일</label>
            <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>주소</label>
          <input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>

        <div className="field-row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>비상연락처 관계</label>
            <input
              className="input"
              value={form.emergencyContact.relation}
              onChange={(e) => set("emergencyContact", { ...form.emergencyContact, relation: e.target.value })}
            />
          </div>
          <div className="field">
            <label>비상연락처 성명</label>
            <input
              className="input"
              value={form.emergencyContact.name}
              onChange={(e) => set("emergencyContact", { ...form.emergencyContact, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>비상연락처 전화</label>
            <input
              className="input"
              placeholder="010-0000-0000"
              value={form.emergencyContact.phone}
              onChange={(e) => set("emergencyContact", { ...form.emergencyContact, phone: formatPhoneNumber(e.target.value) })}
            />
          </div>
        </div>
      </section>

      <EducationSection value={form.education} onChange={(v) => set("education", v)} />
      <CareerSection value={form.career} onChange={(v) => set("career", v)} />
      <CertificateSection value={form.certificates} onChange={(v) => set("certificates", v)} />
      <FamilySection value={form.family} onChange={(v) => set("family", v)} />

      <section className="card card-pad">
        <div className="card-head">
          <h2>병역사항</h2>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: form.militaryStatus === "군필" ? "1fr 1fr 1fr 1fr" : "1fr" }}>
          <div className="field">
            <label>병역구분</label>
            <select className="input" value={form.militaryStatus} onChange={(e) => set("militaryStatus", e.target.value as MilitaryStatus)}>
              <option value="해당없음">해당없음</option>
              <option value="군필">군필</option>
              <option value="미필">미필</option>
              <option value="면제">면제</option>
            </select>
          </div>
          {form.militaryStatus === "군필" && (
            <>
              <div className="field">
                <label>군종</label>
                <input className="input" value={form.militaryBranch} onChange={(e) => set("militaryBranch", e.target.value)} />
              </div>
              <div className="field">
                <label>계급</label>
                <input className="input" value={form.militaryRank} onChange={(e) => set("militaryRank", e.target.value)} />
              </div>
              <div className="field">
                <label>복무기간</label>
                <input className="input" placeholder="예: 2018.03~2019.12" value={form.militaryPeriod} onChange={(e) => set("militaryPeriod", e.target.value)} />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card card-pad">
        {requireAgreement ? (
          <label className="checkbox-row">
            <input type="checkbox" checked={form.agreed} onChange={(e) => set("agreed", e.target.checked)} />
            <span>상기 기재사항은 사실과 다름없음을 서약합니다.</span>
          </label>
        ) : (
          <div className="checkbox-row" style={{ color: "var(--text-faint)" }}>
            <input type="checkbox" checked={form.agreed} disabled readOnly />
            <span>본인 서약 {form.agreed ? "완료" : "미완료"}(관리자는 대신 체크할 수 없습니다)</span>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
          {savedAt && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>최종 저장: {new Date(savedAt).toLocaleString("ko-KR")}</span>}
        </div>
      </section>
    </form>
  );
}

function EducationSection({ value, onChange }: { value: EducationEntry[]; onChange: (v: EducationEntry[]) => void }) {
  return (
    <RepeatableSection
      title="학력사항"
      items={value}
      empty={{ school: "", major: "", degree: "", graduationDate: "" }}
      onChange={onChange}
      renderRow={(item, update) => (
        <>
          <input className="input" placeholder="학교명" value={item.school} onChange={(e) => update({ ...item, school: e.target.value })} />
          <input className="input" placeholder="전공" value={item.major} onChange={(e) => update({ ...item, major: e.target.value })} />
          <input className="input" placeholder="학위(학사/석사 등)" value={item.degree} onChange={(e) => update({ ...item, degree: e.target.value })} />
          <DateInput value={item.graduationDate} onChange={(v) => update({ ...item, graduationDate: v })} />
        </>
      )}
    />
  );
}

function CareerSection({ value, onChange }: { value: CareerEntry[]; onChange: (v: CareerEntry[]) => void }) {
  return (
    <RepeatableSection
      title="경력사항"
      items={value}
      empty={{ company: "", position: "", startDate: "", endDate: "" }}
      onChange={onChange}
      renderRow={(item, update) => (
        <>
          <input className="input" placeholder="회사명" value={item.company} onChange={(e) => update({ ...item, company: e.target.value })} />
          <input className="input" placeholder="직책/직급" value={item.position} onChange={(e) => update({ ...item, position: e.target.value })} />
          <DateInput value={item.startDate} onChange={(v) => update({ ...item, startDate: v })} />
          <DateInput value={item.endDate} onChange={(v) => update({ ...item, endDate: v })} />
        </>
      )}
    />
  );
}

function CertificateSection({ value, onChange }: { value: CertificateEntry[]; onChange: (v: CertificateEntry[]) => void }) {
  return (
    <RepeatableSection
      title="자격/면허사항"
      items={value}
      empty={{ name: "", issuer: "", acquiredDate: "" }}
      onChange={onChange}
      renderRow={(item, update) => (
        <>
          <input className="input" placeholder="자격명" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
          <input className="input" placeholder="발급기관" value={item.issuer} onChange={(e) => update({ ...item, issuer: e.target.value })} />
          <DateInput value={item.acquiredDate} onChange={(v) => update({ ...item, acquiredDate: v })} />
        </>
      )}
      columns="1fr 1fr 1fr"
    />
  );
}

function FamilySection({ value, onChange }: { value: FamilyEntry[]; onChange: (v: FamilyEntry[]) => void }) {
  return (
    <RepeatableSection
      title="가족사항"
      items={value}
      empty={{ relation: "", name: "", birth: "" }}
      onChange={onChange}
      renderRow={(item, update) => (
        <>
          <input className="input" placeholder="관계" value={item.relation} onChange={(e) => update({ ...item, relation: e.target.value })} />
          <input className="input" placeholder="성명" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
          <DateInput value={item.birth} onChange={(v) => update({ ...item, birth: v })} />
        </>
      )}
      columns="1fr 1fr 1fr"
    />
  );
}

function RepeatableSection<T>({
  title,
  items,
  empty,
  onChange,
  renderRow,
  columns = "1fr 1fr 1fr 1fr",
}: {
  title: string;
  items: T[];
  empty: T;
  onChange: (v: T[]) => void;
  renderRow: (item: T, update: (next: T) => void) => React.ReactNode;
  columns?: string;
}) {
  return (
    <section className="card card-pad">
      <div className="card-head">
        <h2>{title}</h2>
        <button type="button" className="btn ghost" onClick={() => onChange([...items, empty])}>
          <PlusIcon size={12} /> 추가
        </button>
      </div>
      {items.length === 0 && <p className="empty" style={{ padding: 0, textAlign: "left" }}>등록된 항목이 없습니다. 위 &quot;추가&quot; 버튼으로 입력하세요.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: `${columns} auto`, gap: 10, alignItems: "center" }}>
            {renderRow(item, (next) => {
              const copy = [...items];
              copy[i] = next;
              onChange(copy);
            })}
            <button
              type="button"
              className="btn ghost"
              style={{ color: "var(--danger)" }}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label="삭제"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
