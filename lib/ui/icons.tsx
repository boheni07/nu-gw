// Design Ref: mockup/pages/index.html ICON 상수 — 사이드바/토프바 아이콘을 동일한 선화 스타일로 재사용(module-12)
type IconProps = { size?: number };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  viewBox: "0 0 20 20",
} as const;

export function DashboardIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}

export function LeaveIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3" y="4" width="14" height="13" rx="1.6" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="6.5" y1="2.5" x2="6.5" y2="5.5" />
      <line x1="13.5" y1="2.5" x2="13.5" y2="5.5" />
      <path d="M6.5 12.5l1.6 1.6 3-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DailyIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="4" y="2.5" width="12" height="15" rx="1.4" />
      <line x1="7" y1="7" x2="13" y2="7" />
      <line x1="7" y1="10.2" x2="13" y2="10.2" />
      <line x1="7" y1="13.4" x2="10.5" y2="13.4" />
    </svg>
  );
}

export function WeeklyIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3" y="3.5" width="14" height="13" rx="1.4" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="6.5" y1="11" x2="6.5" y2="13.2" />
      <line x1="10" y1="11" x2="10" y2="13.2" />
      <line x1="13.5" y1="11" x2="13.5" y2="13.2" />
    </svg>
  );
}

export function ApprovalsIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M3 11.5V5.6C3 4.7 3.7 4 4.6 4h10.8c.9 0 1.6.7 1.6 1.6v5.9" strokeLinecap="round" />
      <path
        d="M3 11.5l2.6 4.2c.3.5.9.8 1.5.8h5.8c.6 0 1.2-.3 1.5-.8l2.6-4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 11.5h4.3l1 1.7h3.4l1-1.7H17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoutIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M8 3H5.6C4.7 3 4 3.7 4 4.6v10.8c0 .9.7 1.6 1.6 1.6H8" strokeLinecap="round" />
      <path d="M13 13.5l4-3.5-4-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="17" y1="10" x2="8.3" y2="10" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="3" y="4" width="14" height="13" rx="1.6" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="6.5" y1="2.5" x2="6.5" y2="5.5" />
      <line x1="13.5" y1="2.5" x2="13.5" y2="5.5" />
      <circle cx="7" cy="11.3" r="1" />
      <circle cx="10" cy="11.3" r="1" />
      <circle cx="13" cy="11.3" r="1" />
    </svg>
  );
}

export function CompanyIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="4" y="2.5" width="9" height="15" rx="1" />
      <line x1="6.5" y1="5.5" x2="6.5" y2="5.5" strokeLinecap="round" />
      <line x1="9.5" y1="5.5" x2="9.5" y2="5.5" strokeLinecap="round" />
      <line x1="6.5" y1="8.2" x2="6.5" y2="8.2" strokeLinecap="round" />
      <line x1="9.5" y1="8.2" x2="9.5" y2="8.2" strokeLinecap="round" />
      <line x1="6.5" y1="10.9" x2="6.5" y2="10.9" strokeLinecap="round" />
      <line x1="9.5" y1="10.9" x2="9.5" y2="10.9" strokeLinecap="round" />
      <path d="M13 7.5h3v10h-3" />
    </svg>
  );
}

export function UsersIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="7.3" cy="6.3" r="2.4" />
      <path d="M2.5 16c0-2.6 2.1-4.3 4.8-4.3s4.8 1.7 4.8 4.3" strokeLinecap="round" />
      <circle cx="14.3" cy="6.8" r="1.9" />
      <path d="M12.7 11.9c2 .2 3.8 1.7 3.8 4" strokeLinecap="round" />
    </svg>
  );
}

export function ApprovalLineIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="4" cy="4.5" r="1.8" />
      <circle cx="10" cy="10" r="1.8" />
      <circle cx="16" cy="15.5" r="1.8" />
      <path d="M5.5 5.8l3 2.6M11.5 11.3l3 2.6" strokeLinecap="round" />
    </svg>
  );
}

export function LeavePolicyIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <line x1="4" y1="4" x2="4" y2="16" strokeLinecap="round" />
      <circle cx="4" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <line x1="10" y1="4" x2="10" y2="16" strokeLinecap="round" />
      <circle cx="10" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <line x1="16" y1="4" x2="16" y2="16" strokeLinecap="round" />
      <circle cx="16" cy="9" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ClockIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="10" cy="10.5" r="7" />
      <path d="M10 6.5v4l2.8 1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="7.5" y1="2.3" x2="12.5" y2="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function OvertimeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="8.5" cy="11" r="6.5" />
      <path d="M8.5 7.8v3.2l2.2 1.3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="15.5" y1="4" x2="15.5" y2="8" strokeLinecap="round" />
      <line x1="13.5" y1="6" x2="17.5" y2="6" strokeLinecap="round" />
    </svg>
  );
}

export function IdCardIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.6" />
      <circle cx="7" cy="9" r="1.7" />
      <path d="M4.3 13.3c.4-1.4 1.5-2.1 2.7-2.1s2.3.7 2.7 2.1" strokeLinecap="round" />
      <line x1="12" y1="7.8" x2="15" y2="7.8" strokeLinecap="round" />
      <line x1="12" y1="10.2" x2="15" y2="10.2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon({ size = 19 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <path
        d="M5 8.2a5 5 0 0110 0c0 3.1.8 4.4 1.6 5.2.3.3.1.9-.3.9H3.7c-.4 0-.6-.6-.3-.9C4.2 12.6 5 11.3 5 8.2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.2 16.3a1.9 1.9 0 003.6 0" strokeLinecap="round" />
    </svg>
  );
}

export function HamburgerIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <line x1="3" y1="5.5" x2="17" y2="5.5" strokeLinecap="round" />
      <line x1="3" y1="10" x2="17" y2="10" strokeLinecap="round" />
      <line x1="3" y1="14.5" x2="17" y2="14.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M4 6h12" strokeLinecap="round" />
      <path d="M8 6V4.5h4V6" strokeLinecap="round" />
      <path d="M5.5 6l.7 9.5a1 1 0 001 .9h5.6a1 1 0 001-.9L14.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="10" y1="4" x2="10" y2="16" strokeLinecap="round" />
      <line x1="4" y1="10" x2="16" y2="10" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <line x1="5" y1="5" x2="15" y2="15" strokeLinecap="round" />
      <line x1="15" y1="5" x2="5" y2="15" strokeLinecap="round" />
    </svg>
  );
}

export function DelegateIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="6.5" cy="6" r="2.3" />
      <circle cx="14" cy="14" r="2.3" />
      <path d="M8.3 7.7L12.2 12.3" strokeLinecap="round" strokeDasharray="1 2.6" />
    </svg>
  );
}

/** 사용자 관리 §수정 — 목록 액션 버튼을 텍스트에서 아이콘으로 바꿀 때 사용(module-22, 가로 스크롤 축소 목적) */
export function EditIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M12.6 4.4l3 3-8.1 8.1-3.6.6.6-3.6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.2 5.8l3 3" strokeLinecap="round" />
    </svg>
  );
}

/** 사용자 관리 §비밀번호 초기화 */
export function KeyIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="7" cy="13" r="3" />
      <path d="M9.2 10.8L15.5 4.5" strokeLinecap="round" />
      <path d="M13 7l1.8 1.8" strokeLinecap="round" />
      <path d="M15.2 4.8l1.8 1.8" strokeLinecap="round" />
    </svg>
  );
}
