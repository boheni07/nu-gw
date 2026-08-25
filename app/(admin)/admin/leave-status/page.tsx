// Design Ref: §7 RBAC, module-13 §관리자 연차 현황 — 재직자 전원의 연차 부여/사용/잔여를 관리자가 조회한다.
// 연차산정기준(전사 공통, 연차정책설정에서 관리)에 따라 적절한 조회 방식이 달라 서버에서 함께 내려준다.
import { getCompanySettings } from "@/lib/data/store";
import LeaveStatusClient from "./client";

export default async function LeaveStatusPage() {
  const company = await getCompanySettings();
  return <LeaveStatusClient initialBasis={company.defaultLeaveBasis} />;
}
