// Design Ref: §5 API 설계 — GET /reports/leave?scope=self|all&departmentId= (module-10)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { buildLeaveReportRows } from "@/lib/leave/service";
import { csvResponseHeaders, toCsv } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "all" ? "all" : "self";
  if (scope === "all" && !isAdmin(user)) {
    return NextResponse.json({ error: "전사 범위 다운로드는 관리자만 가능합니다." }, { status: 403 });
  }
  const departmentId = searchParams.get("departmentId") ?? undefined;

  const rows = await buildLeaveReportRows(scope, user.id, departmentId);
  const csv = toCsv(rows, [
    { key: "userName", header: "이름" },
    { key: "typeName", header: "유형" },
    { key: "period", header: "기간" },
    { key: "days", header: "일수" },
    { key: "status", header: "상태" },
    { key: "submittedAt", header: "신청일" },
  ]);

  return new NextResponse(csv, { headers: csvResponseHeaders("연차사용내역.csv") });
}
