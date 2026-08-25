// Design Ref: §3.1 회사/조직/사용자 — module-1 데이터 모델
// docs/02-design/features/업무관리플랫폼.design.md 참고

export type LeaveBasis = "FISCAL_YEAR" | "HIRE_DATE";
export type UserRole = "MEMBER" | "APPROVER" | "ADMIN";
export type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "RESIGNED";

/**
 * 회사 기본정보 — 시스템 내 1건만 존재(단일 회사 전용, 멀티테넌트 아님)
 * Plan SC: 회사 기본정보는 시스템 내 1건만 존재하도록 관리
 */
export interface CompanySettings {
  id: string;
  companyName: string;
  businessRegNo: string;
  ceoName: string;
  workSchedule: string;
  /** 전사 기본 연차산정기준(부서에서 오버라이드 가능) */
  defaultLeaveBasis: LeaveBasis;
  /** 1일 환산 기준시간(연차(시간) → 일 환산에 사용). 기본 8 */
  standardWorkHoursPerDay: number;
  /** 점심시간(연차(시간) 계산 시 자동 제외). 기본 12:00 */
  lunchStart: string;
  /** 기본 13:00 */
  lunchEnd: string;
  /** 연차(시간) 신청 단위(이 값의 배수만 신청 가능). 기본 2 */
  hourlyLeaveUnitHours: number;
  /** 연차(시간) 1회 신청 상한. 기본 6 */
  hourlyLeaveMaxHours: number;
  /** module-11(Phase 3) Slack Incoming Webhook URL. null이면 Slack 전송을 시도하지 않는다 */
  slackWebhookUrl: string | null;
}

/**
 * 출장비 단가(기준연도별) — module-20 조직/결재/연차정책/출장비 구조 개편.
 * 여러 연도의 단가를 기록으로 보관하고, 실제 계산에는 가장 최근 기준연도(year 최댓값)의 값을 사용한다.
 */
export interface TripAllowanceRate {
  id: string;
  /** 기준연도 */
  year: number;
  /** 일비 단가(원/일) */
  dailyRate: number;
  /** 식비 단가(원/일) */
  mealRate: number;
  /** 숙박비 상한액(원/박) — 실비 청구분이 이 값을 초과하면 상한액까지만 인정 */
  lodgingCapPerNight: number;
}

/**
 * 부서(계층형)
 * Plan SC: 부서 계층 구조 관리
 */
export interface Department {
  id: string;
  name: string;
  /** 상위 부서(계층 구조). 최상위는 null */
  parentId: string | null;
}

/**
 * 사용자
 * Plan SC: 사용자 등록/수정, 부서·직급·입사일 관리, 권한 3단계, 퇴사 처리
 */
export interface User {
  id: string;
  name: string;
  /** 로그인 ID (unique) */
  email: string;
  departmentId: string;
  position: string;
  hireDate: string; // YYYY-MM-DD
  role: UserRole;
  employmentStatus: EmploymentStatus;
  /** 퇴사 처리 시 입력한 퇴사일자(YYYY-MM-DD). 재직 중이면 null */
  resignedAt: string | null;
}

/** 인증된 세션 사용자(클라이언트/미들웨어에서 사용) */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
}

// ---------------------------------------------------------------------------
// Design Ref: §3.2 결재 엔진 (공통, Option C) — module-2 데이터 모델
// 3종 문서(연차/일보/주보, 이후 초과근무 등)가 공유하는 독립 도메인.
// ---------------------------------------------------------------------------

export type DocumentType = "LEAVE" | "DAILY_REPORT" | "WEEKLY_REPORT" | "OVERTIME" | "TRIP" | "TRIP_REPORT";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";
export type StepLogAction = "APPROVE" | "REJECT" | "DELEGATE";

/** 부서 × 문서유형별 결재선 정의 */
export interface ApprovalLine {
  id: string;
  departmentId: string;
  documentType: DocumentType;
  isActive: boolean;
}

