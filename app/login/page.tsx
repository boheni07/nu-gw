"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("dyoon.kim@nugw.co.kr");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }
      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
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
            <h1>nuGW 업무관리</h1>
            <p>연차 · 결재 · 업무보고를 한 곳에서</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn primary" style={{ width: "100%", marginTop: 4 }} disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <Link href="/forgot-password" className="hint" style={{ display: "block", textAlign: "center", marginTop: 12, color: "var(--accent)" }}>
          비밀번호를 잊으셨나요?
        </Link>

        <div className="login-demo">
          <b>테스트 계정 안내.</b> 시드 사용자 계정은 임시 비밀번호 <code>nugw-demo!</code>로 로그인할 수
          있습니다. 시스템 총괄관리자 계정은 <code>master@nubiz.kr</code> / <code>nubiz@3345</code>입니다.
        </div>
      </div>
    </div>
  );
}
