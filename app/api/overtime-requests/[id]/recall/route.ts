// Design Ref: §4.7 대기중 신청 건 회수 — 초과근무 신청도 동일 정책 적용
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceServiceError, recallOvertimeRequest } from "@/lib/attendance/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  try {
    const updated = await recallOvertimeRequest(id, user.id);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AttendanceServiceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    if (err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
