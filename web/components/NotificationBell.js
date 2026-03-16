"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * ヘッダー通知ベルコンポーネント
 *
 * 未読数バッジ + クリックでドロップダウンプレビュー表示。
 * 30秒ポーリングで未読数を更新。
 */
export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // 未読数ポーリング
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      const data = await res.json();
      setUnreadCount(data.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // ドロップダウン開閉時にプレビュー取得
  async function handleToggle() {
    if (!open) {
      setLoading(true);
      try {
        const res = await fetch("/api/notifications/unread-count?preview=1");
        const data = await res.json();
        setUnreadCount(data.count || 0);
        setRecent(data.recent || []);
      } catch {}
      setLoading(false);
    }
    setOpen(!open);
  }

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // 通知クリック → 既読にしてリンク先へ
  async function handleNotificationClick(n) {
    if (!n.is_read) {
      try {
        await fetch(`/api/notifications/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: true }),
        });
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }
    setOpen(false);

    const linkUrl = n.link_url || (n.event_id ? `/marathon/${n.event_id}` : null); // TODO: sport_type未取得のため暫定marathon
    if (linkUrl) {
      router.push(linkUrl);
    }
  }

  // すべて既読
  async function handleReadAll() {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setUnreadCount(0);
      setRecent((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {}
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ベルアイコン */}
      <button
        onClick={handleToggle}
        className="relative p-1.5 text-gray-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-gray-50"
        aria-label="通知"
        title="通知"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M10 2a6 6 0 0 0-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 0 0 .515 1.076 32.91 32.91 0 0 0 3.256.508 3.5 3.5 0 0 0 6.972 0 32.903 32.903 0 0 0 3.256-.508.75.75 0 0 0 .515-1.076A11.448 11.448 0 0 1 16 8a6 6 0 0 0-6-6Z"
            clipRule="evenodd"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">通知</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleReadAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  すべて既読
                </button>
              )}
            </div>
          </div>

          {/* 通知リスト */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : recent.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-400">通知はありません</p>
              </div>
            ) : (
              recent.map((n) => {
                const isRead = !!n.is_read;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !isRead ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!isRead && (
                        <span className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                      <div className={`flex-1 min-w-0 ${isRead ? "ml-4" : ""}`}>
                        <p className={`text-sm leading-snug line-clamp-2 ${isRead ? "text-gray-500" : "text-gray-900 font-medium"}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatRelativeTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* フッター */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              すべての通知を見る →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 相対時刻フォーマット
 */
function formatRelativeTime(createdAt) {
  if (!createdAt) return "";
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return created.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}
