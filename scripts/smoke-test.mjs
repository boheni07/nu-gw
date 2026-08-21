#!/usr/bin/env node
// 회귀 스모크 테스트 — Gap 분석(2026-08-19)에서 발견된 "자동화 테스트 부재" 이슈 보완.
// Playwright 없이 Node 내장 fetch로 실행 중인 dev 서버를 대상으로 핵심 플로우를 검증한다.
//
// 사용법:
//   1) 다른 터미널에서 서버 실행: npm run dev (기본 포트 3000) 또는 PORT=3100 npm run dev
//   2) node scripts/smoke-test.mjs [baseUrl]   (기본값: http://localhost:3000)
//
// 주의: 이 스크립트는 lib/data/db.json에 테스트 데이터를 실제로 남긴다(연차 신청/일보 등).
//       CI 등 반복 실행 환경에서는 매 실행 전 db.json을 삭제해 seed.json 상태로 되돌리는 것을 권장한다.

const BASE_URL = process.argv[2] || "http://localhost:3000";
const PASSWORD = "nugw-demo!";

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function cookieJar() {
  let cookie = "";
  return {
    async fetch(path, init = {}) {
      const headers = { ...(init.headers || {}) };
      if (cookie) headers["Cookie"] = cookie;
      const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, redirect: "manual" });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      return res;
    },
  };
}

async function login(email) {
  const session = cookieJar();
  const res = await session.fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  return { session, ok: res.ok, user: body };
}

