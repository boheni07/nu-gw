// 연차 신청 폼에서 유형 선택지를 구성하기 위한 조회(로그인만 하면 누구나 조회 가능)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listLeaveTypeConfigs } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listLeaveTypeConfigs());
}
