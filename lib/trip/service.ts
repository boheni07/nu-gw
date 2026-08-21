// Design Ref: module-13 출장신청/출장결과보고 — mockup/pages/index.html renderBusinessTripScreen()/renderTripReportScreen()
// 연차/초과근무와 동일하게 공통 결재 엔진(lib/approval/engine.ts)을 재사용한다(targetType='TRIP'/'TRIP_REPORT').
import {
  createBusinessTrip,
  createTripReport,
  getBusinessTrip,
  getLatestTripAllowanceRate,
  getTripReport,
  getTripReportByTripId,
  getUserById,
  listCompletedOutOfTownTrips,
  updateBusinessTrip,
  updateTripReport,
} from "@/lib/data/store";
import { recallApproval, submitForApproval } from "@/lib/approval/engine";
import { calendarDaysBetween, tripReportDueInfo, type TripReportDueInfo } from "@/lib/trip/calc";
import type { ApprovalStatus, BusinessTrip, TripReport } from "@/types";

export { calendarDaysBetween, tripReportDueInfo, type TripReportDueInfo };

export class TripServiceError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "VALIDATION" | "FORBIDDEN" | "NOT_ELIGIBLE" | "ALREADY_REPORTED" = "VALIDATION"
  ) {
    super(message);
    this.name = "TripServiceError";
  }
}

export interface SubmitBusinessTripInput {
  userId: string;
  departmentId: string;
  tripType: "LOCAL" | "OUT_OF_TOWN";
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  destination: string;
  purpose: string;
  transport?: string;
}

export async function submitBusinessTrip(input: SubmitBusinessTripInput): Promise<BusinessTrip> {
  if (!input.destination.trim() || !input.purpose.trim()) {
    throw new TripServiceError("출장지와 출장 목적을 입력해주세요.");
  }

  let startDate: string;
  let endDate: string;
  let startTime: string | null = null;
  let endTime: string | null = null;
  let transport: string | null = null;

  if (input.tripType === "OUT_OF_TOWN") {
    if (!input.startDate || !input.endDate) throw new TripServiceError("시작일과 종료일을 입력해주세요.");
    if (input.endDate < input.startDate) throw new TripServiceError("종료일은 시작일 이후여야 합니다.");
    startDate = input.startDate;
    endDate = input.endDate;
    transport = input.transport ?? null;
  } else {
    if (!input.startDate || !input.startTime || !input.endTime) {
      throw new TripServiceError("날짜와 시작·종료시간을 입력해주세요.");
    }
    if (input.endTime <= input.startTime) throw new TripServiceError("종료시간은 시작시간보다 늦어야 합니다.");
    startDate = input.startDate;
    endDate = input.startDate;
    startTime = input.startTime;
    endTime = input.endTime;
  }

  const record = await createBusinessTrip({
    userId: input.userId,
    tripType: input.tripType,
    startDate,
    endDate,
    startTime,
    endTime,
    destination: input.destination.trim(),
    purpose: input.purpose.trim(),
    transport,
    status: "PENDING",
    approvalId: null,
  });

  try {
    const approval = await submitForApproval({
      targetType: "TRIP",
      targetId: record.id,
      submitterId: input.userId,
      departmentId: input.departmentId,
      targetVersion: record.version,
    });
    return (await updateBusinessTrip(record.id, { approvalId: approval.id }))!;
  } catch (err) {
    await updateBusinessTrip(record.id, { status: "REJECTED" });
    throw err;
  }
}