/** 결재선 내 단계별 승인자 */
export interface ApprovalLineStep {
  id: string;
  approvalLineId: string;
  stepOrder: number; // 1, 2, 3
  approverUserId: string;
  /** 동일 stepOrder 내 병렬 승인 여부 — true면 해당 단계 승인자 전원이 승인해야 다음 단계로 이동 */
  isParallel: boolean;
}

/** 결재선 상신 시점 스냅샷(추후 결재선이 바뀌어도 이미 상신된 건은 영향받지 않음) */
export interface ApprovalStepSnapshot {
  stepOrder: number;
  approverUserId: string;
  isParallel: boolean;
}

/** 실제 상신 건 — polymorphic 참조로 3종 문서 공용 */
export interface Approval {
  id: string;
  targetType: DocumentType;
  targetId: string;
  approvalLineId: string;
  /** 상신 시점 결재선 스냅샷(§3.2) */
  steps: ApprovalStepSnapshot[];
  currentStep: number;
  status: ApprovalStatus;
  submitterId: string;
  submittedAt: string; // ISO
  completedAt: string | null;
  /** 상신 시점 대상 문서의 version 스냅샷(§4.7, module-2에서는 필드만 보관) */
  targetVersion: number;
}

/** 단계별 처리 이력 */
export interface ApprovalStepLog {
  id: string;
  approvalId: string;
  stepOrder: number;
  /** 실제 처리자(대결자 포함) */
  approverUserId: string;
  /** 이 처리로 승인 권한이 행사된 대상(대결이 아니면 approverUserId와 동일). 병렬 승인 완료 판정에 사용(§3.2) */
  representedUserId: string;
  action: StepLogAction;
  comment: string | null;
  processedAt: string; // ISO
}

/** 위임/대결 — 승인권자 부재 시 대결자 지정 */
export interface DelegateAssignment {
  id: string;
  delegatorUserId: string;
  delegateUserId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Design Ref: §3.3 연차 관리 — module-3 데이터 모델
// ---------------------------------------------------------------------------

/** ① 연차차감형(잔여연차 차감) / ② 특별휴가(차감 없음, 결재자 재량) / ③ 공가(법정·공식 사유, 차감 없음) */
export type LeaveCategory = "ANNUAL_DEDUCT" | "SPECIAL" | "OFFICIAL";
/** DAY_RANGE: 시작일/종료일(근무일수 계산) / HOUR_RANGE: 날짜+시작·종료시간(연차(시간) 전용) */
export type LeaveInputMode = "DAY_RANGE" | "HOUR_RANGE";
export type PayType = "PAID" | "UNPAID";
export type LeaveTypeCode = "ANNUAL_DAY" | "ANNUAL_HOUR" | "CONGRATULATION" | "SICK" | "OFFICIAL";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** 근속연수 구간별 발생일수 */
export interface LeavePolicy {
  id: string;
  minYears: number;
  maxYears: number;
  grantDays: number;
}

/** 연차 유형(연차(일)/연차(시간)/경조사/병가/공가 등) */
export interface LeaveTypeConfig {
  id: string;
  code: LeaveTypeCode;
  /** 화면 표시명 */
  name: string;
  inputMode: LeaveInputMode;
  category: LeaveCategory;
  /** 신청 시 증빙파일 첨부 필수 여부 */
  requireAttachment: boolean;
  /** 급여 유형 — category(차감 여부)와 독립적인 축. 표시·기록 용도(§3.3) */
  payType: PayType;
}

/** 개인별 연차 발생/사용 현황(연도 단위) */
export interface LeaveBalance {
  id: string;
  userId: string;
  /** 산정 연도(회계연도 기준이면 달력연도) */
  periodYear: number;
  granted: number;
  used: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  leaveTypeId: string;
  /** inputMode=DAY_RANGE일 때 사용 */
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  /** inputMode=HOUR_RANGE(연차(시간))일 때만 사용 */
  startTime: string | null;
  endTime: string | null;
  /** 계산된 차감/기록 일수 */
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  approvalId: string | null;
  /** 낙관적 동시성 제어용(§4.7). 수정·취소 시마다 +1 */
  version: number;
  editedAt: string | null;
  createdAt: string;
}

/** 증빙파일(특별휴가·공가 등) — bkend.ai Storage 대신 로컬 파일 저장(uploads/) */
export interface Attachment {
  id: string;
  leaveRequestId: string;
  fileName: string;
  /** 인증된 사용자만 접근 가능한 다운로드 경로 */
  fileUrl: string;
  uploadedAt: string;
}

// ---------------------------------------------------------------------------
// Design Ref: §3.4 캘린더(일정관리) — module-4 데이터 모델
// 캘린더 화면은 Event 테이블과 승인된 LeaveRequest를 월 단위로 병합 조회한다(§4.5).
// ---------------------------------------------------------------------------

/** 사내 일정(회의/행사 등) */
export interface Event {
  id: string;
  title: string;
  startAt: string; // ISO datetime
  endAt: string; // ISO datetime
  location: string | null;
  description: string | null;
  /** 등록자 — 본인 등록 건만 수정·삭제 가능, ADMIN은 전체 관리 */
  createdBy: string;
  /** 부서 필터용 태그. null이면 전사 공통 일정 */
  departmentTag: string | null;
}

// ---------------------------------------------------------------------------
// Design Ref: §3.7 근태(출퇴근), §3.9 초과근무 신청 — module-5 데이터 모델
// ---------------------------------------------------------------------------

export type AttendanceStatus = "NORMAL" | "LEAVE" | "ABSENT";

/** 일자별 출퇴근 기록 */
export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkInAt: string | null; // ISO datetime
  /** 18:00 이전에는 값이 기록될 수 없다(§4.6) */
  checkOutAt: string | null;
  status: AttendanceStatus;
  /** 퇴근 미체크 + 18:30 경과 시 자동 기록된 건인지(§4.6) */
  autoCheckedOut: boolean;
}

