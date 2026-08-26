// Design Ref: §2.9 인사기록카드 — 사이드바(topbar) 사용자 메뉴에서 진입, 본인만 조회·수정
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getHrRecord } from "@/lib/data/store";
import HrRecordClient from "./client";
import type { HrRecord } from "@/types";

export default async function HrRecordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await getHrRecord(user.id);
  const initial: HrRecord = existing ?? {
    userId: user.id,
    nameKr: user.name,
    nameEn: "",
    birth: "",
    gender: "",
    mobile: "",
    // 로그인 아이디(username)는 더 이상 이메일 형식을 보장하지 않아 기본값으로 쓰지 않는다(본인이 직접 입력).
    email: "",
    address: "",
    emergencyContact: { relation: "", name: "", phone: "" },
    education: [],
    career: [],
    certificates: [],
    family: [],
    militaryStatus: "해당없음",
    militaryBranch: "",
    militaryRank: "",
    militaryPeriod: "",
    agreed: false,
    savedAt: null,
  };

  return (
    <div className="stack">
      <HrRecordClient initial={initial} />
    </div>
  );
}
