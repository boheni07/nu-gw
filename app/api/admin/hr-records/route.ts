// Design Ref: §7 RBAC, module-15 §관리자 인사기록 관리 — GET /admin/hr-records (재직자 전원 + 작성 현황, 관리자 전용)
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getDepartment, listHrRecords, listUsers } from "@/lib/data/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });

  const [users, records] = await Promise.all([listUsers(), listHrRecords()]);
  const recordByUserId = new Map(records.map((r) => [r.userId, r]));

  const rows = [];
  for (const u of users.filter((u) => u.employmentStatus !== "RESIGNED")) {
    const dept = await getDepartment(u.departmentId);
    const record = recordByUserId.get(u.id);
    rows.push({
      userId: u.id,
      userName: u.name,
      deptName: dept?.name ?? "—",
      position: u.position,
      written: !!record,
      savedAt: record?.savedAt ?? null,
    });
  }

  return NextResponse.json(rows);
}
