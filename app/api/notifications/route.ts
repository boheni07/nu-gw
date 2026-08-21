// Design Ref: §3.6 알림 — 최근 알림 목록 + 안읽음 수
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { countUnreadNotifications, listNotificationsByUser } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  return NextResponse.json({
    notifications: await listNotificationsByUser(user.id),
    unreadCount: await countUnreadNotifications(user.id),
  });
}
