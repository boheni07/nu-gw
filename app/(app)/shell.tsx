"use client";

// Design Ref: mockup/pages/index.html renderShell() — 좌측 사이드바 + 상단바 구조로 앱 전체 shell을 통일한다(module-12).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "./notification-bell";
// module-13: 출장신청/출장결과보고는 전용 아이콘이 없어 기존 아이콘 셋을 그대로 재사용한다(디자인 정합화).
import {
  ApprovalLineIcon,
  ApprovalsIcon,
  CalendarIcon,
  ChevronIcon,
  ClockIcon,
  CompanyIcon,
  DailyIcon,
  DailyIcon as TripReportIcon,
  DashboardIcon,
  DelegateIcon,
  HamburgerIcon,
  IdCardIcon,
  LeaveIcon,
  LeavePolicyIcon,
  LogoutIcon,
  OvertimeIcon,
  OvertimeIcon as TripIcon,
  UsersIcon,
  WeeklyIcon,
} from "@/lib/ui/icons";
import type { UserRole } from "@/types";

type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "대시보드", icon: <DashboardIcon /> },
      { href: "/calendar", label: "캘린더", icon: <CalendarIcon /> },
    ],
  },
  {
    label: "업무보고",
    items: [
      { href: "/daily-reports", label: "일일업무보고", icon: <DailyIcon /> },
      { href: "/weekly-reports", label: "주간업무보고", icon: <WeeklyIcon /> },
      { href: "/trip-report", label: "출장결과보고", icon: <TripReportIcon /> },
      { href: "/approvals", label: "결재함", icon: <ApprovalsIcon />, badge: true },
    ],
  },
  {
    label: "근태관리",
    items: [
      { href: "/attendance", label: "출퇴근 관리", icon: <ClockIcon /> },
      { href: "/overtime", label: "초과근무 신청", icon: <OvertimeIcon /> },
      { href: "/business-trip", label: "출장 신청", icon: <TripIcon /> },
      { href: "/leave", label: "연차 신청", icon: <LeaveIcon /> },
    ],
  },
];

// 대결자 지정은 결재 권한(APPROVER 이상)이 있어야 의미가 있으므로 별도 조건부 그룹으로 분리한다.
const DELEGATE_NAV_GROUP: NavGroup = {
  label: "위임 관리",
  items: [{ href: "/delegates", label: "대결자 지정", icon: <DelegateIcon /> }],
};

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/company-settings", label: "회사 기본정보", icon: <CompanyIcon /> },
  { href: "/admin/departments", label: "조직 관리", icon: <ApprovalLineIcon /> },
  { href: "/admin/users", label: "사용자 관리", icon: <UsersIcon /> },
  { href: "/admin/approval-lines", label: "결재선 설정", icon: <ApprovalLineIcon /> },
  { href: "/admin/leave-policy", label: "연차정책 설정", icon: <LeavePolicyIcon /> },
  { href: "/admin/attendance-status", label: "출퇴근 현황", icon: <ClockIcon /> },
  { href: "/admin/leave-status", label: "연차 현황", icon: <LeaveIcon /> },
  { href: "/admin/overtime-status", label: "초과근무 현황", icon: <OvertimeIcon /> },
  { href: "/admin/hr-records", label: "인사기록", icon: <IdCardIcon /> },
];

