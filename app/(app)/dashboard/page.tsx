// Design Ref: §2.6 대시보드 & 알림 — 개인 대시보드(잔여연차/최근 신청/미결 결재함) + 결재자 대시보드(module-8)
// mockup/pages/index.html renderDashboard() 의 grid-2 2행 구조로 정리(module-12 디자인 정합화)
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import {
  findDailyReport,
  getUserById,
  listDepartments,
  listLeaveRequestsByUser,
  listLeaveTypeConfigs,
  listPendingApprovalsForApprover,
} from "@/lib/data/store";
import { getOrCreateLeaveBalance } from "@/lib/leave/service";
import AttendanceCard from "./attendance-card";

const TYPE_PILL: Record<string, string> = {
  LEAVE: "success",
  DAILY_REPORT: "neutral",
  WEEKLY_REPORT: "neutral",
  OVERTIME: "warning",
};

const LEAVE_STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", CANCELLED: "취소" };
const APPROVAL_TYPE_LABEL: Record<string, string> = {
  LEAVE: "연차",
  DAILY_REPORT: "일일업무보고",
  WEEKLY_REPORT: "주간업무보고",
  OVERTIME: "초과근무",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // middleware가 이미 /login으로 리다이렉트

  const periodYear = new Date().getFullYear();
  const balance = await getOrCreateLeaveBalance(user.id, periodYear);
  const leaveTypes = await listLeaveTypeConfigs();
  const recentLeaves = (await listLeaveRequestsByUser(user.id)).slice(0, 4);

  // module-10: MEMBER도 대결자로 지정되면 처리할 결재 건이 생길 수 있어(§4.3) 역할과 무관하게 항상 조회한다.
  const pendingApprovalsAll = await listPendingApprovalsForApprover(user.id);
  const pendingApprovals = pendingApprovalsAll.slice(0, 5);
  const departments = await listDepartments();
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "-";
  const pendingApprovalRows = await Promise.all(
    pendingApprovals.map(async (a) => ({ approval: a, submitter: await getUserById(a.submitterId) }))
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyDone = !!(await findDailyReport(user.id, todayKey));
  const remaining = balance.granted - balance.used;

  return (
    <div className="stack">
      <p style={{ fontSize: 13, color: "var(--text-faint)" }}>안녕하세요, {user.name}님 👋</p>

      <div className="grid-2">
        <AttendanceCard />

        <div className="card card-pad">
          <div className="card-head">
            <h2>오늘의 현황</h2>
          </div>
          <div className="kv">
            <div className="kv-row">
              <span className="k">잔여 연차</span>
              <span className="v num">
                {remaining}일 <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>/ {balance.granted}일</span>
              </span>
            </div>
            <div className="kv-row">
              <span className="k">결재 대기</span>
              <span className="v num">{pendingApprovalsAll.length}건</span>
            </div>
            <div className="kv-row">
              <span className="k">오늘 일일보고</span>
              <span className="v">{dailyDone ? "제출 완료" : "미작성"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="card-head">
            <h2>결재 대기함</h2>
            <span className="hint">최근 순</span>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="empty">처리할 결재 건이 없습니다.</div>
          ) : (
            pendingApprovalRows.map(({ approval: a, submitter }) => {
              return (
                <div key={a.id} className="list-row">
                  <span className={`pill ${TYPE_PILL[a.targetType] ?? "neutral"}`}>{APPROVAL_TYPE_LABEL[a.targetType]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {submitter?.name ?? "알 수 없음"} · {submitter ? deptName(submitter.departmentId) : "-"}
                    </div>
                    <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
                      {new Date(a.submittedAt).toLocaleDateString("ko-KR")} 상신 · {a.currentStep}/{Math.max(...a.steps.map((s) => s.stepOrder))}단계
                    </div>
                  </div>
                  <Link href="/approvals" className="btn ghost" style={{ flex: "none" }}>
                    보기
                  </Link>
                </div>
              );
            })
          )}
          {pendingApprovalsAll.length > pendingApprovals.length && (
            <Link href="/approvals" className="hint" style={{ display: "inline-block", marginTop: 10, color: "var(--accent)" }}>
              전체 {pendingApprovalsAll.length}건 보기 →
            </Link>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h2>최근 연차 신청 현황</h2>
            <Link href="/leave" className="hint" style={{ color: "var(--accent)" }}>
              전체 보기 →
            </Link>
          </div>
          {recentLeaves.length === 0 ? (
            <div className="empty">신청 내역이 없습니다.</div>
          ) : (
            recentLeaves.map((l) => (
              <div key={l.id} className="list-row">
                <span
                  className={`pill ${l.status === "APPROVED" ? "success" : l.status === "REJECTED" ? "danger" : l.status === "PENDING" ? "warning" : "neutral"}`}
                >
                  {LEAVE_STATUS_LABEL[l.status]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{leaveTypes.find((t) => t.id === l.leaveTypeId)?.name ?? "연차"}</div>
                  <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
                    {l.startTime ? `${l.startDate} ${l.startTime}~${l.endTime}` : `${l.startDate} ~ ${l.endDate}`} · {l.days}일
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
