// 인증된 사용자만 접근 가능한 파일 다운로드(bkend.ai Storage CDN 대체).
// module-3 범위에서는 "로그인 여부"만 검사한다 — 문서별 세부 접근권한(본인/결재자만) 검증은
// 이후 모듈에서 첨부파일 소유 관계가 늘어날 때 함께 강화하는 것을 권장한다.
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveStoredFilePath } from "@/lib/storage/local";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { path: segments } = await params;
  const fullPath = resolveStoredFilePath(segments);
  if (!fullPath) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });

  const ext = path.extname(fullPath).toLowerCase();
  const buffer = fs.readFileSync(fullPath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
