# 업무관리 플랫폼 Phase 2 설계서 (Design)

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 업무관리 플랫폼(nuGW) — Phase 2 |
| 작성일 | 2026-08-19 |
| 문서 단계 | PDCA - Design |
| 근거 문서 | [Phase 2 Plan](../../01-plan/features/업무관리플랫폼-phase2.plan.md) |
| 선택 아키텍처 | **Option C — 실용적 균형**(공용 CSV 빌더 신설 + 기존 서비스 레이어에 리포트 함수 추가) |

## Context Anchor (Plan에서 계승)

| 구분 | 내용 |
|---|---|
| WHY | 데이터가 쌓여도 외부 반출이 안 되고, 대결자가 알림을 못 받아 위임이 실효성 없음 |
| WHO | 전 직원(리포트), 결재자·대결자(위임 고도화) |
| RISK | 리포트 다운로드 권한 범위 오설정 시 개인정보 유출 |
| SUCCESS | 리포트 3종 CSV 다운로드 + 대결자 알림 수신 + 결재 이력에 대결 여부 표시 |
| SCOPE | 통계/리포트 다운로드, 위임/대결 고도화(Web Push·Slack 연동은 제외, 방향만 §2.3 기록) |

## Executive Summary

| 항목 | 내용 |
|---|---|
| 기능 | 연차/근태/결재 CSV 리포트 다운로드 + 대결자 알림·이력 가시성 |
| 선택 설계안 | Option C — `lib/reports/csv.ts` 공용 빌더 + 기존 서비스 파일에 리포트 조회 함수 추가, 얇은 API 라우트 3개 |
| 핵심 데이터 모델 | 신규 테이블 없음(기존 LeaveRequest/AttendanceRecord/Approval/DelegateAssignment 재사용) |
| 핵심 로직 | 권한 스코프 분기(본인/ADMIN 전사), CSV 인코딩(UTF-8 BOM), 대결자 역조회 알림 확장 |
| 구현 모듈 | module-10(리포트 다운로드 + 위임/대결 고도화) — Phase 1의 module-2/3/5 위에 얹는 단일 모듈 |

**Value Delivered**

| 관점 | 내용 |
|---|---|
| Problem | 데이터 반출 불가, 대결자 알림 부재로 위임 무력화 |
| Solution | 공용 CSV 빌더 기반 리포트 3종 + 대결자 알림 확장 |
| Function/UX Effect | 화면별 다운로드 버튼, 결재 이력에 "대결 처리" 배지, 대결자도 SUBMITTED 알림 수신 |
| Core Value | 보고서 작성 시간 단축 + 위임 체계 신뢰성 확보 |

---

## 1. Overview

Phase 1에서 구축한 8개 도메인(연차/근태/결재/캘린더/일보/주보/대시보드/인사기록)의 데이터를 그대로 활용해 **①CSV 다운로드**와 **②위임 알림 확장** 두 기능을 얹는다. 신규 테이블은 없고, 기존 `lib/*/service.ts`와 `lib/data/store.ts` 조회 함수를 재사용하는 것이 핵심이다.

## 2. 아키텍처 선택 근거 (Option C 채택)

| 옵션 | 요약 | 채택 여부 |
|---|---|---|
| A. 최소 변경 | 라우트에 CSV 로직 인라인 | ❌ 3곳 중복, xlsx 전환 시 3곳 다 수정 필요 |
| B. 클린 아키텍처 | 리포트/알림 완전 독립 모듈화 | ❌ 이번 스코프(리포트 3종+알림 확장 1건) 대비 과설계 |
| **C. 실용적 균형(채택)** | 공용 CSV 빌더 1개 + 기존 서비스 파일 확장 | ✅ Phase 1 패턴과 일관, 재사용성과 단순함의 균형 |

## 3. 데이터 모델 — 변경 없음

리포트는 조회 전용이며, 위임 알림 확장도 기존 `DelegateAssignment`/`Notification` 스키마를 그대로 사용한다. `CompanySettings.slackWebhookUrl`(§2.3 대비용) 필드는 이번 사이클에서 **추가하지 않는다** — 실제 사용 시점(다음 사이클)에 함께 추가.

## 4. 핵심 로직 설계

### 4.1 공용 CSV 빌더 (`lib/reports/csv.ts`)

```
toCsv(rows: Record<string, string|number>[], columns: {key, header}[]): string
  → 헤더 라인 + 각 row를 콤마 구분, 값에 콤마/줄바꿈 포함 시 큰따옴표 이스케이프
  → 맨 앞에 UTF-8 BOM(﻿) 부착 → 엑셀에서 한글 깨짐 방지
```
문서 종류가 다른 3개 리포트가 전부 이 함수 하나만 재사용한다.

### 4.2 리포트별 조회 함수 (기존 서비스 파일에 추가)

| 리포트 | 위치 | 조회 로직 | 권한 |
|---|---|---|---|
| 연차 사용 내역 | `lib/leave/service.ts`에 `buildLeaveReportRows` 추가 | 본인: `listLeaveRequestsByUser` / ADMIN+dept 지정 시: 전 사용자 순회 후 병합 | 본인 or ADMIN |
| 근태 이력 | `lib/attendance/service.ts`에 `buildAttendanceReportRows` 추가 | 기존 `getMonthlyAttendance` 재사용(§4.6 로직 그대로) | 본인 or ADMIN(module-5 권한 패턴 재사용) |
| 결재 이력 | `lib/approval/engine.ts`에 `buildApprovalReportRows` 추가 | `listApprovalStepLogs`를 사용자 기준으로 역조회하는 신규 store 함수 `listApprovalStepLogsByActor(userId)` 추가 | 본인(상신·처리 이력 각각) |

