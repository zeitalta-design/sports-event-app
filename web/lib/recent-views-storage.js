/**
 * Phase90: 最近見た大会の管理
 *
 * クライアントサイド。localStorage に最新20件の閲覧IDを保持。
 * marathon_view_events テーブルは session_id ベースで匿名のため、
 * クライアント側で明示的に閲覧履歴を管理する。
 */

const STORAGE_KEY = "taikai_recent_views";
const MAX_ITEMS = 20;

/**
 * 最近見た大会にIDを追加
 * 先頭が最新。重複は除去して先頭に移動。
 *
 * @param {number} eventId
 */
export function addRecentView(eventId) {
  if (typeof window === "undefined") return;
  if (!eventId) return;

  try {
    const ids = getRecentViewIds();
    // 重複除去
    const filtered = ids.filter((id) => id !== eventId);
    // 先頭に追加
    filtered.unshift(eventId);
    // 上限を超えたら末尾を切り捨て
    const trimmed = filtered.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("recent-views-change"));
  } catch {
    // storage full or quota exceeded
  }
}

/**
 * 最近見た大会のID一覧を取得（新しい順）
 *
 * @returns {number[]}
 */
export function getRecentViewIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "number" && id > 0);
  } catch {
    return [];
  }
}

/**
 * 最近見た大会の履歴をクリア
 */
export function clearRecentViews() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("recent-views-change"));
  } catch {}
}
