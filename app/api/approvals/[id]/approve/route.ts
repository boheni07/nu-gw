// Design Ref: §5 API 설계 — POST /approvals/:id/approve
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getApproval } from "@/lib/data/store";
import { approveCurrentStep, ApprovalEngineError, resolveOnBehalfOfUserId } from "@/lib/approval/engine";
import { syncApprovalTarget } from "@/lib/approval/sync";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const approval = await getApproval(id);
  if (!approval) return NextResponse.json({ error: "결재 건을 찾을 수 없습니다." }, { status: 404 });

  const onBehalfOfUserId = await resolveOnBehalfOfUserId(approval, user.id);
  if (!onBehalfOfUserId) {
    return NextResponse.json({ error: "해당 결재 건의 처리 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const comment = typeof body?.comment === "string" ? body.comment : null;

  try {
    const updated = await approveCurrentStep(id, user.id, onBehalfOfUserId, comment);
    if (updated.status === "APPROVED") {
      await syncApprovalTarget(updated.targetType, updated.targetId, updated.status);
    }
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
