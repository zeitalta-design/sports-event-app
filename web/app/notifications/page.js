"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

// ─── 通知タイプ設定（クライアント用インライン） ──────────

const TYPE_CONFIG = {
  entry_opened: { label: "受付開始", icon: "\u{1F389}", badgeClass: "bg-green-100 text-green-700" },
  entry_almost_full: { label: "残りわずか", icon: "\u26A1", badgeClass: "bg-orange-100 text-orange-700" },
  entry_closed: { label: "受付終了", icon: "\u{1F512}", badgeClass: "bg-gray-100 text-gray-600" },
  entry_closed_before_open: { label: "受付中止", icon: "\u274C", badgeClass: "bg-red-100 text-red-700" },
  urgency_upgraded: { label: "緊急度UP", icon: "\u{1F525}", badgeClass: "bg-red-100 text-red-700" },
  favorite_deadline_today: { label: "本日締切", icon: "\u2757", badgeClass: "bg-red-500 text-white" },
  favorite_deadline_3d: { label: "3日以内", icon: "\u23F0", badgeClass: "bg-red-100 text-red-700" },
  favorite_deadline_7d: { label: "7日以内", icon: "\u{1F4C5}", badgeClass: "bg-pink-100 text-pink-700" },
  deadline_today: { label: "本日締切", icon: "\u2757", badgeClass: "bg-red-100 text-red-700" },
  deadline_3d: { label: "3日以内", icon: "\u23F0", badgeClass: "bg-orange-100 text-orange-700" },
  deadline_7d: { label: "7日以内", icon: "\u{1F4C5}", badgeClass: "bg-yellow-100 text-yellow-700" },
  saved_search_match: { label: "検索一致", icon: "\u{1F50D}", badgeClass: "bg-blue-100 text-blue-700" },
};

const CATEGORY_FILTERS = [
  { key: "", label: "すべて" },
  { key: "status_change", label: "受付状態変化" },
  { key: "deadline", label: "締切通知" },
  { key: "saved_search", label: "保存検索" },
];

function TypeBadge({ type }) {
  const config = TYPE_CONFIG[type] || { label: type, icon: "", badgeClass: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${config.badgeClass}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

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
  return created.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({ byType: {}, total: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [category, unreadOnly]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (category) params.set("category", category);
      if (unreadOnly) params.set("unread_only", "1");

      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setStats(data.stats || { byType: {}, total: 0, unread: 0 });
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, category, unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function handleToggleRead(id, currentIsRead) {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: !currentIsRead }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, is_read: currentIsRead ? 0 : 1, read_at: currentIsRead ? null : new Date().toISOString() }
            : n
        )
      );
      setStats((prev) => ({
        ...prev,
        unread: prev.unread + (currentIsRead ? 1 : -1),
      }));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReadAll() {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: 1, read_at: n.read_at || new Date().toISOString() }))
      );
      setStats((prev) => ({ ...prev, unread: 0 }));
    } catch (err) {
      console.error(err);
    }
  }

  function handleNotificationClick(n) {
    if (!n.is_read) {
      handleToggleRead(n.id, false);
    }
    const linkUrl = n.link_url || (n.event_id ? `/marathon/${n.event_id}` : null);
    if (linkUrl) {
      router.push(linkUrl);
    }
  }

  function getNotificationLinkUrl(n) {
    return n.link_url || (n.event_id ? `/marathon/${n.event_id}` : null);
  }

  return (
    <AuthGuard>
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">通知一覧</h1>
        <Link
          href="/notification-settings"
          className="text-xs text-gray-500 hover:text-blue-600"
        >
          通知設定 →
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        受付状態の変化、締切通知、保存検索一致をまとめて確認できます
      </p>

      {/* KPI カード */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-3 text-center border-l-4 border-blue-500">
            <p className="text-xl font-bold text-blue-600">{stats.unread || 0}</p>
            <p className="text-xs text-gray-500">未読</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-green-600">
              {(stats.byType?.entry_opened?.total || 0) + (stats.byType?.entry_almost_full?.total || 0)}
            </p>
            <p className="text-xs text-gray-500">受付開始/残りわずか</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-red-600">
              {Object.entries(stats.byType || {})
                .filter(([k]) => k.includes("deadline"))
                .reduce((sum, [, v]) => sum + v.total, 0)}
            </p>
            <p className="text-xs text-gray-500">締切通知</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xl font-bold text-gray-600">{stats.total || 0}</p>
            <p className="text-xs text-gray-500">全通知</p>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* カテゴリタブ */}
          <div className="flex flex-wrap gap-1">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  category === cat.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              未読のみ
            </label>
            {stats.unread > 0 && (
              <button
                onClick={handleReadAll}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                すべて既読
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 件数 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {loading ? "読み込み中..." : `${total}件の通知`}
        </p>
        {!loading && totalPages > 1 && (
          <p className="text-xs text-gray-400">{page} / {totalPages} ページ</p>
        )}
      </div>

      {/* 通知一覧 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">
            {unreadOnly ? "未読の通知はありません" : "通知はありません"}
          </p>
          {unreadOnly && (
            <button
              onClick={() => setUnreadOnly(false)}
              className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              すべての通知を表示 →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map((n) => {
              const isRead = !!n.is_read;
              const linkUrl = getNotificationLinkUrl(n);
              return (
                <div
                  key={n.id}
                  className={`card transition-all ${
                    isRead
                      ? "opacity-60 bg-gray-50"
                      : "border-l-4 border-blue-400 bg-white"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <TypeBadge type={n.type} />
                          {!isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="未読" />
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>

                        {/* タイトル（クリッカブル） */}
                        {linkUrl ? (
                          <button
                            onClick={() => handleNotificationClick(n)}
                            className={`text-left text-sm leading-snug line-clamp-2 hover:text-blue-600 transition-colors ${
                              isRead ? "text-gray-500" : "text-gray-900 font-medium"
                            }`}
                          >
                            {n.title}
                          </button>
                        ) : (
                          <p className={`text-sm leading-snug line-clamp-2 ${
                            isRead ? "text-gray-500" : "text-gray-900 font-medium"
                          }`}>
                            {n.title}
                          </p>
                        )}

                        {n.body && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{n.body}</p>
                        )}
                      </div>

                      {/* アクション */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                        {linkUrl && (
                          <Link
                            href={linkUrl}
                            onClick={() => {
                              if (!n.is_read) handleToggleRead(n.id, false);
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            詳細 →
                          </Link>
                        )}
                        <button
                          onClick={() => handleToggleRead(n.id, isRead)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          {isRead ? "未読に戻す" : "既読にする"}
                        </button>
                      </div>
                    </div>

                    {/* 既読日時 */}
                    {n.read_at && (
                      <p className="text-[10px] text-gray-300 mt-1">
                        既読: {formatDateTime(n.read_at)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                前へ
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      page === pageNum
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </AuthGuard>
  );
}
