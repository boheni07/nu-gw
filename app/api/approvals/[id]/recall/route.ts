// Design Ref: §5 API 설계 — PATCH /leave-requests/:id/recall 등과 공유하는 공통 회수 처리(§4.7)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ApprovalEngineError, recallApproval } from "@/lib/approval/engine";
import { syncApprovalTarget } from "@/lib/approval/sync";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  try {
    const updated = await recallApproval(id, user.id);
    await syncApprovalTarget(updated.targetType, updated.targetId, updated.status);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApprovalEngineError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "NOT_APPROVER" ? 403 : 409;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
