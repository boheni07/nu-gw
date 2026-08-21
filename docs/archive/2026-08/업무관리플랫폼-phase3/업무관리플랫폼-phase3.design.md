# 업무관리 플랫폼 Phase 3 설계서 (Design)

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 업무관리 플랫폼(nuGW) — Phase 3 |
| 작성일 | 2026-08-19 |
| 문서 단계 | PDCA - Design |
| 근거 문서 | [Phase 3 Plan](../../01-plan/features/업무관리플랫폼-phase3.plan.md) |

## Context Anchor (Plan에서 계승)

| 구분 | 내용 |
|---|---|
| WHY | 앱 내 알림만으로는 확인이 지연됨 — 상시 사용 중인 Slack 채널로 알림을 병행 발송해 지연을 줄인다 |
| WHO | 전 직원(수신), ADMIN(URL 설정) |
| RISK | URL 유출/오설정 시 결재 정보가 잘못된 채널로 노출될 수 있음; 외부 호출 실패가 결재 트랜잭션에 영향을 주면 안 됨 |
| SUCCESS | ADMIN이 URL 등록/해제 가능 + 3개 이벤트(상신/승인/반려) 정상 발송 + URL 미설정/전송 실패 시에도 결재 기능은 항상 정상 |
| SCOPE | 상신/승인/반려 3이벤트, 회사 전체 단일 URL, 요약 텍스트만. 부서별 Webhook·대결 전용 문구·Web Push는 제외 |

---

## 1. Overview

Phase 2까지 완성된 앱 내 알림(`Notification`, module-8/10) 경로를 그대로 두고, 같은 이벤트 발생 지점에서 Slack Incoming Webhook으로도 병행 전송한다. 신규 데이터 모델은 `CompanySettings.slackWebhookUrl` 필드 하나뿐이며, 신규 API는 없다(기존 `admin/company-settings` API가 이미 `PATCH`로 부분 필드 갱신을 지원 — 재사용).

## 2. 아키텍처 옵션 비교

| 항목 | Option A — 최소 변경 | Option B — 완전 분리 | Option C — 실용적 균형(채택) |
|---|---|---|---|
| 구조 | `engine.ts`의 알림 발생 지점에 Slack fetch 직접 작성 | `lib/integrations/slack.ts`(전송) + `lib/notifications/dispatcher.ts`(앱 알림+Slack 통합 발송 계층) 신설, 기존 `createNotification` 호출부 전부 교체 | `lib/integrations/slack.ts`(전송 책임만 분리) 신설, `engine.ts`의 기존 `createNotification` 호출 옆에 함수 호출 1줄만 병행 추가 |
| 장점 | 파일 최소, 빠름 | 향후 채널(Web Push 등) 추가 시 확장 용이 | 관심사 분리(Slack 포맷/HTTP는 전용 파일) + 최소 침습(기존 알림 흐름 유지) |
| 단점 | Slack 설정(URL 조회/타임아웃/포맷)이 결재 로직과 섞여 가독성 저하 | 기존 호출부 전체 교체 필요 — Phase 2에서 이미 안정화된 `notifySubmitted` 등을 광범위하게 리팩터링해야 하므로 리스크 대비 이득 낮음(현재는 채널이 2개뿐) | 없음(대안 대비) — 채널이 3개 이상으로 늘면 그때 Option B로 승격 검토 |
| 결론 | 비채택 | 비채택(과설계 — 채널 2개에 디스패처 계층은 이르다) | **채택** |

## 3. 데이터 모델

### 3.1 `types/index.ts` — `CompanySettings` 확장

```typescript
export interface CompanySettings {
  // ...기존 필드 유지
  /** Slack Incoming Webhook URL. null이면 Slack 전송을 시도하지 않는다(§4.3) */
  slackWebhookUrl: string | null;
}
```

### 3.2 `lib/data/seed.json`

기존 `companySettings` 레코드에 `"slackWebhookUrl": null` 추가(마이그레이션 없이 db.json 재시딩으로 충분 — 로컬 저장소 방침).

## 4. 핵심 로직 설계

### 4.1 `lib/integrations/slack.ts` (신규)

