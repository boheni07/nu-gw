"use client";

// Design Ref: §3.6 알림, §2.6 알림(상신/승인/반려/기한 임박) — module-8
// mockup/pages/index.html .notif-* 클래스 체계로 재정렬(module-12 디자인 정합화)
import { useEffect, useRef, useState } from "react";
import type { Notification } from "@/types";
import { BellIcon } from "@/lib/ui/icons";

const TYPE_ICON: Record<string, string> = {
  SUBMITTED: "📥",
  APPROVED: "✅",
  REJECTED: "❌",
  DUE_SOON: "⏰",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // 30초마다 폴링(실시간 push 대신 간단 폴링)
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleItemClick(n: Notification) {
    if (!n.isRead) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={ref} className="notif-wrap">
      <button type="button" className="notif-btn" onClick={() => setOpen((v) => !v)} aria-label="알림">
        <BellIcon />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-dropdown-head">
              <b>알림</b>
              {unreadCount > 0 && (
                <button type="button" className="notif-mark-all" onClick={handleMarkAllRead}>
                  모두 읽음
                </button>
              )}
            </div>
            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">알림이 없습니다.</div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`notif-item${n.isRead ? "" : " unread"}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <span className={`notif-dot${n.isRead ? " hidden" : ""}`} />
                    <span style={{ fontSize: 15 }}>{TYPE_ICON[n.type]}</span>
                    <div className="notif-body">
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-time">{timeAgo(n.createdAt)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
