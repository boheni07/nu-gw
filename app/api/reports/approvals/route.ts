// Design Ref: §5 API 설계 — GET /reports/approvals?scope=submitted|processed (module-10)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buildApprovalReportRows } from "@/lib/approval/engine";
import { csvResponseHeaders, toCsv } from "@/lib/reports/csv";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "processed" ? "processed" : "submitted";

  const rows = await buildApprovalReportRows(user.id, scope);
  const csv = toCsv(rows, [
    { key: "documentType", header: "문서유형" },
    { key: "role", header: "구분" },
    { key: "status", header: "상태" },
    { key: "date", header: "일자" },
    { key: (r) => (r.delegated ? "대결" : ""), header: "대결여부" },
  ]);

  return new NextResponse(csv, { headers: csvResponseHeaders("결재이력.csv") });
}