```typescript
// Design Ref: §4.1 Slack Webhook 연동 — module-11(Phase 3)
// 결재 이벤트를 Slack Incoming Webhook으로 병행 전송한다. 실패해도 호출부(결재 처리)에는
// 절대 예외를 전파하지 않는다(§3 RISK — 외부 호출 실패가 결재 트랜잭션에 영향을 주면 안 됨).
const SLACK_TIMEOUT_MS = 4000;

export async function sendSlackNotification(text: string): Promise<void> {
  const webhookUrl = getCompanySettings().slackWebhookUrl;
  if (!webhookUrl) return; // URL 미설정 시 조용히 스킵(§4.4)

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[slack] webhook 응답 오류: ${res.status}`); // URL 원문은 로그에 남기지 않음(§7 리스크)
    }
  } catch (err) {
    console.error("[slack] 전송 실패(무시하고 계속 진행):", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}
```

- `getCompanySettings()`는 기존 `lib/data/store.ts` 함수 재사용.
- 함수 시그니처를 `text: string` 하나로 단순화 — 메시지 포맷은 호출부(`engine.ts`)에서 조립(Plan §2.1 "요약 텍스트만"과 일치, 포맷 로직을 이 파일에 넣지 않아 책임 분리 유지).
- 호출부는 `await` 하되, 실패해도 이 함수 내부에서 완전히 흡수되므로 결재 처리는 항상 정상 진행된다.

### 4.2 `lib/approval/engine.ts` 수정

기존 `notifySubmitted`(§3.6, module-8/10)와 `notifySubmitterResult` 옆에 Slack 전송을 병행 추가한다. 앱 알림 루프와 별개로, **원 승인자/신청자 기준 1건만** 전송한다(대결자별로 중복 전송하지 않음 — Plan §2.1 "대결자 이름을 별도 표기하지 않음"과 일치, 대결자 수만큼 Slack 메시지가 늘어나는 것도 방지).

```typescript
import { sendSlackNotification } from "@/lib/integrations/slack";

function notifySubmitted(approval: Approval, approverUserIds: string[]) {
  const submitterName = getUserById(approval.submitterId)?.name ?? "신청자";
  // ...기존 앱 알림 루프 유지...

  void sendSlackNotification(`[nuGW] ${submitterName}님의 ${DOC_LABEL[approval.targetType]} 결재 요청이 도착했습니다.`);
}

function notifySubmitterResult(approval: Approval, approved: boolean) {
  createNotification({ /* 기존과 동일 */ });
  void sendSlackNotification(
    `[nuGW] ${DOC_LABEL[approval.targetType]} 신청이 ${approved ? "승인" : "반려"}되었습니다.`
  );
}
```

- `void`로 fire-and-forget 처리 — `submitForApproval`/`approveCurrentStep`/`rejectCurrentStep`의 반환 타이밍이 Slack 응답을 기다리지 않도록 한다(Plan §3 "타임아웃 설정으로 결재 응답 지연 방지"와 일치). Node 런타임에서 unhandled rejection이 발생하지 않도록 `sendSlackNotification` 내부에서 이미 모든 예외를 흡수하므로 안전하다.

### 4.3 관리자 설정 화면

`app/(admin)/admin/company-settings/form.tsx`에 입력란 1개 추가:

```
Slack Webhook URL: [___________________________] (선택, 비워두면 Slack 알림 발송 안 함)
```

- `app/api/admin/company-settings/route.ts`의 기존 `PATCH` 핸들러가 이미 `Partial<CompanySettings>`를 받아 부분 갱신하므로 **API 변경 없음** — 폼에서 `slackWebhookUrl` 필드만 추가로 보내면 된다.
- 값 검증: 빈 문자열은 `null`로 정규화(완전히 해제 가능하도록). `https://hooks.slack.com/`으로 시작하지 않으면 저장 시 경고만 표시(차단하지 않음 — 사내 프록시/타 웹훅 서비스 사용 가능성 고려).

## 5. API 계약

| 엔드포인트 | 변경 내용 |
|---|---|
| `GET /api/admin/company-settings` | 응답에 `slackWebhookUrl` 필드 포함(ADMIN 전용 라우트이므로 §3 RISK의 "일반 사용자 응답에 노출 금지" 요건은 기존 라우트 권한 체계로 이미 충족) |
| `PATCH /api/admin/company-settings` | 요청 바디에 `slackWebhookUrl` 필드 추가 허용(기존 Partial 갱신 로직 그대로 사용) |

신규 엔드포인트 없음.

## 6. 검증 전략

| 구분 | 방법 |
|---|---|
| URL 미설정 시 스킵 | `npm run smoke`에 "webhook 미설정 상태에서 연차 상신 → 결재 API는 정상 200, 서버 로그에 Slack 관련 에러 없음" 케이스 추가 |
| URL 등록/해제 API | ADMIN이 `PATCH`로 URL 설정 → `GET`으로 값 확인 → 빈 문자열로 재요청 시 `null`로 정규화되는지 automated 검증 |
| 실제 Slack 전송 | 로컬 환경에 실제 워크스페이스가 없으므로 자동화 불가 — 사용자가 본인 Slack 워크스페이스에서 Webhook URL을 발급받아 등록 후, 연차 상신/승인/반려를 수동으로 1회씩 실행해 채널에 메시지가 도착하는지 수동 확인(Do 단계 완료 조건에 포함) |
| 타임아웃 동작 | 존재하지 않는 URL(예: `https://hooks.slack.com/services/INVALID`)로 등록 후 상신 시, 결재 응답이 정상적으로(수 초 내) 돌아오는지 확인 |

## 7. 리스크 재확인

- Plan §7에서 지적한 "module-2~10 전체에 영향" 리스크는 이번에도 동일 — `notifySubmitted`/`notifySubmitterResult` 수정 후 `npm run smoke` 전체 재실행 필수.
- `sendSlackNotification`을 `void`로 호출하므로, 테스트 환경에서 이 비동기 작업이 프로세스 종료 전에 끝나지 않을 수 있음 — smoke test에서는 결재 API 응답 자체만 검증하고 Slack 전송 완료는 별도로 기다리지 않는다(애초에 URL 미설정 상태로 테스트하므로 함수가 즉시 반환됨).

## 8. Module Map & Session Guide

| 모듈 | 범위 | 의존성 |
|---|---|---|
| module-11 | Slack Webhook 연동(설정 화면 1개 + `lib/integrations/slack.ts` 신규 + `engine.ts` 2곳 수정) | module-2(결재 엔진), module-1(회사 설정/관리자 화면) |

단일 세션으로 충분한 규모 — `/pdca do 업무관리플랫폼-phase3` 실행 시 `--scope` 없이 전체 진행 권장.
