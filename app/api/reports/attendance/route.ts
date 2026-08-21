// Design Ref: §5 API 설계 — GET /reports/attendance?month=&scope=self|all (module-10)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { buildAttendanceReportRows } from "@/lib/attendance/service";
import { csvResponseHeaders, toCsv } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const scope = searchParams.get("scope") === "all" ? "all" : "self";
  if (scope === "all" && !isAdmin(user)) {
    return NextResponse.json({ error: "전사 범위 다운로드는 관리자만 가능합니다." }, { status: 403 });
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month는 YYYY-MM 형식이어야 합니다." }, { status: 400 });
  }

  const rows = await buildAttendanceReportRows(scope, user.id, month);
  const csv = toCsv(rows, [
    { key: "userName", header: "이름" },
    { key: "date", header: "날짜" },
    { key: (r) => (r.checkInAt ? new Date(r.checkInAt).toTimeString().slice(0, 5) : ""), header: "출근" },
    { key: (r) => (r.checkOutAt ? new Date(r.checkOutAt).toTimeString().slice(0, 5) : ""), header: "퇴근" },
    { key: "status", header: "상태" },
  ]);

  return new NextResponse(csv, { headers: csvResponseHeaders(`근태이력_${month}.csv`) });
}
