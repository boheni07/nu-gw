// Design Ref: mockup/pages/index.html renderAdminCompanyScreen() — 카드 래핑 구조로 정리(module-12)
// §3.1 CompanySettings, §6 화면 흐름 — 관리자 회사 기본정보(1건 수정)
// module-21: 다른 관리자 화면(연차정책설정 등)과 동일하게 content-narrow(760px 제한)를 제거해 와이드 레이아웃으로 통일하고,
// 하단에 공휴일 지정 카드를 추가한다.
import { getCompanySettings, listHolidays, listTripAllowanceRates } from "@/lib/data/store";
import CompanySettingsForm from "./form";
import TripAllowanceRatesCard from "./trip-allowance-rates";
import HolidaysCard from "./holidays-card";

export default async function CompanySettingsPage() {
  const settings = await getCompanySettings();
  const rates = await listTripAllowanceRates();
  const holidays = await listHolidays(new Date().getFullYear());
  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="card-head">
          <h2>회사 기본정보</h2>
          <span className="hint">시스템 내 1건만 존재</span>
        </div>
        <CompanySettingsForm initial={settings} />
      </div>
      <TripAllowanceRatesCard initial={rates} />
      <HolidaysCard initialYear={new Date().getFullYear()} initialHolidays={holidays} />
    </div>
  );
}
