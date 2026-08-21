// Design Ref: §3.8 인사기록카드 — 본인 조회/수정(app/api/hr-records/me)과 관리자 조회/수정
// (app/api/admin/hr-records/[userId])이 공유하는 검증/기본값 로직. module-15 관리자 인사기록 관리에서 추출.
import type { HrRecord, MilitaryStatus } from "@/types";

const MILITARY_STATUSES: MilitaryStatus[] = ["해당없음", "군필", "미필", "면제"];

export function emptyHrRecord(userId: string, nameKr: string, email: string): HrRecord {
  return {
    userId,
    nameKr,
    nameEn: "",
    birth: "",
    gender: "",
    mobile: "",
    email,
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
}

/**
 * 요청 body를 저장 가능한 형태로 검증·정규화한다. agreed 값은 호출부(본인=body 그대로, 관리자=기존값 유지)가 결정해 넘긴다.
 */
export function sanitizeHrRecordPatch(
  body: Record<string, unknown>,
  fallbackNameKr: string,
  fallbackEmail: string,
  agreed: boolean
): Omit<HrRecord, "userId" | "savedAt"> {
  const emergencyContact = (body.emergencyContact ?? {}) as Record<string, unknown>;
  return {
    nameKr: typeof body.nameKr === "string" && body.nameKr.trim() ? body.nameKr.trim() : fallbackNameKr,
    nameEn: typeof body.nameEn === "string" ? body.nameEn : "",
    birth: typeof body.birth === "string" ? body.birth : "",
    gender: typeof body.gender === "string" ? body.gender : "",
    mobile: typeof body.mobile === "string" ? body.mobile : "",
    email: typeof body.email === "string" ? body.email : fallbackEmail,
    address: typeof body.address === "string" ? body.address : "",
    emergencyContact: {
      relation: typeof emergencyContact.relation === "string" ? emergencyContact.relation : "",
      name: typeof emergencyContact.name === "string" ? emergencyContact.name : "",
      phone: typeof emergencyContact.phone === "string" ? emergencyContact.phone : "",
    },
    education: Array.isArray(body.education) ? body.education : [],
    career: Array.isArray(body.career) ? body.career : [],
    certificates: Array.isArray(body.certificates) ? body.certificates : [],
    family: Array.isArray(body.family) ? body.family : [],
    militaryStatus: MILITARY_STATUSES.includes(body.militaryStatus as MilitaryStatus)
      ? (body.militaryStatus as MilitaryStatus)
      : "해당없음",
    militaryBranch: typeof body.militaryBranch === "string" ? body.militaryBranch : "",
    militaryRank: typeof body.militaryRank === "string" ? body.militaryRank : "",
    militaryPeriod: typeof body.militaryPeriod === "string" ? body.militaryPeriod : "",
    agreed,
  };
}
