// Design Ref: §5 API 설계 — POST /attendance/check-in (1일 1회, 대시보드/출퇴근 관리 화면 상단에서 호출)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkIn, AttendanceServiceError } from "@/lib/attendance/service";
import { extractClientIp } from "@/lib/net/ip";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const record = await checkIn(user.id, extractClientIp(request.headers));
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof AttendanceServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
