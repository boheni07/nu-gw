// Design Ref: module-23 사내게시판 — GET(목록, 공지 먼저) / POST(작성, 누구나+파일 첨부 가능)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createBoardAttachment,
  createBoardPost,
  getUserById,
  listBoardAttachments,
  listBoardPosts,
} from "@/lib/data/store";
import { saveUploadedFile, StorageError, BOARD_ALLOWED_EXTENSIONS } from "@/lib/storage/local";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const posts = await listBoardPosts();
  const rows = await Promise.all(
    posts.map(async (p) => {
      const author = await getUserById(p.authorId);
      const attachments = await listBoardAttachments(p.id);
      return { ...p, authorName: author?.name ?? "알 수 없음", attachmentCount: attachments.length };
    })
  );
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const isNotice = form.get("isNotice") === "true";
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !content) {
    return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
  }

  try {
    const post = await createBoardPost({ title, content, isNotice, authorId: user.id });

    const attachments = [];
    for (const file of files) {
      const saved = await saveUploadedFile(file, `board/${post.id}`, BOARD_ALLOWED_EXTENSIONS);
      attachments.push(
        await createBoardAttachment({ postId: post.id, fileName: saved.fileName, fileUrl: `/api/files/${saved.storedPath}` })
      );
    }

    return NextResponse.json({ ...post, authorName: user.name, attachments }, { status: 201 });
  } catch (err) {
    if (err instanceof StorageError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
