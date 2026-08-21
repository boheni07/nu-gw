// Design Ref: §2.5 조직 관리 — 부서(계층형) 등록/수정. module-20에서 부서별 연차산정기준 오버라이드는 폐지(연차정책 설정으로 통합).
import { listDepartments } from "@/lib/data/store";
import DepartmentsClient from "./client";

export default async function DepartmentsPage() {
  const departments = await listDepartments();

  return <DepartmentsClient initial={departments} />;
}
