// Design Ref: §5 API 설계 — GET/PUT /company-settings (ADMIN 전용, 시스템 내 1건)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getCompanySettings, updateCompanySettings } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });
  return NextResponse.json(await getCompanySettings());
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const patch = await request.json().catch(() => null);
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  // id는 항상 1건이므로 클라이언트가 보낸 id는 무시한다.
  const { id, ...rest } = patch;
  const updated = await updateCompanySettings(rest);
  return NextResponse.json(updated);
}
