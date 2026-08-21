// Design Ref: §6 화면 흐름 — 관리자 결재선 설정: 부서 선택 → 문서유형별 단계·승인자 지정
import { listApprovalLines, listDepartments, listUsers } from "@/lib/data/store";
import ApprovalLinesClient from "./client";

export default async function ApprovalLinesPage() {
  const departments = await listDepartments();
  const users = (await listUsers()).filter((u) => u.employmentStatus === "ACTIVE");
  const lines = (await listApprovalLines()).filter((l) => l.isActive);

  return <ApprovalLinesClient departments={departments} users={users} initialLines={lines} />;
}
