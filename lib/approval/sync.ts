// Design Ref: §4.2-3/4 "대상 문서 status 동기화" — 결재 엔진(module-2)과 각 문서 모듈을 잇는 얇은 디스패처.
// 엔진(lib/approval/engine.ts)은 문서별 로직을 몰라야 하므로, 이 파일만 문서 모듈이 늘어날 때마다 갱신한다.
import type { ApprovalStatus, DocumentType } from "@/types";
import { syncLeaveRequestFromApproval } from "@/lib/leave/service";
import { syncOvertimeRequestFromApproval } from "@/lib/attendance/service";
import { syncDailyReportFromApproval } from "@/lib/daily-report/service";
import { syncWeeklyReportFromApproval } from "@/lib/weekly-report/service";
import { syncBusinessTripFromApproval, syncTripReportFromApproval } from "@/lib/trip/service";

export async function syncApprovalTarget(targetType: DocumentType, targetId: string, status: ApprovalStatus): Promise<void> {
  switch (targetType) {
    case "LEAVE":
      await syncLeaveRequestFromApproval(targetId, status);
      return;
    case "OVERTIME":
      await syncOvertimeRequestFromApproval(targetId, status);
      return;
    case "DAILY_REPORT":
      await syncDailyReportFromApproval(targetId, status);
      return;
    case "WEEKLY_REPORT":
      await syncWeeklyReportFromApproval(targetId, status);
      return;
    case "TRIP":
      await syncBusinessTripFromApproval(targetId, status);
      return;
    case "TRIP_REPORT":
      await syncTripReportFromApproval(targetId, status);
      return;
  }
}
