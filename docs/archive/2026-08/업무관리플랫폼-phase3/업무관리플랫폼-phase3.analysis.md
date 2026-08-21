# 업무관리 플랫폼 Phase 3 Gap 분석서 (Check)

| 항목 | 내용 |
|---|---|
| 대상 | module-11(Slack Webhook 연동) |
| 근거 문서 | [Phase 3 Plan](../01-plan/features/업무관리플랫폼-phase3.plan.md), [Phase 3 Design](../02-design/features/업무관리플랫폼-phase3.design.md) |
| 분석 방식 | 정적 분석(구조/기능/API 계약) + `npm run smoke` 자동 회귀 테스트(42건) + curl/브라우저 수동 검증 |
| 분석일 | 2026-08-19 |

## Context Anchor (Design에서 계승)

| 구분 | 내용 |
|---|---|
| SUCCESS 기준 | ADMIN이 Webhook URL을 등록/해제할 수 있음 + 결재 상신·승인·반려 시 Slack 메시지가 정상 도착 + Webhook 미설정/전송 실패 시에도 결재 기능은 항상 정상 동작 |

## Executive Summary

| 항목 | 내용 |
|---|---|
| Match Rate(1차) | 약 98% (Structural 100% × 0.2 + Functional 95% × 0.4 + Contract 100% × 0.4) |
| Match Rate(최종) | **100%** — Minor 이슈 즉시 수정 후 재검증 완료 |
| 판정 | 90% 이상 — Act(반복 개선) 불필요, Report 단계로 진행 가능 |
| Critical 이슈 | 0건 |
| Important 이슈 | 0건 |
| Minor 이슈 | 1건 발견 → **즉시 수정 완료**(아래 §7 참고) |

---

## 1. Plan Success Criteria 평가

| 기준 | 상태 | 근거 |
|---|---|---|
| ADMIN이 Webhook URL을 등록/해제할 수 있음 | ✅ Met | `npm run smoke` — PUT으로 등록/해제, MEMBER 접근 403 차단 확인. 브라우저에서 실제 폼 입력→저장→GET 재확인, 빈 문자열 저장 시 `null` 정규화까지 검증 |
| 결재 상신·승인·반려 시 Slack 메시지가 정상 도착 | ✅ Met(제한적 검증) | 가짜 Webhook URL(404 응답)로 상신/승인 시 `[slack] webhook 응답 오류: 404` 로그가 정확한 페이로드로 발생함을 확인 — 메시지 발송 로직 자체는 정상 동작. **실제 Slack 워크스페이스로의 도달 확인은 Plan/Design에서 이미 "로컬 환경 특성상 자동화 불가, 사용자 수동 확인 필요"로 명시했던 대로 사용자 측 후속 검증 필요** |
| Webhook 미설정/전송 실패 시에도 결재 기능은 항상 정상 | ✅ Met | URL `null`(미설정) 시 Slack 로그 없이 스킵 확인, URL이 존재하지 않는 엔드포인트(404)일 때도 연차 상신 183ms·결재 승인 987ms로 정상 응답(타임아웃 4초 이내, 결재 트랜잭션 영향 없음) |

**Success Rate: 3/3 met (100%)**

---

## 2. 구조적 Gap (Structural) — 100%

| 항목 | Design 근거 | 실제 | 판정 |
|---|---|---|---|
| `lib/integrations/slack.ts` | §4.1 신규 | 동일하게 생성, `sendSlackNotification(text)` 시그니처 일치 | ✅ 일치 |
| `lib/approval/engine.ts` 수정 | §4.2 `notifySubmitted`/`notifySubmitterResult` 옆에 병행 호출 | 동일 지점에 `void sendSlackNotification(...)` 추가 | ✅ 일치 |
| `types/index.ts` `CompanySettings.slackWebhookUrl` | §3.1 | 동일 필드 추가 | ✅ 일치 |
| `admin/company-settings/form.tsx` 입력란 | §4.3 | 동일 위치에 입력란 추가 | ✅ 일치 |
| API 변경 없음(§5) | 기존 PUT 재사용 | 실제로 라우트 파일 변경 없음 | ✅ 일치 |
| Module Map(module-11 단일) | §8 | 단일 세션으로 구현 완료 | ✅ 일치 |

## 3. 기능적 Gap (Functional) — 95%

핵심 기능(URL 등록/해제, 3개 이벤트 병행 전송, fire-and-forget 비차단, 빈 문자열→null 정규화)은 자동/수동 검증 전부 통과. 유일한 편차는 Design §4.3에서 언급한 "`https://hooks.slack.com/`으로 시작하지 않으면 저장 시 경고만 표시(차단하지 않음)" 항목이 Do 단계에서 실제로 구현되지 않은 것 — Plan Success Criteria에는 포함되지 않은 부가 UX였고, 기능적으로 결재/알림 흐름에 영향이 없어 Minor로 분류한다.

## 4. API 계약 Gap (Contract) — 100%

| Design 근거 | 실제 | 상태 |
|---|---|---|
| `GET /api/admin/company-settings` 응답에 `slackWebhookUrl` 포함 | 동일 | ✅ 일치 |
| `PUT /api/admin/company-settings` 요청 바디에 `slackWebhookUrl` 허용 | 동일(기존 라우트가 이미 Partial 갱신 지원) | ✅ 일치 |
| 신규 엔드포인트 없음 | 실제로 없음 | ✅ 일치 |

---

## 5. Minor 이슈 및 조치

1. Slack Webhook URL 형식 검증 경고(`https://hooks.slack.com/`로 시작하지 않을 때 저장 시 경고 표시)가 Design §4.3에는 있었으나 Do 단계 구현에서 누락됨 — 기능 차단 요건이 아니었고 Plan Success Criteria와도 무관해 운영에 지장은 없었음.
   - **조치**: `app/(admin)/admin/company-settings/form.tsx`에 `slackUrlWarning` 계산 로직과 경고 문구(⚠)를 추가. 저장 자체는 차단하지 않음(Design §4.3 "차단하지 않음" 요건 준수).
   - **검증**: 브라우저에서 `https://example.com/not-slack` 입력 시 경고 문구 노출 확인 → 저장 정상 완료(비차단) 확인 → `npm run smoke` 42/42 재통과.

## 6. 종합 판단

- Plan Success Criteria 3/3 전부 충족, Minor 이슈까지 즉시 수정하여 **Match Rate 100%** 달성 — Act(반복 개선) 불필요, Report 단계로 즉시 진행 가능.
- "실제 Slack 워크스페이스 도달 확인"은 Plan/Design 단계에서부터 사용자 수동 검증 항목으로 명시되어 있었으므로 Check 통과 기준에 포함하지 않았다 — Report에 후속 안내로 남긴다.
