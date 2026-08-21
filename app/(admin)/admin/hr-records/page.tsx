// Design Ref: §7 RBAC, module-15 §관리자 인사기록 관리 — 재직자 전원의 인사기록카드를 관리자가 조회·수정한다.
import { getDepartment, listHrRecords, listUsers } from "@/lib/data/store";
import HrRecordsAdminClient, { type HrRecordRow } from "./client";

export default async function AdminHrRecordsPage() {
  const [users, records] = await Promise.all([listUsers(), listHrRecords()]);
  const recordByUserId = new Map(records.map((r) => [r.userId, r]));

  const rows: HrRecordRow[] = [];
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

  return <HrRecordsAdminClient initialRows={rows} />;
}