### 4.3 대결자 알림 확장 (`lib/approval/engine.ts`)

현재 `notifySubmitted(approval, approverUserIds)`는 원 승인자에게만 알림을 보낸다. 이를 다음과 같이 확장한다.

```
notifySubmitted(approval, approverUserIds):
  for approverId in approverUserIds:
    알림(approverId)  // 기존 동작 유지
    delegates = listActiveDelegateUserIds(approverId, 오늘)  // 신규 store 함수(역조회)
    for delegateId in delegates:
      알림(delegateId, message: "{원승인자}님을 대신해 결재할 건이 있습니다")
```

- 신규 store 함수 `listActiveDelegateUserIds(delegatorUserId, dateKey)`: 기존 `listActiveDelegatorsForToday(delegateUserId)`(대결자→위임자 조회)의 역방향(위임자→대결자 조회)
- 알림 타입은 기존 `SUBMITTED`를 재사용하되 message로 대결 여부를 구분(신규 NotificationType 추가하지 않음 — §3.6 enum 변경 없음)

### 4.4 결재 이력의 대결 표시

결재 상세/이력 응답(`GET /approvals/pending`, 결재 상세 조회)에 각 `ApprovalStepLog.action === "DELEGATE"`인 로그를 UI에서 "N님이 M님을 대신해 처리" 형태로 렌더링. 이미 로그에 `approverUserId`(실처리자)와 `representedUserId`(대결 대상)가 모두 저장되어 있으므로 **백엔드 변경 없이 프론트 렌더링만 추가**.

## 5. API 설계

| 그룹 | 엔드포인트 | 설명 |
|---|---|---|
| 리포트 | `GET /api/reports/leave?scope=self\|all&departmentId=&start=&end=` | CSV 스트림 응답(`Content-Type: text/csv`), scope=all은 ADMIN 전용 |
| 리포트 | `GET /api/reports/attendance?month=&scope=self\|all&userId=` | 동일 |
| 리포트 | `GET /api/reports/approvals?scope=submitted\|processed` | 본인 상신/처리 이력만(ADMIN 전사 조회는 이번 범위 제외) |
| 위임 | 기존 `/api/delegates` 유지, `GET /api/delegates?includeExpired=true` 파라미터 추가(과거 이력 조회) |

## 6. 화면 흐름

- 연차 신청 내역 화면: 상단에 "CSV 다운로드" 버튼 → 클릭 시 `GET /api/reports/leave` 새 탭/다운로드
- 출퇴근(월별 조회) 화면: 동일 위치에 "CSV 다운로드" 버튼(ADMIN은 조회 중인 대상 기준)
- 결재함: 목록 상단 "처리 이력 CSV 다운로드" + 각 행에 대결 처리 시 "대결" 배지
- 대결자 지정 화면: "지난 위임 이력 보기" 토글 추가

## 7. 권한(RBAC) — Phase 1 원칙 재사용

| 역할 | 리포트 접근 범위 |
|---|---|
| MEMBER/APPROVER | 본인 데이터만 |
| ADMIN | scope=all 파라미터로 전사 범위(연차/근태만 — 결재 이력 전사 조회는 이번 범위 제외) |

## 8. 테스트 계획

1. 본인이 아닌 타인 데이터를 scope=all 없이 요청 시 403
2. MEMBER가 scope=all 요청 시 403
3. CSV 응답의 한글이 엑셀에서 깨지지 않는지(BOM 확인)
4. 대결 지정 후 결재 상신 시 원 승인자+대결자 모두 알림 수신
5. 결재 이력에 대결 처리 건이 "대결" 표시로 구분되는지
6. `npm run smoke`에 위 시나리오 추가 후 전체 통과

---

## 11. Implementation Guide

### 11.1 Module Map

| 모듈 | 범위 | 의존성 |
|---|---|---|
| module-10 | CSV 빌더 + 리포트 3종(연차/근태/결재) + 대결자 알림 확장 + 결재 이력 대결 표시 UI | module-2, module-3, module-5 |

### 11.2 Files to Create/Modify (예상)

- 신규: `lib/reports/csv.ts`, `app/api/reports/{leave,attendance,approvals}/route.ts` 3개, 각 화면의 다운로드 버튼 컴포넌트
- 수정: `lib/leave/service.ts`, `lib/attendance/service.ts`, `lib/approval/engine.ts`, `lib/data/store.ts`(역조회 함수 2개), `app/(app)/leave/client.tsx`, `app/(app)/attendance/client.tsx`, `app/(app)/approvals/client.tsx`, `app/(app)/delegates/client.tsx`, `scripts/smoke-test.mjs`

### 11.3 Session Guide

단일 세션으로 충분한 규모(module-10 하나) — `/pdca do 업무관리플랫폼-phase2` (스코프 파라미터 불필요).

## 9. 다음 단계

- `/pdca do 업무관리플랫폼-phase2` 진행
- CSV 응답이 실제 엑셀에서 정상적으로 열리는지는 구현 후 브라우저로 다운로드해 직접 확인 필요(자동 검증은 형식까지만 커버)
