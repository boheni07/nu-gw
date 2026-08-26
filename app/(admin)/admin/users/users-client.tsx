"use client";

// Design Ref: mockup/pages/index.html renderAdminUsersScreen()/renderUserEditPanel() — 카드 + 목록 테이블 +
// 우측 슬라이드 패널(정보수정/등록) 구조로 정리(module-12 디자인 정합화)
import { useMemo, useState } from "react";
import type { Department, User, UserRole } from "@/types";
import { CloseIcon, EditIcon, KeyIcon, LogoutIcon, PlusIcon, TrashIcon } from "@/lib/ui/icons";
import DateInput from "@/lib/ui/DateInput";

const ROLE_LABEL: Record<UserRole, string> = { ADMIN: "관리자", APPROVER: "결재자", MEMBER: "일반 사용자" };
const ROLE_PILL_CLASS: Record<UserRole, string> = { ADMIN: "admin", APPROVER: "approver", MEMBER: "member" };

type StatusFilter = "ALL" | "ACTIVE" | "RESIGNED";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function UsersClient({
  initialUsers,
  departments,
}: {
  initialUsers: User[];
  departments: Department[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [editing, setEditing] = useState<User | null>(null);
  const [resigning, setResigning] = useState<User | null>(null);
  const [resettingPw, setResettingPw] = useState<User | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwResetting, setPwResetting] = useState(false);
  const [createHireDate, setCreateHireDate] = useState(todayStr());
  const [editHireDate, setEditHireDate] = useState("");
  const [resignedAtDate, setResignedAtDate] = useState(todayStr());

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "—";

  const filteredUsers = useMemo(() => {
    if (statusFilter === "ALL") return users;
    if (statusFilter === "ACTIVE") return users.filter((u) => u.employmentStatus !== "RESIGNED");
    return users.filter((u) => u.employmentStatus === "RESIGNED");
  }, [users, statusFilter]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          username: form.get("username"),
          departmentId: form.get("departmentId"),
          position: form.get("position"),
          hireDate: createHireDate,
          role: form.get("role"),
          tempPassword: form.get("tempPassword"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        return;
      }
      setUsers((prev) => [...prev, data]);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        departmentId: form.get("departmentId"),
        position: form.get("position"),
        hireDate: editHireDate,
        role: form.get("role"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "수정에 실패했습니다.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === editing.id ? data : u)));
    setEditing(null);
  }

  async function handleResignSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resigning) return;
    const res = await fetch(`/api/admin/users/${resigning.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resign", resignedAt: resignedAtDate }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "퇴사 처리에 실패했습니다.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === resigning.id ? data : u)));
    setResigning(null);
  }

  async function handleResetPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resettingPw) return;
    setPwError(null);
    setPwResetting(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/admin/users/${resettingPw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", tempPassword: form.get("tempPassword") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "비밀번호 초기화에 실패했습니다.");
        return;
      }
      alert(`${resettingPw.name}님의 비밀번호가 초기화되었습니다.`);
      setResettingPw(null);
    } finally {
      setPwResetting(false);
    }
  }

  async function handleDelete(u: User) {
    if (!confirm(`${u.name}님의 계정을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>사용자 목록</h2>
        <span className="hint">{users.length}명</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
        <select
          className="input"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="ALL">전체</option>
          <option value="ACTIVE">재직</option>
          <option value="RESIGNED">퇴사</option>
        </select>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setCreateHireDate(todayStr());
            setShowCreate(true);
          }}
        >
          <PlusIcon /> 사용자 추가
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>부서/직급</th>
              <th>입사일</th>
              <th>역할</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  해당하는 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{u.username}</div>
                  </td>
                  <td>
                    {deptName(u.departmentId)}
                    {u.position && <span style={{ color: "var(--text-faint)" }}> · {u.position}</span>}
                  </td>
                  <td className="num">{u.hireDate}</td>
                  <td>
                    <span className={`pill ${ROLE_PILL_CLASS[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td>
                    {u.employmentStatus === "RESIGNED" ? (
                      <span className="pill danger">퇴사({u.resignedAt ?? "-"})</span>
                    ) : (
                      <span className="pill success">재직</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                      {u.employmentStatus !== "RESIGNED" && (
                        <>
                          <button
                            type="button"
                            className="icon-btn"
                            title="수정"
                            aria-label="수정"
                            onClick={() => {
                              setEditHireDate(u.hireDate);
                              setEditing(u);
                            }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="비밀번호 초기화"
                            aria-label="비밀번호 초기화"
                            onClick={() => {
                              setPwError(null);
                              setResettingPw(u);
                            }}
                          >
                            <KeyIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="퇴사 처리"
                            aria-label="퇴사 처리"
                            onClick={() => {
                              setResignedAtDate(todayStr());
                              setResigning(u);
                            }}
                          >
                            <LogoutIcon size={15} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ color: "var(--danger)" }}
                        title="삭제"
                        aria-label="삭제"
                        onClick={() => handleDelete(u)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="overlay" onClick={() => setShowCreate(false)}>
          <form className="panel" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>사용자 추가</h2>
              <button type="button" className="icon-btn" onClick={() => setShowCreate(false)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <div className="field">
              <label>이름</label>
              <input name="name" className="input" required />
            </div>
            <div className="field">
              <label>아이디(로그인 ID)</label>
              <input name="username" type="text" className="input" required />
            </div>
            <div className="field">
              <label>부서</label>
              <select name="departmentId" className="input" required defaultValue={departments[0]?.id}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>직급</label>
              <input name="position" className="input" />
            </div>
            <div className="field">
              <label>입사일</label>
              <DateInput value={createHireDate} onChange={setCreateHireDate} required />
            </div>
            <div className="field">
              <label>권한</label>
              <select name="role" className="input" defaultValue="MEMBER">
                <option value="MEMBER">일반 사용자</option>
                <option value="APPROVER">결재자</option>
                <option value="ADMIN">관리자</option>
              </select>
            </div>
            <div className="field">
              <label>임시 비밀번호(8자 이상)</label>
              <input name="tempPassword" type="text" className="input" minLength={8} required />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="btn-row">
              <button type="submit" className="btn primary" disabled={creating}>
                {creating ? "등록 중…" : "등록"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="overlay" onClick={() => setEditing(null)}>
          <form className="panel" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSubmit}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>사용자 정보 수정</h2>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <div className="field">
              <label>이름</label>
              <input name="name" className="input" defaultValue={editing.name} required />
            </div>
            <div className="field">
              <label>아이디(로그인 ID)</label>
              <input name="username" type="text" className="input" defaultValue={editing.username} required />
            </div>
            <div className="field">
              <label>부서</label>
              <select name="departmentId" className="input" defaultValue={editing.departmentId} required>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>직급</label>
              <input name="position" className="input" defaultValue={editing.position} />
            </div>
            <div className="field">
              <label>입사일</label>
              <DateInput value={editHireDate} onChange={setEditHireDate} required />
            </div>
            <div className="field">
              <label>권한</label>
              <select name="role" className="input" defaultValue={editing.role}>
                <option value="MEMBER">일반 사용자</option>
                <option value="APPROVER">결재자</option>
                <option value="ADMIN">관리자</option>
              </select>
            </div>
            <div className="btn-row">
              <button type="submit" className="btn primary">
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      {resettingPw && (
        <div className="overlay center" onClick={() => setResettingPw(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleResetPasswordSubmit}>
            <h2 style={{ fontSize: 15 }}>비밀번호 초기화 — {resettingPw.name}</h2>
            <div className="field">
              <label>새 임시 비밀번호(8자 이상)</label>
              <input name="tempPassword" type="text" className="input" minLength={8} required />
            </div>
            <p className="helptext">
              초기화 즉시 기존 비밀번호는 사용할 수 없게 되며, 해당 사용자는 이 임시 비밀번호로 로그인해야 합니다.
            </p>
            {pwError && <p className="error-text">{pwError}</p>}
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setResettingPw(null)}>
                취소
              </button>
              <button type="submit" className="btn primary" disabled={pwResetting}>
                {pwResetting ? "초기화 중…" : "초기화"}
              </button>
            </div>
          </form>
        </div>
      )}

      {resigning && (
        <div className="overlay center" onClick={() => setResigning(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleResignSubmit}>
            <h2 style={{ fontSize: 15 }}>퇴사 처리 — {resigning.name}</h2>
            <div className="field">
              <label>퇴사일자</label>
              <DateInput value={resignedAtDate} onChange={setResignedAtDate} required />
            </div>
            <p className="helptext">퇴사 처리 후에는 로그인이 차단되며, 목록에서 "퇴사"로 표시됩니다. 계정 데이터는 이력으로 보존됩니다.</p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setResigning(null)}>
                취소
              </button>
              <button type="submit" className="btn primary">
                퇴사 처리
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
