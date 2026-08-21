// Design Ref: §5 API 설계 — PUT /leave-requests/:id (수정, version 일치 + PENDING + 1단계 미처리 시에만 허용, §4.7)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { editLeaveRequest, LeaveServiceError } from "@/lib/leave/service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.version !== "number") {
    return NextResponse.json({ error: "version 정보가 필요합니다." }, { status: 400 });
  }

  const { id } = await params;
  try {
    const updated = await editLeaveRequest(id, user.id, body.version, {
      startDate: body.startDate,
      endDate: body.endDate,
      startTime: body.startTime,
      endTime: body.endTime,
      reason: body.reason,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof LeaveServiceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    throw err;
  }
}
