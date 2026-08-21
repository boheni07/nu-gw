// Design Ref: §5 API 설계 — POST /leave-requests(신청, 검증+Approval 생성). 조회는 본인 이력.
// module-3 간소화: bkend.ai가 없어 별도 DRAFT/presigned-URL 단계 없이 multipart 단일 요청으로 파일+데이터를 함께 받는다.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listAttachments, LeaveServiceError, submitLeaveRequest } from "@/lib/leave/service";
import { listLeaveRequestsByUser } from "@/lib/data/store";
import { ApprovalEngineError } from "@/lib/approval/engine";
import { saveUploadedFile, StorageError } from "@/lib/storage/local";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const requests = await listLeaveRequestsByUser(user.id);
  const withAttachments = await Promise.all(requests.map(async (r) => ({ ...r, attachments: await listAttachments(r.id) })));
  return NextResponse.json(withAttachments);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const leaveTypeId = String(form.get("leaveTypeId") ?? "");
  const startDate = form.get("startDate") ? String(form.get("startDate")) : undefined;
  const endDate = form.get("endDate") ? String(form.get("endDate")) : undefined;
  const startTime = form.get("startTime") ? String(form.get("startTime")) : undefined;
  const endTime = form.get("endTime") ? String(form.get("endTime")) : undefined;
  const reason = String(form.get("reason") ?? "");
  const file = form.get("attachment");

  if (!leaveTypeId || !reason) {
    return NextResponse.json({ error: "연차 유형과 사유를 입력해주세요." }, { status: 400 });
  }

  try {
    let attachment: { fileName: string; storedPath: string } | null = null;
    if (file instanceof File && file.size > 0) {
      attachment = await saveUploadedFile(file, `leave/${user.id}`);
    }

    const record = await submitLeaveRequest({
      userId: user.id,
      leaveTypeId,
      startDate,
      endDate,
      startTime,
      endTime,
      reason,
      attachment,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof LeaveServiceError || err instanceof StorageError || err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
