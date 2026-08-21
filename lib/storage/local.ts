// bkend.ai Storage(presigned URL 업로드/CDN 다운로드) 대체 — 로컬 디스크 저장 + 인증 게이트 API(/api/files/[...path]).
// Design Ref: §3.3 Attachment, 비기능요구 §3 "특별휴가·공가 신청 시 증빙파일 업로드/보관 기능 필요"
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

export class StorageError extends Error {}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-가-힣 ]/g, "_").slice(0, 120);
}

/** multipart 폼에서 받은 File을 uploads/leave/{leaveRequestId 대용 prefix}/ 아래에 저장한다. */
export async function saveUploadedFile(file: File, subDir: string): Promise<{ fileName: string; storedPath: string }> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new StorageError("PDF, PNG, JPG 파일만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new StorageError("파일 크기는 10MB를 초과할 수 없습니다.");
  }

  const dir = path.join(UPLOADS_ROOT, subDir);
  fs.mkdirSync(dir, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const uniquePrefix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const storedFileName = `${uniquePrefix}-${safeName}`;
  const fullPath = path.join(dir, storedFileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(fullPath, buffer);

  return { fileName: file.name, storedPath: `${subDir}/${storedFileName}` };
}

/** /api/files/[...path]에서 사용 — 경로 탈출(../) 공격을 막고 안전하게 절대경로를 반환한다. */
export function resolveStoredFilePath(relativePath: string[]): string | null {
  const joined = relativePath.join("/");
  const full = path.normalize(path.join(UPLOADS_ROOT, joined));
  if (!full.startsWith(UPLOADS_ROOT)) return null; // path traversal 방지
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}
