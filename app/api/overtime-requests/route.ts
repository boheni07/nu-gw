// Design Ref: §5 API 설계 — POST /overtime-requests(신청), GET /overtime-requests/me
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listOvertimeRequestsByUser } from "@/lib/data/store";
import { AttendanceServiceError, submitOvertimeRequest } from "@/lib/attendance/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listOvertimeRequestsByUser(user.id));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : "";
  const expectedEndTime = typeof body?.expectedEndTime === "string" ? body.expectedEndTime : "";
  const workDetail = typeof body?.workDetail === "string" ? body.workDetail : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";

  if (!date || !expectedEndTime) {
    return NextResponse.json({ error: "날짜와 예상 퇴근시간을 입력해주세요." }, { status: 400 });
  }

  try {
    const record = await submitOvertimeRequest({
      userId: user.id,
      departmentId: user.departmentId,
      date,
      expectedEndTime,
      workDetail,
      reason,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof AttendanceServiceError || err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
