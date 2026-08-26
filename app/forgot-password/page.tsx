"use client";

// Design Ref: module-17 §비밀번호 셀프 재설정 — 로그인 화면과 동일한 카드 레이아웃을 재사용한다.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DateInput from "@/lib/ui/DateInput";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, hireDate, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "비밀번호 재설정에 실패했습니다.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-brand">
          <div className="brand-mark">nu</div>
          <div>
            <h1>비밀번호 재설정</h1>
            <p>본인 확인 후 새 비밀번호를 설정하세요</p>
          </div>
        </div>

        {done ? (
          <>
            <p className="hint" style={{ color: "var(--success)" }}>
              비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.
            </p>
            <Link href="/login" className="btn primary" style={{ width: "100%", marginTop: 12, textAlign: "center" }}>
              로그인하러 가기
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="fp-username">아이디</label>
              <input
                id="fp-username"
                className="input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fp-hire">입사일</label>
              <DateInput id="fp-hire" value={hireDate} onChange={setHireDate} required />
              <p className="helptext">본인 확인용입니다 — 인사기록카드/사원증에 기재된 입사일을 입력하세요.</p>
            </div>
            <div className="field">
              <label htmlFor="fp-new">새 비밀번호</label>
              <input
                id="fp-new"
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fp-confirm">새 비밀번호 확인</label>
              <input
                id="fp-confirm"
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn primary" style={{ width: "100%", marginTop: 4 }} disabled={loading}>
              {loading ? "재설정 중…" : "비밀번호 재설정"}
            </button>
            <Link href="/login" className="hint" style={{ display: "block", textAlign: "center", marginTop: 12, color: "var(--accent)" }}>
              로그인으로 돌아가기
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
