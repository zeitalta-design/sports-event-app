/**
 * Phase100: マイ大会ステータス管理
 *
 * localStorageベースで大会ごとのステータスを管理する。
 * saved-events-storage.js と同じパターン。
 */

const STORAGE_KEY = "taikai_my_events";

/**
 * ステータス定義
 */
export const EVENT_STATUSES = {
  considering:  { label: "検討中",       icon: "🤔", color: "amber",  order: 0 },
  planned:      { label: "出場予定",     icon: "🎯", color: "blue",   order: 1 },
  entered:      { label: "エントリー済み", icon: "✅", color: "green",  order: 2 },
  completed:    { label: "完了",         icon: "🏁", color: "gray",   order: 3 },
  closed:       { label: "募集終了",     icon: "⛔", color: "red",    order: 4 },
  needs_check:  { label: "要確認",       icon: "❓", color: "orange", order: 5 },
};

export const STATUS_KEYS = Object.keys(EVENT_STATUSES);

/**
 * ステータス別のTailwindカラーマップ
 */
export const STATUS_COLORS = {
  considering:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700" },
  planned:      { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700" },
  entered:      { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  badge: "bg-green-100 text-green-700" },
  completed:    { bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200",   badge: "bg-gray-100 text-gray-500" },
  closed:       { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-200",    badge: "bg-red-100 text-red-600" },
  needs_check:  { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200", badge: "bg-orange-100 text-orange-600" },
};

/**
 * ステータス別の次アクション
 */
export const STATUS_NEXT_ACTIONS = {
  considering:  { text: "比較して決めましょう",           link: "/compare" },
  planned:      { text: "エントリーサイトを確認しましょう", link: null },
  entered:      { text: "持ち物リストを準備しましょう",     link: null },
  completed:    { text: "レースお疲れさまでした！",        link: null },
  closed:       { text: "他の大会を探してみましょう",       link: "/marathon" },
  needs_check:  { text: "公式サイトで最新情報を確認",       link: null },
};

// ─── CRUD ────────────────────────────────────

/**
 * 全ステータスマップを取得
 * @returns {Object} { [eventId]: { status, updatedAt } }
 */
export function getMyEventsStatuses() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * 特定大会のステータスを取得
 * @param {number} eventId
 * @returns {string|null}
 */
export function getEventStatus(eventId) {
  const all = getMyEventsStatuses();
  return all[eventId]?.status || null;
}

/**
 * 大会のステータスを設定
 * @param {number} eventId
 * @param {string} status
 */
export function setEventStatus(eventId, status) {
  if (!STATUS_KEYS.includes(status)) return;
  const all = getMyEventsStatuses();
  all[eventId] = {
    status,
    updatedAt: new Date().toISOString(),
  };
  _save(all);
  _dispatch();
}

/**
 * 大会のステータスを削除
 * @param {number} eventId
 */
export function removeEventStatus(eventId) {
  const all = getMyEventsStatuses();
  if (!(eventId in all)) return;
  delete all[eventId];
  _save(all);
  _dispatch();
}

/**
 * 特定ステータスの大会IDリストを取得
 * @param {string} status
 * @returns {number[]}
 */
export function getEventIdsByStatus(status) {
  const all = getMyEventsStatuses();
  return Object.entries(all)
    .filter(([, v]) => v.status === status)
    .map(([k]) => Number(k));
}

/**
 * 管理対象の全大会IDを取得
 * @returns {number[]}
 */
export function getAllManagedEventIds() {
  const all = getMyEventsStatuses();
  return Object.keys(all).map(Number);
}

/**
 * ステータス別の件数を取得
 * @returns {Object} { considering: 2, entered: 1, ... }
 */
export function getStatusCounts() {
  const all = getMyEventsStatuses();
  const counts = {};
  for (const key of STATUS_KEYS) {
    counts[key] = 0;
  }
  for (const v of Object.values(all)) {
    if (counts[v.status] !== undefined) {
      counts[v.status]++;
    }
  }
  return counts;
}

/**
 * 保存時に自動ステータス設定（まだステータスがない場合）
 * saved-events-storage の addSavedId 後に呼ぶ想定
 * @param {number} eventId
 */
export function ensureEventStatus(eventId) {
  const current = getEventStatus(eventId);
  if (!current) {
    setEventStatus(eventId, "considering");
  }
}

// ─── 内部ヘルパー ──────────────────────────────

function _save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function _dispatch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("my-events-status-change"));
}
