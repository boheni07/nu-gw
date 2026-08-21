// Design Ref: §5 API 설계 — POST /attendance/check-out (서버 시각 18:00 이후만 허용, §4.6)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkOut, AttendanceServiceError } from "@/lib/attendance/service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const record = await checkOut(user.id);
    return NextResponse.json(record);
  } catch (err) {
    if (err instanceof AttendanceServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
