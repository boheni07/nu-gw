// Design Ref: §5 API 설계 — POST /auth/login (로컬 인증, bkend.ai 미사용)
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/data/store";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (user.employmentStatus === "RESIGNED") {
    return NextResponse.json({ error: "퇴사 처리된 계정입니다." }, { status: 403 });
  }

  await issueSession(user.id);
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
  });
}
