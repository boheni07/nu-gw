// Design Ref: module-13 §화면 흐름 — 출장결과보고: 완료된 시외출장 목록 → 결과보고 작성/조회
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getLatestTripAllowanceRate } from "@/lib/data/store";
import { listEligibleTripsForReport } from "@/lib/trip/service";
import TripReportClient from "./client";

export default async function TripReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await listEligibleTripsForReport(user.id);
  const rate = await getLatestTripAllowanceRate();

  return (
    <TripReportClient
      initialRows={rows}
      dailyAllowanceRate={rate?.dailyRate ?? 0}
      mealAllowanceRate={rate?.mealRate ?? 0}
      lodgingCapPerNight={rate?.lodgingCapPerNight ?? 0}
    />
  );
}
