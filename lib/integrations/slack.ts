// Design Ref: §4.1 Slack Webhook 연동 — module-11(Phase 3)
// 결재 이벤트를 Slack Incoming Webhook으로 병행 전송한다. 실패해도 호출부(결재 처리)에는
// 절대 예외를 전파하지 않는다(Plan RISK — 외부 호출 실패가 결재 트랜잭션에 영향을 주면 안 됨).
import { getCompanySettings } from "@/lib/data/store";

const SLACK_TIMEOUT_MS = 4000;

/**
 * Slack Incoming Webhook으로 요약 텍스트 메시지를 전송한다.
 * - 회사 설정에 URL이 없으면 조용히 스킵한다(§4.4 URL 미설정 시).
 * - 네트워크 오류/타임아웃/비정상 응답 모두 이 함수 내부에서 흡수하고 예외를 던지지 않는다.
 * - 호출부에서는 `void sendSlackNotification(...)`로 fire-and-forget 호출한다.
 */
export async function sendSlackNotification(text: string): Promise<void> {
  const webhookUrl = (await getCompanySettings()).slackWebhookUrl;
  if (!webhookUrl) return;

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
      // URL 원문은 로그에 남기지 않는다(민감정보 취급, Plan §7 리스크).
      console.error(`[slack] webhook 응답 오류: ${res.status}`);
    }
  } catch (err) {
    console.error("[slack] 전송 실패(무시하고 계속 진행):", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}
