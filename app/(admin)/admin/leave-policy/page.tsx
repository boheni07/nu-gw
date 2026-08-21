// Design Ref: §2.5 연차정책 관리, §6 화면 흐름
// module-20: 전사 기본 연차산정기준을 회사 기본정보 화면에서 이 화면으로 이동(부서별 오버라이드는 폐지).
import { getCompanySettings, listLeavePolicies, listLeaveTypeConfigs } from "@/lib/data/store";
import LeavePolicyClient from "./client";

export default async function LeavePolicyPage() {
  const company = await getCompanySettings();
  const policies = await listLeavePolicies();
  const types = await listLeaveTypeConfigs();

  return (
    <div className="stack">
      <LeavePolicyClient initialDefaultLeaveBasis={company.defaultLeaveBasis} initialPolicies={policies} initialTypes={types} />
    </div>
  );
}
