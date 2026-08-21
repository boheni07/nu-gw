// Design Ref: §5 API 설계 — PATCH /leave-requests/:id/recall (취소/회수, §4.7)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recallLeaveRequest, LeaveServiceError } from "@/lib/leave/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  try {
    const updated = await recallLeaveRequest(id, user.id);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof LeaveServiceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 409;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    if (err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
