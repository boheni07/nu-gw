// Design Ref: module-13 §API 설계 — GET/POST /business-trips (본인 출장신청 이력 조회/상신)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listBusinessTripsByUser } from "@/lib/data/store";
import { submitBusinessTrip, TripServiceError } from "@/lib/trip/service";
import { ApprovalEngineError } from "@/lib/approval/engine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listBusinessTripsByUser(user.id));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const tripType = body.tripType === "OUT_OF_TOWN" ? "OUT_OF_TOWN" : body.tripType === "LOCAL" ? "LOCAL" : null;
  if (!tripType) return NextResponse.json({ error: "출장 구분이 올바르지 않습니다." }, { status: 400 });

  try {
    const record = await submitBusinessTrip({
      userId: user.id,
      departmentId: user.departmentId,
      tripType,
      startDate: typeof body.startDate === "string" ? body.startDate : "",
      endDate: typeof body.endDate === "string" ? body.endDate : undefined,
      startTime: typeof body.startTime === "string" ? body.startTime : undefined,
      endTime: typeof body.endTime === "string" ? body.endTime : undefined,
      destination: typeof body.destination === "string" ? body.destination : "",
      purpose: typeof body.purpose === "string" ? body.purpose : "",
      transport: typeof body.transport === "string" ? body.transport : undefined,
    });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof TripServiceError || err instanceof ApprovalEngineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
