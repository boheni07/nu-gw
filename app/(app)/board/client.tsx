"use client";

// Design Ref: module-23 사내게시판 — 누구나 글을 올릴 수 있고, 공지(isNotice)로 체크한 글은 목록 상단에
// 항상 고정 노출되며 "공지" 뱃지가 붙는다. 파일 첨부(작성 시에만) 가능.
import { useEffect, useState } from "react";
import { AttachmentIcon, CloseIcon, EditIcon, PlusIcon, TrashIcon } from "@/lib/ui/icons";

interface BoardRow {
  id: string;
  title: string;
  content: string;
  isNotice: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  attachmentCount: number;
}
interface BoardFile {
  id: string;
  fileName: string;
  fileUrl: string;
}
interface BoardDetail extends BoardRow {
  attachments: BoardFile[];
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function BoardClient({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const [posts, setPosts] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formIsNotice, setFormIsNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detail, setDetail] = useState<BoardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/board")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormIsNotice(false);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(post: BoardDetail) {
    setEditingId(post.id);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormIsNotice(post.isNotice);
    setFormError(null);
    setShowForm(true);
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/board/${id}`);
      const data = await res.json();
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/board/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle, content: formContent, isNotice: formIsNotice }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error ?? "수정에 실패했습니다.");
          return;
        }
        setShowForm(false);
        load();
        if (detail?.id === editingId) setDetail({ ...detail, ...data });
      } else {
        const form = new FormData(e.currentTarget);
        form.set("isNotice", formIsNotice ? "true" : "false");
        const res = await fetch("/api/board", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error ?? "등록에 실패했습니다.");
          return;
        }
        setShowForm(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 게시글을 삭제하시겠습니까? 첨부파일도 함께 삭제됩니다.")) return;
    const res = await fetch(`/api/board/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setDetail(null);
    load();
  }

  const canManage = (post: { authorId: string }) => post.authorId === currentUserId || isAdmin;

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h2>사내게시판</h2>
        <button type="button" className="btn primary" onClick={openCreate}>
          <PlusIcon /> 글쓰기
        </button>
      </div>

      {loading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>}
      {!loading && posts.length === 0 && <div className="empty">등록된 게시글이 없습니다. "글쓰기"로 첫 글을 올려보세요.</div>}

      {!loading &&
        posts.length > 0 &&
        posts.map((p) => (
          <div key={p.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => openDetail(p.id)}>
            {p.isNotice && (
              <span className="pill warning" style={{ flex: "none" }}>
                공지
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title}
                {p.attachmentCount > 0 && (
                  <span style={{ marginLeft: 6, color: "var(--text-faint)", fontWeight: 400 }}>
                    <AttachmentIcon size={12} /> {p.attachmentCount}
                  </span>
                )}
              </div>
              <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
                {p.authorName} · {fmtDateTime(p.createdAt)}
                {p.editedAt && " · 수정됨"}
              </div>
            </div>
          </div>
        ))}

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <form className="panel" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="panel-head">
              <h2 style={{ fontSize: 17 }}>{editingId ? "게시글 수정" : "게시글 작성"}</h2>
              <button type="button" className="icon-btn" onClick={() => setShowForm(false)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <div className="field">
              <label>제목</label>
              <input className="input" name="title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label>내용</label>
              <textarea
                className="input"
                name="content"
                rows={8}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                required
              />
            </div>
            {!editingId && (
              <div className="field">
                <label>첨부파일(선택, 여러 개 가능)</label>
                <input className="input" type="file" name="files" multiple />
                <p className="helptext">문서/이미지/압축파일 등을 첨부할 수 있습니다(파일당 10MB 이하).</p>
              </div>
            )}
            <label className="checkbox-row">
              <input type="checkbox" checked={formIsNotice} onChange={(e) => setFormIsNotice(e.target.checked)} />
              <span>공지사항으로 등록(목록 상단에 항상 고정)</span>
            </label>
            {formError && <p className="error-text">{formError}</p>}
            <div className="btn-row">
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "저장 중…" : editingId ? "저장" : "등록"}
              </button>
            </div>
          </form>
        </div>
      )}

      {(detailLoading || detail) && (
        <div className="overlay center" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "92vw" }}>
            {detailLoading || !detail ? (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>불러오는 중…</p>
            ) : (
              <>
                <div className="panel-head">
                  <div>
                    {detail.isNotice && (
                      <span className="pill warning" style={{ marginBottom: 6 }}>
                        공지
                      </span>
                    )}
                    <h2 style={{ fontSize: 17, marginTop: 4 }}>{detail.title}</h2>
                    <span className="hint">
                      {detail.authorName} · {fmtDateTime(detail.createdAt)}
                      {detail.editedAt && ` · ${fmtDateTime(detail.editedAt)} 수정됨`}
                    </span>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => setDetail(null)} aria-label="닫기">
                    <CloseIcon />
                  </button>
                </div>
                <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", marginTop: 14 }}>{detail.content}</p>

                {detail.attachments.length > 0 && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    {detail.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 13 }}
                      >
                        <AttachmentIcon /> {a.fileName}
                      </a>
                    ))}
                  </div>
                )}

                {canManage(detail) && (
                  <div className="btn-row" style={{ marginTop: 18 }}>
                    <button type="button" className="btn ghost" style={{ color: "var(--danger)" }} onClick={() => handleDelete(detail.id)}>
                      <TrashIcon /> 삭제
                    </button>
                    <button type="button" className="btn" onClick={() => openEdit(detail)}>
                      <EditIcon /> 수정
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