async function main() {
  console.log(`\n🧪 nuGW 스모크 테스트 — ${BASE_URL}\n`);

  // 서버 가용성 확인
  try {
    const ping = await fetch(`${BASE_URL}/login`);
    if (!ping.ok) throw new Error(`status ${ping.status}`);
  } catch (err) {
    console.error(`❌ 서버에 연결할 수 없습니다(${BASE_URL}). 먼저 dev 서버를 실행하세요.\n`, err.message);
    process.exit(1);
  }

  console.log("▶ 인증 & RBAC");
  const hajun = await login("hajun.lee@nugw.co.kr"); // MEMBER, 마케팅팀
  const mina = await login("mina.jung@nugw.co.kr"); // APPROVER, 마케팅팀
  const doyoon = await login("dyoon.kim@nugw.co.kr"); // ADMIN, 마케팅팀
  ok("이하준(MEMBER) 로그인 성공", hajun.ok && hajun.user.role === "MEMBER");
  ok("정민아(APPROVER) 로그인 성공", mina.ok && mina.user.role === "APPROVER");
  ok("김도윤(ADMIN) 로그인 성공", doyoon.ok && doyoon.user.role === "ADMIN");

  const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "hajun.lee@nugw.co.kr", password: "wrong" }),
  });
  ok("잘못된 비밀번호 로그인 차단(401)", badLogin.status === 401);

  const memberAdminAttempt = await hajun.session.fetch("/api/admin/users");
  ok("MEMBER의 관리자 API 접근 차단(403)", memberAdminAttempt.status === 403);

  console.log("\n▶ 연차 신청·결재·잔여연차");
  const balanceBefore = await (await hajun.session.fetch("/api/leave-balance/me")).json();

  const leaveForm = new FormData();
  leaveForm.set("leaveTypeId", "lt-1"); // 연차(일)
  leaveForm.set("startDate", "2026-09-07");
  leaveForm.set("endDate", "2026-09-08");
  leaveForm.set("reason", "smoke-test");
  const leaveSubmit = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: leaveForm });
  const leaveRecord = await leaveSubmit.json();
  ok("연차(일) 2일 신청 성공", leaveSubmit.status === 201 && leaveRecord.days === 2, JSON.stringify(leaveRecord));

  const balanceAfterSubmit = await (await hajun.session.fetch("/api/leave-balance/me")).json();
  ok(
    "신청 시 잔여연차 선반영 차감",
    balanceAfterSubmit.used === balanceBefore.used + 2,
    `before=${balanceBefore.used} after=${balanceAfterSubmit.used}`
  );

  const insufficientForm = new FormData();
  insufficientForm.set("leaveTypeId", "lt-1");
  insufficientForm.set("startDate", "2026-01-05");
  insufficientForm.set("endDate", "2026-03-31");
  insufficientForm.set("reason", "smoke-test-overflow");
  const insufficientRes = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: insufficientForm });
  ok("잔여연차 초과 신청 차단(400)", insufficientRes.status === 400);

  const approveRes = await mina.session.fetch(`/api/approvals/${leaveRecord.approvalId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const approveBody = await approveRes.json();
  ok("결재자 승인 성공(단일 결재선 → 즉시 APPROVED)", approveRes.ok && approveBody.status === "APPROVED", JSON.stringify(approveBody));

  const doubleApprove = await mina.session.fetch(`/api/approvals/${leaveRecord.approvalId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  ok("이미 처리된 건 재승인 차단(409)", doubleApprove.status === 409);

  console.log("\n▶ 반려 → 잔여연차 환원");
  const balanceBeforeSubmit = await (await hajun.session.fetch("/api/leave-balance/me")).json();
  const rejectForm = new FormData();
  rejectForm.set("leaveTypeId", "lt-1");
  rejectForm.set("startDate", "2026-09-14");
  rejectForm.set("endDate", "2026-09-14");
  rejectForm.set("reason", "smoke-test-reject");
  const rejectSubmit = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: rejectForm });
  const rejectRecord = await rejectSubmit.json();
  const balanceAfterSubmit2 = await (await hajun.session.fetch("/api/leave-balance/me")).json();
  const rejectRes = await mina.session.fetch(`/api/approvals/${rejectRecord.approvalId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment: "smoke-test" }),
  });
  const rejectBody = await rejectRes.json();
  const balanceAfterReject = await (await hajun.session.fetch("/api/leave-balance/me")).json();
  ok("반려 처리 성공", rejectRes.ok && rejectBody.status === "REJECTED");
  ok(
    "신청 시 선반영(used +1) 확인",
    balanceAfterSubmit2.used === balanceBeforeSubmit.used + 1,
    `before=${balanceBeforeSubmit.used} afterSubmit=${balanceAfterSubmit2.used}`
  );
  ok(
    "반려 시 잔여연차 환원(선반영분 원복)",
    balanceAfterReject.used === balanceBeforeSubmit.used,
    `beforeSubmit=${balanceBeforeSubmit.used} afterReject=${balanceAfterReject.used}`
  );

  console.log("\n▶ 회수(§4.7) — 처리 전 회수 성공, 처리 후 회수 차단");
  const recallForm = new FormData();
  recallForm.set("leaveTypeId", "lt-1");
  recallForm.set("startDate", "2026-09-21");
  recallForm.set("endDate", "2026-09-21");
  recallForm.set("reason", "smoke-test-recall");
  const recallSubmit = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: recallForm });
  const recallRecord = await recallSubmit.json();
  const recallRes = await hajun.session.fetch(`/api/leave-requests/${recallRecord.id}/recall`, { method: "PATCH" });
  ok("대기중 신청 회수 성공", recallRes.ok);

  const postApproveRecallForm = new FormData();
  postApproveRecallForm.set("leaveTypeId", "lt-1");
  postApproveRecallForm.set("startDate", "2026-09-22");
  postApproveRecallForm.set("endDate", "2026-09-22");
  postApproveRecallForm.set("reason", "smoke-test-recall-2");
  const parSubmit = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: postApproveRecallForm });
  const parRecord = await parSubmit.json();
  await mina.session.fetch(`/api/approvals/${parRecord.approvalId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const blockedRecall = await hajun.session.fetch(`/api/leave-requests/${parRecord.id}/recall`, { method: "PATCH" });
  ok("처리 완료된 건 회수 차단(409)", blockedRecall.status === 409);

  console.log("\n▶ §4.7 버전 기반 동시성 제어");
  const editForm = new FormData();
  editForm.set("leaveTypeId", "lt-1");
  editForm.set("startDate", "2026-09-28");
  editForm.set("endDate", "2026-09-28");
  editForm.set("reason", "smoke-test-edit");
  const editSubmit = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: editForm });
  const editRecord = await editSubmit.json();
  const editRes = await hajun.session.fetch(`/api/leave-requests/${editRecord.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, reason: "수정됨" }),
  });
  ok("버전 일치 시 수정 성공", editRes.ok);
  const staleEditRes = await hajun.session.fetch(`/api/leave-requests/${editRecord.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, reason: "충돌" }),
  });
  ok("오래된 버전 수정 시도 차단(409)", staleEditRes.status === 409);

  console.log("\n▶ 일일업무보고 — 자동 초안 승계");
  const day1 = new Date().toISOString().slice(0, 10);
  const dailySubmit1 = await hajun.session.fetch("/api/daily-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportDate: "2099-01-05", todayResult: "smoke a", tomorrowPlan: "smoke b", notes: "" }),
  });
  ok("일일업무보고 상신 성공", dailySubmit1.status === 201);
  const dupDaily = await hajun.session.fetch("/api/daily-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportDate: "2099-01-05", todayResult: "x", tomorrowPlan: "y", notes: "" }),
  });
  ok("같은 날짜 중복 상신 차단(400)", dupDaily.status === 400);
  const draft = await (await hajun.session.fetch("/api/daily-reports/draft?date=2099-01-06")).json();
  ok("전일 다음날계획 자동 초안 반영", draft.todayResultDraft === "smoke b", JSON.stringify(draft));

  console.log("\n▶ 캘린더 병합 조회");
  const calendarRes = await (await hajun.session.fetch("/api/calendar?month=2026-09")).json();
  const hasSmokeLeave = calendarRes.leaves.some((l) => l.startDate === "2026-09-07");
  ok("승인된 연차가 캘린더에 병합 표시됨", hasSmokeLeave, JSON.stringify(calendarRes.leaves));

  console.log("\n▶ 알림(module-8)");
  const minaNotifs = await (await mina.session.fetch("/api/notifications")).json();
  ok("결재자에게 SUBMITTED 알림 도착", minaNotifs.notifications.some((n) => n.type === "SUBMITTED"));
  const hajunNotifs = await (await hajun.session.fetch("/api/notifications")).json();
  ok(
    "신청자에게 APPROVED/REJECTED 알림 도착",
    hajunNotifs.notifications.some((n) => n.type === "APPROVED") && hajunNotifs.notifications.some((n) => n.type === "REJECTED")
  );

  console.log("\n▶ 출퇴근 — 출근 1일 1회 제한(시간 게이트는 수동 검증 문서 참고)");
  const checkIn1 = await hajun.session.fetch("/api/attendance/check-in", { method: "POST" });
  const checkIn2 = await hajun.session.fetch("/api/attendance/check-in", { method: "POST" });
  ok("출근 체크(최초) 성공 또는 이미 처리됨", checkIn1.status === 201 || checkIn1.status === 409);
  ok("같은 날 재출근 차단(409)", checkIn2.status === 409);

  console.log("\n▶ 인사기록카드(module-9)");
  const hrBefore = await (await hajun.session.fetch("/api/hr-records/me")).json();
  ok("최초 조회 시 이름·이메일 프리필", hrBefore.nameKr === "이하준" && hrBefore.savedAt === null, JSON.stringify(hrBefore));
  const hrRejectSave = await hajun.session.fetch("/api/hr-records/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreed: false }),
  });
  ok("서약 미동의 저장 차단(400)", hrRejectSave.status === 400);
  const hrSave = await hajun.session.fetch("/api/hr-records/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nameKr: "이하준",
      militaryStatus: "군필",
      education: [{ school: "smoke대", major: "전산", degree: "학사", graduationDate: "2020-02-01" }],
      agreed: true,
    }),
  });
  const hrSaveBody = await hrSave.json();
  ok(
    "서약 동의 시 저장 성공(military/education 반영)",
    hrSave.ok && hrSaveBody.militaryStatus === "군필" && hrSaveBody.education.length === 1 && !!hrSaveBody.savedAt,
    JSON.stringify(hrSaveBody)
  );

  console.log("\n▶ 리포트 다운로드 & 위임 고도화(module-10)");
  const leaveReportSelf = await hajun.session.fetch("/api/reports/leave?scope=self");
  const leaveReportCsv = await leaveReportSelf.text();
  // 참고: fetch().text()는 UTF-8 BOM을 디코딩 과정에서 소비하므로 여기서는 검증하지 않는다.
  // BOM이 실제 응답 바이트에 포함되는지는 curl -o file 로 별도 확인함(엑셀 한글 깨짐 방지 목적).
  ok(
    "연차 리포트(본인) 200 + CSV 헤더 정상",
    leaveReportSelf.ok && leaveReportCsv.includes("이름,유형,기간,일수,상태,신청일"),
    leaveReportCsv.slice(0, 60)
  );
  const leaveReportAllBlocked = await hajun.session.fetch("/api/reports/leave?scope=all");
  ok("MEMBER의 전사 범위 리포트 요청 차단(403)", leaveReportAllBlocked.status === 403);
  const leaveReportAllAdmin = await doyoon.session.fetch("/api/reports/leave?scope=all");
  ok("ADMIN의 전사 범위 리포트 요청 허용(200)", leaveReportAllAdmin.status === 200);

  const today = new Date().toISOString().slice(0, 10);
  await mina.session.fetch("/api/delegates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delegateUserId: "user-3", startDate: today, endDate: today }),
  });
  const delegateLeaveForm = new FormData();
  delegateLeaveForm.set("leaveTypeId", "lt-1");
  delegateLeaveForm.set("startDate", "2099-06-01");
  delegateLeaveForm.set("endDate", "2099-06-01");
  delegateLeaveForm.set("reason", "smoke-delegate");
  const delegateLeaveSubmit = await doyoon.session.fetch("/api/leave-requests", { method: "POST", body: delegateLeaveForm });
  const delegateLeaveRecord = await delegateLeaveSubmit.json();

  const hajunNotifsAfterDelegate = await (await hajun.session.fetch("/api/notifications")).json();
  ok(
    "대결자(이하준)도 SUBMITTED 알림 수신",
    hajunNotifsAfterDelegate.notifications.some((n) => n.message.includes("대신해")),
    JSON.stringify(hajunNotifsAfterDelegate.notifications.slice(0, 3))
  );

  const hajunPendingAsDelegate = await (await hajun.session.fetch("/api/approvals/pending")).json();
  const delegatedApproval = hajunPendingAsDelegate.find((a) => a.targetId === delegateLeaveRecord.id);
  ok("MEMBER도 결재함 API에서 대결 건을 확인 가능", !!delegatedApproval, JSON.stringify(hajunPendingAsDelegate));

  if (delegatedApproval) {
    const delegateApproveRes = await hajun.session.fetch(`/api/approvals/${delegatedApproval.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    ok("MEMBER(대결자)가 정민아를 대신해 승인 성공", delegateApproveRes.ok);

    const processedReport = await (await hajun.session.fetch("/api/reports/approvals?scope=processed")).text();
    ok("처리 이력 리포트에 대결여부='대결' 반영", processedReport.includes(",대결"), processedReport.split("\n").slice(0, 2).join(" | "));
  }

  const approvalsPageAsMember = await hajun.session.fetch("/approvals");
  ok("MEMBER도 /approvals 페이지 접근 가능(더 이상 리다이렉트되지 않음)", approvalsPageAsMember.status === 200);

  console.log("\n▶ Slack Webhook 연동(module-11)");
  const settingsBefore = await (await doyoon.session.fetch("/api/admin/company-settings")).json();
  ok("초기 상태에서 slackWebhookUrl은 null", settingsBefore.slackWebhookUrl === null, JSON.stringify(settingsBefore.slackWebhookUrl));

  const settingsBlockedForMember = await hajun.session.fetch("/api/admin/company-settings");
  ok("MEMBER는 회사 설정(Webhook URL 포함) 접근 차단(403)", settingsBlockedForMember.status === 403);

  const putWithFakeWebhook = await doyoon.session.fetch("/api/admin/company-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settingsBefore, slackWebhookUrl: "https://hooks.slack.com/services/SMOKE/TEST/FAKE" }),
  });
  const settingsAfterSet = await putWithFakeWebhook.json();
  ok("ADMIN이 Webhook URL 등록 가능", settingsAfterSet.slackWebhookUrl === "https://hooks.slack.com/services/SMOKE/TEST/FAKE");

  // Webhook URL이 설정된(존재하지 않는 엔드포인트) 상태에서도 결재 상신/승인이 정상적으로 완료되어야 한다
  // (fire-and-forget — Slack 전송 실패가 결재 트랜잭션에 영향을 주면 안 됨, Plan RISK).
  const webhookLeaveForm = new FormData();
  webhookLeaveForm.set("leaveTypeId", "lt-1");
  webhookLeaveForm.set("startDate", "2099-07-01");
  webhookLeaveForm.set("endDate", "2099-07-01");
  webhookLeaveForm.set("reason", "smoke-slack-webhook");
  const webhookLeaveSubmit = await hajun.session.fetch("/api/leave-requests", { method: "POST", body: webhookLeaveForm });
  ok("Webhook URL 설정 상태에서도 연차 상신 정상 처리(201)", webhookLeaveSubmit.status === 201);
  const webhookLeaveRecord = await webhookLeaveSubmit.json();

  const minaPendingForWebhookTest = await (await mina.session.fetch("/api/approvals/pending")).json();
  const webhookApproval = minaPendingForWebhookTest.find((a) => a.targetId === webhookLeaveRecord.id);
  if (webhookApproval) {
    const webhookApproveRes = await mina.session.fetch(`/api/approvals/${webhookApproval.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    ok("Webhook URL 설정 상태에서도 결재 승인 정상 처리(200)", webhookApproveRes.ok);
  } else {
    ok("Webhook URL 설정 상태에서도 결재 승인 정상 처리(200)", false, "대상 결재 건을 찾지 못함");
  }

  const putClearWebhook = await doyoon.session.fetch("/api/admin/company-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...settingsBefore, slackWebhookUrl: null }),
  });
  const settingsAfterClear = await putClearWebhook.json();
  ok("ADMIN이 Webhook URL 해제(null) 가능", settingsAfterClear.slackWebhookUrl === null);

  console.log(`\n────────────────────────────────`);
  console.log(`결과: ${pass}건 성공 / ${fail}건 실패`);
  if (fail > 0) {
    console.log(`실패 항목: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("✅ 전체 통과");
}

main().catch((err) => {
  console.error("스모크 테스트 실행 중 오류:", err);
  process.exit(1);
});
