import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { markNotificationRead } from "@/lib/data/store";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const updated = await markNotificationRead(id, user.id);
  if (!updated) return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}
