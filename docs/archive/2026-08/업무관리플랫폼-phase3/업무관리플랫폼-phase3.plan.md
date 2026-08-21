# 업무관리 플랫폼 Phase 3 개발계획서 (Plan)

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 업무관리 플랫폼(nuGW) — Phase 3 |
| 작성일 | 2026-08-19 |
| 문서 단계 | PDCA - Plan |
| 선행 문서 | [Phase 2 Plan](../../archive/2026-08/업무관리플랫폼-phase2/업무관리플랫폼-phase2.plan.md) §2.3 "설계 방향만 기록" 항목 중 그룹웨어 연동(Slack) 구체화 |
| 전제 | Phase 1(module-1~9)·Phase 2(module-10) 완료 — [Phase 2 완료 보고서](../../archive/2026-08/업무관리플랫폼-phase2/업무관리플랫폼-phase2.report.md) 참고 |

## Executive Summary

| 항목 | 내용 |
|---|---|
| Problem | 결재 관련 알림이 앱 내 알림함에만 쌓이고, 사용자가 nuGW를 직접 열어보지 않으면 결재 요청/승인/반려를 즉시 알 수 없음 |
| Solution | 관리자가 등록한 Slack Incoming Webhook URL로, 결재 상신·승인·반려 이벤트를 요약 텍스트 메시지로 전송(기존 앱 내 알림과 병행, 대체 아님) |
| Function UX Effect | 관리자 설정 화면에서 Webhook URL 1개 등록/해제만 하면, 이후 모든 결재 이벤트가 회사 Slack 채널에도 자동 게시됨 — 별도 사용자 조작 불필요 |
| Core Value | 결재 지연 감소(즉시 인지) + 앱 접속 없이도 결재 흐름을 파악할 수 있는 채널 다양성 확보 |

## Context Anchor

| 구분 | 내용 |
|---|---|
| WHY | 앱 내 알림(module-8)만으로는 사용자가 nuGW를 열어야 확인 가능 — 이미 회사에서 쓰는 Slack으로 알림을 보내면 확인 지연이 줄어듦 |
| WHO | 전 직원(Slack 메시지 수신), ADMIN(Webhook URL 설정) |
| RISK | 잘못된/유출된 Webhook URL이 저장되면 회사 결재 정보(누가 무엇을 신청했는지)가 의도치 않은 Slack 채널로 노출될 수 있음 — URL은 ADMIN만 설정 가능해야 하고, 값 자체를 일반 사용자 화면에 노출하지 않음. 또한 외부 HTTP 호출이므로 실패해도 결재 트랜잭션에 영향을 주면 안 됨 |
| SUCCESS | ADMIN이 Webhook URL을 등록/해제할 수 있음 + 결재 상신·승인·반려 시 Slack 메시지가 정상 도착 + Webhook 미설정/전송 실패 시에도 결재 기능은 100% 정상 동작 |
| SCOPE | 이번 사이클: Slack Incoming Webhook 연동(상신/승인/반려 3개 이벤트, 회사 전체 단일 URL, 요약 텍스트만). **제외**: 부서별 Webhook, 대결 처리 전용 별도 메시지 문구, 브라우저 Web Push(Phase 2에서 이월된 별도 후보, 이번 사이클 범위 아님) |

---

## 1. 배경 및 목적

Phase 2(module-10)에서 대결자 알림까지 앱 내 알림 체계는 완성되었지만, 알림은 여전히 "nuGW에 로그인해서 알림함을 열어야" 확인할 수 있다. 이미 사내에서 상시 사용 중인 Slack으로 동일한 알림을 병행 전송하면, 사용자가 앱을 열지 않아도 결재 요청/처리 결과를 즉시 인지할 수 있다. Phase 2 Plan §2.3에서 "Slack Incoming Webhook 방식, 관리자가 회사 설정에 URL 등록"으로 방향만 기록해두었던 항목을 이번 사이클에서 구현한다.

## 2. 핵심 기능 정의

### 2.1 Slack Webhook 연동

