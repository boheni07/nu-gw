import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { markAllNotificationsRead } from "@/lib/data/store";

export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const count = await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true, count });
}
