// Design Ref: §5 API 설계, §4.5 캘린더 병합 조회 — GET /calendar?month=&dept=
// Event + 승인된 LeaveRequest를 월 단위로 병합 조회한다. 신규 테이블 없이 기존 데이터를 재사용한다.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getLeaveTypeConfig,
  getUserById,
  listApprovedLeaveRequestsOverlapping,
  listEventsOverlapping,
} from "@/lib/data/store";

function lastDayOfMonth(year: number, month1to12: number): string {
  const d = new Date(year, month1to12, 0); // month(0-based)+1일 => 전달 말일
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7); // YYYY-MM
  const dept = searchParams.get("dept") || null;

  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return NextResponse.json({ error: "month는 YYYY-MM 형식이어야 합니다." }, { status: 400 });
  const [, yearStr, monthStr] = match;
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const rangeStart = `${month}-01`;
  const rangeEnd = lastDayOfMonth(year, monthNum);

  const rawEvents = (await listEventsOverlapping(`${rangeStart}T00:00:00`, `${rangeEnd}T23:59:59`)).filter(
    (e) => !dept || e.departmentTag === null || e.departmentTag === dept
  );
  const events = await Promise.all(
    rawEvents.map(async (e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt,
      location: e.location,
      description: e.description,
      createdBy: e.createdBy,
      createdByName: (await getUserById(e.createdBy))?.name ?? "알수없음",
      departmentTag: e.departmentTag,
    }))
  );

  const rawLeaves = await listApprovedLeaveRequestsOverlapping(rangeStart, rangeEnd);
  const leavesAll = await Promise.all(
    rawLeaves.map(async (r) => {
      const requester = await getUserById(r.userId);
      const leaveType = await getLeaveTypeConfig(r.leaveTypeId);
      return {
        id: r.id,
        userId: r.userId,
        userName: requester?.name ?? "알수없음",
        departmentId: requester?.departmentId ?? null,
        typeName: leaveType?.name ?? "연차",
        startDate: r.startDate,
        endDate: r.endDate,
      };
    })
  );
  const leaves = leavesAll.filter((l) => !dept || l.departmentId === dept);

  return NextResponse.json({ month, events, leaves });
}
