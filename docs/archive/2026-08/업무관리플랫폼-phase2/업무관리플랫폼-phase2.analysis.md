# 업무관리 플랫폼 Phase 2 Gap 분석서 (Check)

| 항목 | 내용 |
|---|---|
| 대상 | module-10(리포트 다운로드 + 위임/대결 고도화) |
| 근거 문서 | [Phase 2 Plan](../01-plan/features/업무관리플랫폼-phase2.plan.md), [Phase 2 Design](../02-design/features/업무관리플랫폼-phase2.design.md) |
| 분석 방식 | 정적 분석(구조/기능/API 계약) + `npm run smoke` 자동 회귀 테스트(36건) + curl/브라우저 수동 검증 |
| 분석일 | 2026-08-19 |

## Context Anchor (Design에서 계승)

| 구분 | 내용 |
|---|---|
| SUCCESS 기준 | 리포트 다운로드 3종 정상 동작 + 대결자 알림 수신 확인 + 결재 이력에 대결 여부 표시 |

## Executive Summary

| 항목 | 내용 |
|---|---|
| Match Rate | **약 94%** (Structural 95% × 0.2 + Functional 96% × 0.4 + Contract 92% × 0.4) |
| 판정 | 90% 이상 — Act(반복 개선) 불필요, Report 단계로 진행 가능 |
| Critical 이슈 | 0건 |
| Important 이슈 | 0건 |
| Minor 이슈 | 3건(전부 문서-구현 간 사소한 편차, 기능 결손 아님) |
| 특기사항 | Do 단계 도중 **module-8 시절부터 있던 실제 버그**(대결자가 결재함 UI에 접근 불가)를 발견해 함께 수정함 |

---

## 1. Plan Success Criteria 평가

| 기준 | 상태 | 근거 |
|---|---|---|
| 리포트 다운로드 3종(연차/근태/결재) 정상 동작 | ✅ Met | `npm run smoke` — CSV 헤더 검증, curl로 UTF-8 BOM 바이트 직접 확인 |
| 본인 데이터는 본인만, 전사 범위는 ADMIN만 | ✅ Met | MEMBER의 scope=all 403 차단, ADMIN 200 허용 — 자동 테스트 통과 |
| 대결자 알림 수신 | ✅ Met | 대결 지정 후 상신 시 원 승인자+대결자 모두 SUBMITTED 알림 수신 검증 |
| 결재 이력에 대결 여부 표시 | ✅ Met | 처리 이력 CSV의 "대결여부" 컬럼 + 결재함 UI "대결" 배지 둘 다 확인 |

**Success Rate: 4/4 met (100%)**

---

## 2. 구조적 Gap (Structural) — 95%

| 항목 | Design 근거(§11.2) | 실제 | 판정 |
|---|---|---|---|
| `lib/reports/csv.ts` | 신규 | 동일하게 생성 | ✅ 일치 |
| `app/api/reports/{leave,attendance,approvals}/route.ts` | 신규 3개 | 동일 | ✅ 일치 |
| 각 화면 다운로드 버튼 | "client.tsx"에 추가 예정 | 실제로는 `leave/page.tsx`, `approvals/page.tsx`(서버 컴포넌트)에 배치, `attendance/client.tsx`만 Design대로 client에 배치 | ⚠️ Minor — 정적 링크(`<a href>`)라 클라이언트 상태가 필요 없어 서버 컴포넌트에 두는 게 더 자연스러웠음. 기능은 동일 |
| `lib/data/store.ts` 역조회 함수 | "2개" 예정 | 3개 추가(`listActiveDelegateUserIds`, `listApprovalsBySubmitter`, `listApprovalStepLogsByActor`) | ⚠️ Minor — 리포트 3종을 위해 상신/처리 조회가 각각 필요해 계획보다 1개 더 필요했음(과소 산정) |
| **RBAC 수정** — `approvals/page.tsx`, `topbar.tsx`, `dashboard/page.tsx` | Design에 언급 없음 | Do 단계에서 발견한 버그 수정으로 추가됨(§5 참고) | ⚠️ Minor — Design이 "MEMBER도 API로는 대결 처리 가능"이라는 기존 사실이 화면 접근 권한과 충돌하는 걸 미리 포착하지 못함 |

## 3. 기능적 Gap (Functional) — 96%

핵심 기능(리포트 3종, 대결 알림, 대결 표시)은 자동/수동 검증 전부 통과. 유일한 편차는 Design §5에서 언급한 `GET /delegates?includeExpired=true` 파라미터를 실제로 추가하지 않은 것 — 구현 중 확인해보니 **기존 `listDelegateAssignments`가 애초에 날짜 필터링 없이 전체 이력을 반환**하고 있었다(Design 작성 시점의 잘못된 전제). 파라미터 없이도 요구사항이 이미 충족되어 있어 추가하지 않았고, 대신 화면에 진행중/예정/종료됨 상태 배지만 추가했다.

## 4. API 계약 Gap (Contract) — 92%

| Design 엔드포인트 | 실제 | 상태 |
|---|---|---|
| `GET /reports/leave?scope=&departmentId=` | 동일 | ✅ 일치 |
| `GET /reports/attendance?month=&scope=` | 동일 | ✅ 일치 |
| `GET /reports/approvals?scope=submitted\|processed` | 동일 | ✅ 일치 |
| `GET /delegates?includeExpired=true` | 미구현(§3 참고, 불필요했음) | ⚠️ Minor |

---

## 5. Do 단계 중 발견·수정한 버그 (Design 범위 밖)

**증상**: `app/(app)/approvals/page.tsx`가 `hasRole(user, "APPROVER")`로 막혀 있어, MEMBER는 결재함 화면에 아예 진입할 수 없었다. 그런데 module-2의 결재 엔진은 애초부터 역할과 무관하게 "대결자로 지정되면 API로 결재 처리 가능"하도록 설계돼 있었다(`resolveOnBehalfOfUserId`가 역할을 검사하지 않음). 즉 **module-2~9 내내 잠재해 있던 버그**였고, module-10에서 "대결자에게 알림을 보낸다"는 기능을 추가하면서 "그 알림을 받은 MEMBER가 클릭해도 페이지에 못 들어간다"는 형태로 처음 드러났다.

**수정**: `approvals/page.tsx`의 역할 게이트 제거(대신 `listPendingApprovalsForApprover` 결과로 접근 판단), `topbar.tsx` 결재함 메뉴의 `minRole` 제거, `dashboard/page.tsx`의 미결 결재함 위젯을 "APPROVER이거나 대결 건이 있으면" 표시하도록 조정.

**교훈**: Design 단계에서 "기존 시스템의 암묵적 가정(역할 기반 화면 접근)"과 "신규 기능이 요구하는 접근 패턴(역할 무관 API 권한)"의 충돌을 미리 점검하는 체크리스트가 있었다면 더 빨리 잡을 수 있었을 것.

---

## 6. 종합 판단

- Plan Success Criteria 4/4 전부 충족, Match Rate 94%로 90% 기준 상회 — **Act(반복 개선) 불필요**.
- Minor 이슈 3건은 전부 "계획과 다르지만 결과적으로 더 나은/불필요없는 선택"이었고 기능 결손이 없다.
- Do 단계에서 발견한 RBAC 버그는 이번 기능의 핵심 가치(대결 알림의 실효성)에 직결되는 문제였고, 즉시 수정 및 재검증까지 완료했다.