export type OvertimeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";

/** 초과근무 신청 — 연차/업무보고와 동일한 공통 결재 엔진 재사용(targetType='OVERTIME') */
export interface OvertimeRequest {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  /** 19:00 이후 값만 허용(프론트 검증) */
  expectedEndTime: string; // HH:MM
  workDetail: string;
  reason: string;
  status: OvertimeRequestStatus;
  approvalId: string | null;
  version: number;
  editedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Design Ref: module-13 출장신청/출장결과보고 — 연차/초과근무와 동일한 공통 결재 엔진 재사용
// (targetType='TRIP'/'TRIP_REPORT'). 관내출장은 결과보고 대상이 아니며, 시외출장만 완료 후
// 3일 이내 결과보고(출장비 청구 포함)가 필요하다.
// ---------------------------------------------------------------------------

/** LOCAL: 관내출장(당일, 시작·종료시간) / OUT_OF_TOWN: 시외출장(시작일~종료일) */
export type TripType = "LOCAL" | "OUT_OF_TOWN";
export type BusinessTripStatus = "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";

export interface BusinessTrip {
  id: string;
  userId: string;
  tripType: TripType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (LOCAL이면 startDate와 동일)
  /** tripType=LOCAL일 때만 사용 */
  startTime: string | null;
  endTime: string | null;
  destination: string;
  purpose: string;
  /** tripType=OUT_OF_TOWN일 때만 사용(예정 교통편) */
  transport: string | null;
  status: BusinessTripStatus;
  approvalId: string | null;
  version: number;
  editedAt: string | null;
  createdAt: string;
}

export type TripReportStatus = "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";

/** 시외출장 완료 건에 대한 결과보고 + 출장비 청구(1:1 BusinessTrip) */
export interface TripReport {
  id: string;
  tripId: string;
  userId: string;
  workContent: string;
  transport: string;
  transportCost: number;
  transportAttachment: { fileName: string; fileUrl: string } | null;
  hasLodging: boolean;
  lodgingCost: number;
  lodgingAttachment: { fileName: string; fileUrl: string } | null;
  /** 회사 단가 × 출장일수로 자동 계산되어 기록된 값(§ dailyAllowanceRate) */
  dailyAllowance: number;
  mealAllowance: number;
  status: TripReportStatus;
  approvalId: string | null;
  version: number;
  editedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Design Ref: §3.5 일일/주간 업무보고 — module-6 데이터 모델(일일업무보고)
// ---------------------------------------------------------------------------

export type DailyReportStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";

export interface DailyReport {
  id: string;
  userId: string;
  reportDate: string; // YYYY-MM-DD
  /** 당일 업무실적 — 초안: 전일 tomorrowPlan 자동 반영(§4.3) */
  todayResult: string;
  /** 다음날 업무계획 */
  tomorrowPlan: string;
  notes: string;
  status: DailyReportStatus;
  approvalId: string | null;
  /** 낙관적 동시성 제어용(§4.7) */
  version: number;
  editedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Design Ref: §3.5 일일/주간 업무보고 — module-7 데이터 모델(주간업무보고)
// ---------------------------------------------------------------------------

export type WeeklyReportStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "RECALLED";

export interface WeeklyReport {
  id: string;
  userId: string;
  weekStartDate: string; // YYYY-MM-DD (월요일)
  weekEndDate: string; // YYYY-MM-DD (금요일)
  /** 금주 업무실적 — 초안: 해당 주 DailyReport.todayResult 취합(§4.4) */
  thisWeekResult: string;
  /** 차주 업무계획 */
  nextWeekPlan: string;
  notes: string;
  status: WeeklyReportStatus;
  approvalId: string | null;
  version: number;
  editedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Design Ref: §3.6 알림, §2.6 대시보드 & 알림 — module-8 데이터 모델
// ---------------------------------------------------------------------------

export type NotificationType = "SUBMITTED" | "APPROVED" | "REJECTED" | "DUE_SOON";

export interface Notification {
  id: string;
  /** 수신자 */
  userId: string;
  type: NotificationType;
  targetType: DocumentType;
  targetId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Design Ref: §2.9 인사기록카드, §3.8 HrRecord — module-9 데이터 모델
// ---------------------------------------------------------------------------

export type MilitaryStatus = "해당없음" | "군필" | "미필" | "면제";

export interface EmergencyContact {
  relation: string;
  name: string;
  phone: string;
}

export interface EducationEntry {
  school: string;
  major: string;
  degree: string;
  graduationDate: string; // YYYY-MM-DD
}

export interface CareerEntry {
  company: string;
  position: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, 재직중이면 빈 문자열
}

export interface CertificateEntry {
  name: string;
  issuer: string;
  acquiredDate: string; // YYYY-MM-DD
}

export interface FamilyEntry {
  relation: string;
  name: string;
  birth: string; // YYYY-MM-DD
}

/** 사용자 1인당 1건(표준서식). 본인만 조회·수정 가능(§3.8). */
export interface HrRecord {
  userId: string; // FK(User, unique) — PK로 사용
  nameKr: string;
  nameEn: string;
  /** 주민등록번호 전체는 수집하지 않고 생년월일로 대체(개인정보 최소수집, §3.8) */
  birth: string; // YYYY-MM-DD
  gender: string;
  mobile: string;
  email: string;
  address: string;
  emergencyContact: EmergencyContact;
  education: EducationEntry[];
  career: CareerEntry[];
  certificates: CertificateEntry[];
  family: FamilyEntry[];
  militaryStatus: MilitaryStatus;
  militaryBranch: string;
  militaryRank: string;
  militaryPeriod: string;
  /** 서약 동의 여부(true여야 저장 허용) */
  agreed: boolean;
  savedAt: string | null; // ISO datetime, 최종 저장일시
}

/** AUTO: 연도별 법정공휴일 자동 가져오기로 등록됨. MANUAL: 관리자가 직접 추가함. */
export type HolidaySource = "AUTO" | "MANUAL";

/** 회사 기본정보 §공휴일 지정 — 전사 공통 휴일 목록(부서별 오버라이드 없음). */
export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD, 전사 유일
  name: string;
  source: HolidaySource;
}
