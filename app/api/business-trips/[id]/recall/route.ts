// Design Ref: module-13 §API 설계 — PATCH /business-trips/:id/recall (대기중 출장신청 취소)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recallBusinessTrip, TripServiceError } from "@/lib/trip/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  try {
    const updated = await recallBusinessTrip(id, user.id);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof TripServiceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    if (err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
