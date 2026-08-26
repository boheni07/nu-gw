// Design Ref: module-17 §비밀번호 셀프 재설정 — 이메일 발송 인프라가 없어(bkend.ai 미사용) 본인 확인을
// "아이디 + 입사일" 조합으로 대체한다. 인사기록카드 등에 공개되지 않는 값은 아니지만, 최소한 무작위
// 대입으로 즉시 뚫리지 않도록 하는 내부용 안전장치다.
import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername, updateUserPasswordHash } from "@/lib/data/store";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const hireDate = typeof body?.hireDate === "string" ? body.hireDate : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!username || !hireDate || newPassword.length < 8) {
    return NextResponse.json({ error: "아이디·입사일과 8자 이상의 새 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const user = await getUserByUsername(username);
  // 계정 존재 여부가 드러나지 않도록 아이디/입사일 불일치와 동일한 오류 메시지를 사용한다.
  if (!user || user.hireDate !== hireDate || user.employmentStatus === "RESIGNED") {
    return NextResponse.json({ error: "아이디 또는 입사일이 일치하지 않습니다." }, { status: 400 });
  }

  await updateUserPasswordHash(user.id, hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