const TITLES: Record<string, [string, string]> = {
  "/dashboard": ["대시보드", "오늘의 현황을 한눈에 확인하세요"],
  "/leave": ["연차 신청", "유형을 선택하고 잔여연차를 확인한 뒤 상신하세요"],
  "/overtime": ["초과근무 신청", "승인이 있어야 19:00 이후 퇴근 체크가 가능합니다"],
  "/business-trip": ["출장 신청", "관내·시외출장을 신청하세요"],
  "/trip-report": ["출장결과보고", "시외출장 완료 후 3일 이내 결과보고와 출장비를 청구하세요"],
  "/calendar": ["캘린더", "승인된 휴가와 사내 일정을 한눈에 확인하세요"],
  "/attendance": ["출퇴근 관리", "월별 근태 현황을 조회하세요"],
  "/daily-reports": ["일일업무보고", "오늘의 업무를 기록하고 내일 계획을 세워보세요"],
  "/weekly-reports": ["주간업무보고", "전일 계획 · 금주 실적을 자동으로 정리해드려요"],
  "/approvals": ["결재함", "내게 배정된 결재 건을 처리하세요"],
  "/delegates": ["대결자 지정", "결재를 대신 처리할 사람을 지정하세요"],
  "/hr-record": ["인사기록카드", "표준서식에 따라 본인 인사정보를 입력하세요"],
  "/admin/company-settings": ["회사 기본정보", "시스템 전체에 적용되는 회사 정보를 관리하세요"],
  "/admin/departments": ["조직 관리", "부서 계층 구조를 관리하세요"],
  "/admin/users": ["사용자 관리", "구성원의 부서·직급·권한을 관리하세요"],
  "/admin/approval-lines": ["결재선 설정", "부서 × 문서유형별 결재 라인을 설정하세요"],
  "/admin/leave-policy": ["연차정책 설정", "발생일수 기준과 연차 유형을 관리하세요"],
  "/admin/attendance-status": ["출퇴근 현황", "전 직원의 월별 근태 현황을 조회하세요"],
  "/admin/leave-status": ["연차 현황", "전 직원의 연차 부여·사용·잔여 현황을 조회하세요"],
  "/admin/overtime-status": ["초과근무 현황", "전 직원의 초과근무 신청 이력을 조회하세요"],
  "/admin/hr-records": ["인사기록", "재직자 전원의 인사기록카드를 조회·수정하세요"],
};

function titleFor(pathname: string): [string, string] {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES).find((key) => pathname.startsWith(key));
  return match ? TITLES[match] : ["nuGW", ""];
}

export default function Shell({
  userName,
  position,
  department,
  role,
  todayLabel,
  children,
}: {
  userName: string;
  position: string;
  department: string;
  role: UserRole;
  todayLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    function load() {
      fetch("/api/approvals/pending")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => setPendingCount(Array.isArray(list) ? list.length : 0))
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isAdmin = role === "ADMIN";
  const [title, subtitle] = titleFor(pathname);
  const initials = userName.slice(0, 2);

  return (
    <div id="app-shell">
      <div className="shell">
        <div className={`nav-backdrop${navOpen ? " nav-open" : ""}`} onClick={() => setNavOpen(false)} />
        <aside className={`sidebar${navOpen ? " nav-open" : ""}`}>
          <Link href="/dashboard" className="brand">
            <div className="brand-mark">nu</div>
            <div className="brand-text">
              <b>nuGW</b>
              <span>업무관리 플랫폼</span>
            </div>
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? "root"}>
              {group.label && <div className="nav-group">{group.label}</div>}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const count = item.badge ? pendingCount : 0;
                return (
                  <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                    {item.icon}
                    <span>{item.label}</span>
                    {count > 0 && <span className="badge-count">{count}</span>}
                  </Link>
                );
              })}
            </div>
          ))}

          {role !== "MEMBER" && (
            <div>
              <div className="nav-group">{DELEGATE_NAV_GROUP.label}</div>
              {DELEGATE_NAV_GROUP.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {isAdmin && (
            <div>
              <div className="nav-group">관리자</div>
              {ADMIN_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="sidebar-foot">
            {userMenuOpen && (
              <div className="user-menu">
                <Link href="/hr-record" className="nav-item" onClick={() => setUserMenuOpen(false)}>
                  <IdCardIcon />
                  <span>인사정보</span>
                </Link>
                <button type="button" className="logout-btn" onClick={handleLogout}>
                  <LogoutIcon />
                  <span>로그아웃</span>
                </button>
              </div>
            )}
            <button type="button" className="user-chip" onClick={() => setUserMenuOpen((v) => !v)}>
              <div className="avatar">{initials}</div>
              <div className="user-meta">
                <b>
                  {userName} {position}
                </b>
                <span>{department}</span>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--text-faint)", flex: "none" }}>
                <ChevronIcon />
              </span>
            </button>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="hamburger"
                aria-label="메뉴 열기"
                onClick={() => setNavOpen((v) => !v)}
              >
                <HamburgerIcon />
              </button>
              <div>
                <h1>{title}</h1>
                <div className="sub">{subtitle}</div>
              </div>
            </div>
            <div className="topbar-right">
              <NotificationBell />
              <span>{todayLabel}</span>
            </div>
          </div>
          <div className="content">{children}</div>
        </div>
      </div>
    </div>
  );
}
