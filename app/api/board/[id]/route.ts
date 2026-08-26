// Design Ref: module-23 사내게시판 — GET(상세+첨부), PATCH(수정, 작성자 또는 관리자), DELETE(작성자 또는 관리자)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { deleteBoardPost, getBoardPost, getUserById, listBoardAttachments, updateBoardPost } from "@/lib/data/store";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const post = await getBoardPost(id);
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const author = await getUserById(post.authorId);
  const attachments = await listBoardAttachments(id);
  return NextResponse.json({ ...post, authorName: author?.name ?? "알 수 없음", attachments });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const post = await getBoardPost(id);
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "작성자 또는 관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const patch: { title?: string; content?: string; isNotice?: boolean } = {};
  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    patch.title = body.title.trim();
  }
  if (typeof body.content === "string") {
    if (!body.content.trim()) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    patch.content = body.content.trim();
  }
  if (typeof body.isNotice === "boolean") patch.isNotice = body.isNotice;

  const updated = await updateBoardPost(id, patch);
  if (!updated) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const post = await getBoardPost(id);
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "작성자 또는 관리자만 삭제할 수 있습니다." }, { status: 403 });
  }

  const ok = await deleteBoardPost(id);
  if (!ok) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
