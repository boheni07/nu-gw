// Design Ref: module-13 §API 설계 — GET /trip-reports(결과보고 대상 시외출장+보고 병합 목록), POST /trip-reports(상신)
// module-3 leave-requests와 동일하게 multipart 단일 요청으로 파일(교통비/숙박비 증빙)+데이터를 함께 받는다.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listEligibleTripsForReport, submitTripReport, TripServiceError } from "@/lib/trip/service";
import { ApprovalEngineError } from "@/lib/approval/engine";
import { saveUploadedFile, StorageError } from "@/lib/storage/local";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listEligibleTripsForReport(user.id));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const tripId = String(form.get("tripId") ?? "");
  const workContent = String(form.get("workContent") ?? "");
  const transport = String(form.get("transport") ?? "");
  const transportCost = Number(form.get("transportCost") ?? 0) || 0;
  const hasLodging = form.get("hasLodging") === "true";
  const lodgingCost = Number(form.get("lodgingCost") ?? 0) || 0;
  const transportFile = form.get("transportFile");
  const lodgingFile = form.get("lodgingFile");

  if (!tripId) return NextResponse.json({ error: "출장 건을 선택해주세요." }, { status: 400 });

  try {
    let transportAttachment: { fileName: string; storedPath: string } | null = null;
    if (transportFile instanceof File && transportFile.size > 0) {
      transportAttachment = await saveUploadedFile(transportFile, `trip-report/${user.id}`);
    }
    let lodgingAttachment: { fileName: string; storedPath: string } | null = null;
    if (hasLodging && lodgingFile instanceof File && lodgingFile.size > 0) {
      lodgingAttachment = await saveUploadedFile(lodgingFile, `trip-report/${user.id}`);
    }

    const record = await submitTripReport({
      userId: user.id,
      departmentId: user.departmentId,
      tripId,
      workContent,
      transport,
      transportCost,
      transportAttachment,
      hasLodging,
      lodgingCost,
      lodgingAttachment,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof TripServiceError || err instanceof StorageError || err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