| 구분 | 내용 |
|---|---|
| 설정 위치 | `관리자 > 회사 설정` 화면에 "Slack Webhook URL" 입력란 추가(ADMIN만 접근 가능한 기존 화면 재사용) |
| 저장 위치 | `CompanySettings.slackWebhookUrl: string \| null` — 회사 전체 1건, 부서별 설정 없음 |
| 발송 이벤트 | 결재 상신(SUBMITTED) / 승인(APPROVED) / 반려(REJECTED) 3종. 대결자가 대신 처리한 경우도 결과는 APPROVED/REJECTED로 동일하게 발송(메시지 문구에 대결자 이름을 별도 표기하지 않음 — 이번 범위 밖) |
| 발송 방식 | 기존 `notifySubmitted`/승인·반려 처리 로직 내부에서, 앱 알림 생성과 같은 지점에 Slack 전송 호출을 병행 추가(대체가 아닌 병행) |
| 메시지 형식 | 요약 텍스트 1줄(Slack Incoming Webhook의 `{"text": "..."}` payload). 예: `[nuGW] 김하준님의 연차 결재 요청이 도착했습니다.` / `[nuGW] 김하준님의 연차 결재가 승인되었습니다.` |
| 실패 처리 | Slack 전송은 fire-and-forget — HTTP 오류, 타임아웃, URL 미설정 등 어떤 이유로도 실패 시 결재 트랜잭션(상태 변경, 앱 알림 생성)은 항상 정상 완료. 실패는 서버 콘솔 로그에만 기록 |
| URL 미설정 시 | Webhook URL이 비어있으면(`null`) Slack 전송 자체를 시도하지 않고 조용히 스킵 — 기존 앱 알림 동작에 영향 없음 |

### 2.2 (이번 사이클 범위 밖 — 참고용 기록만)

| 항목 | 내용 |
|---|---|
| 부서별 Webhook | 부서마다 다른 채널로 보내는 것은 이번 범위 밖. 필요성이 확인되면 향후 별도 사이클에서 `Department.slackWebhookUrl` 오버라이드로 확장 검토 |
| 브라우저 Web Push | Phase 2 Plan §2.3에서 이월된 별도 항목 — 이번 Phase 3에서는 다루지 않음 |

## 3. 비기능 요구사항

| 항목 | 내용 |
|---|---|
| 권한 | Webhook URL 조회/수정은 ADMIN만 가능(기존 `admin/company-settings` 라우트의 RBAC 재사용) |
| 보안 | Webhook URL 값은 관리자 설정 화면 응답에만 포함 — 일반 사용자가 호출 가능한 API 응답(예: 회사 정보 조회)에는 절대 노출하지 않음 |
| 안정성 | Slack HTTP 호출에 타임아웃 설정(예: 3~5초) — 무한 대기로 결재 응답이 지연되지 않도록 함. `await` 하되 실패는 반드시 `try/catch`로 흡수 |
| 회귀 검증 | `scripts/smoke-test.mjs`에 Webhook URL 등록/해제 API 테스트 추가. 실제 Slack 전송 성공 여부는 로컬 환경에서 mock 서버 또는 URL 미설정 상태로 "스킵되는지"만 자동 검증하고, 실제 워크스페이스 전송은 사용자가 직접 URL을 등록해 수동 확인 |

## 4. 기술 스택

Phase 1·2와 동일(Next.js API Routes + 로컬 파일 저장소, bkend.ai 미사용). Slack Incoming Webhook은 표준 HTTP POST이므로 Node 내장 `fetch`만으로 구현 가능 — 별도 SDK 의존성 추가 없음.

## 5. 데이터 모델 변경(초안 — Design 단계에서 확정)

- `CompanySettings`에 `slackWebhookUrl: string | null` 필드 추가(Phase 2 Plan §5에서 이미 여지를 남겨둔 필드)
- 신규 테이블 없음

## 6. 화면 목록 초안

1. `관리자 > 회사 설정` — "Slack Webhook URL" 입력란 추가(등록/수정/비우기로 해제)

## 7. 리스크 및 고려사항

- 외부 서비스(Slack) 의존성이 처음 생기는 기능 — 로컬 데모 환경에서는 실제 워크스페이스 없이 "URL 미설정 시 정상 스킵"까지만 자동 검증 가능하고, 실제 발송은 사용자의 수동 검증이 필요함을 Design/Do 단계에 명시
- `lib/approval/engine.ts`의 `notifySubmitted` 및 승인/반려 처리 함수를 다시 수정해야 하므로 Phase 2와 동일하게 module-2~10 전체에 영향 — `npm run smoke` 전체 재실행 필수
- Webhook URL은 민감정보에 준하므로 로그·에러 메시지에 URL 원문이 그대로 노출되지 않도록 주의(Design 단계에서 로깅 정책 확정)

## 8. 다음 단계

본 계획서 승인 후 `02-design` 단계에서 다음을 진행한다.
- `notifySubmitted` 및 승인/반려 처리 함수에 Slack 전송을 추가하는 아키텍처 옵션 비교(엔진 내부 직접 호출 vs 별도 알림 디스패처 계층 분리)
- Slack 메시지 포맷 함수 설계, 타임아웃/에러 흡수 패턴 확정
- `/pdca design 업무관리플랫폼-phase3` 실행