export async function recallBusinessTrip(id: string, requesterId: string): Promise<BusinessTrip> {
  const record = await getBusinessTrip(id);
  if (!record) throw new TripServiceError("출장신청 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (record.userId !== requesterId) throw new TripServiceError("본인이 신청한 건만 취소할 수 있습니다.", "FORBIDDEN");
  if (!record.approvalId) throw new TripServiceError("상신 정보가 없어 취소할 수 없습니다.", "VALIDATION");

  await recallApproval(record.approvalId, requesterId);
  return (await updateBusinessTrip(id, { status: "RECALLED" }))!;
}

/** module-2 결재 엔진이 최종 상태에 도달했을 때 lib/approval/sync.ts에서 호출한다. */
export async function syncBusinessTripFromApproval(tripId: string, approvalStatus: ApprovalStatus): Promise<void> {
  const record = await getBusinessTrip(tripId);
  if (!record) return;
  if (approvalStatus === "APPROVED") await updateBusinessTrip(tripId, { status: "APPROVED" });
  else if (approvalStatus === "REJECTED") await updateBusinessTrip(tripId, { status: "REJECTED" });
  else if (approvalStatus === "RECALLED") await updateBusinessTrip(tripId, { status: "RECALLED" });
}

export interface EligibleTripRow {
  trip: BusinessTrip;
  report: TripReport | null;
  due: TripReportDueInfo;
}

/** 결과보고 대상(완료된 시외출장) 목록 — 이미 보고된 건도 상태 확인용으로 함께 반환한다. */
export async function listEligibleTripsForReport(userId: string): Promise<EligibleTripRow[]> {
  const trips = await listCompletedOutOfTownTrips(userId);
  const rows: EligibleTripRow[] = [];
  for (const trip of trips) {
    rows.push({ trip, report: (await getTripReportByTripId(trip.id)) ?? null, due: tripReportDueInfo(trip) });
  }
  return rows;
}

export interface SubmitTripReportInput {
  userId: string;
  departmentId: string;
  tripId: string;
  workContent: string;
  transport: string;
  transportCost: number;
  transportAttachment?: { fileName: string; storedPath: string } | null;
  hasLodging: boolean;
  lodgingCost: number;
  lodgingAttachment?: { fileName: string; storedPath: string } | null;
}

export async function submitTripReport(input: SubmitTripReportInput): Promise<TripReport> {
  const trip = await getBusinessTrip(input.tripId);
  if (!trip) throw new TripServiceError("출장 건을 찾을 수 없습니다.", "NOT_FOUND");
  if (trip.userId !== input.userId) throw new TripServiceError("본인의 출장 건만 결과보고를 작성할 수 있습니다.", "FORBIDDEN");
  if (trip.tripType !== "OUT_OF_TOWN" || trip.status !== "APPROVED") {
    throw new TripServiceError("승인된 시외출장만 결과보고 대상입니다.", "NOT_ELIGIBLE");
  }
  if (await getTripReportByTripId(trip.id)) {
    throw new TripServiceError("이미 결과보고가 작성된 출장입니다.", "ALREADY_REPORTED");
  }
  if (!input.workContent.trim()) throw new TripServiceError("출장업무 처리내용을 입력해주세요.");

  const user = await getUserById(input.userId);
  if (!user) throw new TripServiceError("사용자를 찾을 수 없습니다.", "NOT_FOUND");

  const rate = await getLatestTripAllowanceRate();
  const tripDays = calendarDaysBetween(trip.startDate, trip.endDate);
  const dailyAllowance = (rate?.dailyRate ?? 0) * tripDays;
  const mealAllowance = (rate?.mealRate ?? 0) * tripDays;
  // 숙박비는 실비 청구이나, 등록된 최근 기준연도의 1박 상한액 × 박수를 초과하는 금액은 인정하지 않는다(§ TripAllowanceRate).
  const lodgingNights = Math.max(tripDays - 1, 0);
  const lodgingCap = (rate?.lodgingCapPerNight ?? 0) * lodgingNights;
  const lodgingCost = input.hasLodging ? Math.min(input.lodgingCost, lodgingCap || input.lodgingCost) : 0;

  const record = await createTripReport({
    tripId: trip.id,
    userId: input.userId,
    workContent: input.workContent.trim(),
    transport: input.transport,
    transportCost: input.transportCost,
    transportAttachment: input.transportAttachment
      ? { fileName: input.transportAttachment.fileName, fileUrl: `/api/files/${input.transportAttachment.storedPath}` }
      : null,
    hasLodging: input.hasLodging,
    lodgingCost,
    lodgingAttachment:
      input.hasLodging && input.lodgingAttachment
        ? { fileName: input.lodgingAttachment.fileName, fileUrl: `/api/files/${input.lodgingAttachment.storedPath}` }
        : null,
    dailyAllowance,
    mealAllowance,
    status: "PENDING",
    approvalId: null,
  });

  try {
    const approval = await submitForApproval({
      targetType: "TRIP_REPORT",
      targetId: record.id,
      submitterId: input.userId,
      departmentId: input.departmentId,
      targetVersion: record.version,
    });
    return (await updateTripReport(record.id, { approvalId: approval.id }))!;
  } catch (err) {
    await updateTripReport(record.id, { status: "REJECTED" });
    throw err;
  }
}

export async function syncTripReportFromApproval(reportId: string, approvalStatus: ApprovalStatus): Promise<void> {
  const report = await getTripReport(reportId);
  if (!report) return;
  if (approvalStatus === "APPROVED") await updateTripReport(reportId, { status: "APPROVED" });
  else if (approvalStatus === "REJECTED") await updateTripReport(reportId, { status: "REJECTED" });
  else if (approvalStatus === "RECALLED") await updateTripReport(reportId, { status: "RECALLED" });
}
