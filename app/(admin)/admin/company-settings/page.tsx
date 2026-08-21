// Design Ref: mockup/pages/index.html renderAdminCompanyScreen() — 카드 래핑 구조로 정리(module-12)
// §3.1 CompanySettings, §6 화면 흐름 — 관리자 회사 기본정보(1건 수정)
import { getCompanySettings, listTripAllowanceRates } from "@/lib/data/store";
import CompanySettingsForm from "./form";
import TripAllowanceRatesCard from "./trip-allowance-rates";

export default async function CompanySettingsPage() {
  const settings = await getCompanySettings();
  const rates = await listTripAllowanceRates();
  return (
    <div className="stack">
      <div className="card card-pad content-narrow">
        <div className="card-head">
          <h2>회사 기본정보</h2>
          <span className="hint">시스템 내 1건만 존재</span>
        </div>
        <CompanySettingsForm initial={settings} />
      </div>
      <TripAllowanceRatesCard initial={rates} />
    </div>
  );
}
