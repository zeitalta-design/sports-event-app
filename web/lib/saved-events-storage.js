/**
 * Phase59: あとで見るリスト状態管理ユーティリティ
 *
 * localStorageベースで「あとで見る」大会を管理する。
 * 比較リスト（compare-utils.js）とは独立したストレージ。
 * ログイン不要・サーバー保存不要。
 */

const STORAGE_KEY = "taikai_saved_ids";
const MAX_SAVED = 20;

/**
 * 保存済みIDリストを取得
 * @returns {number[]}
 */
export function getSavedIds() {
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
 * あとで見るにIDを追加
 * @param {number} id
 * @returns {boolean} 追加成功したか
 */
export function addSavedId(id) {
  const ids = getSavedIds();
  if (ids.includes(id)) return false;
  if (ids.length >= MAX_SAVED) return false;
  ids.push(id);
  _save(ids);
  _dispatch();
  return true;
}

/**
 * あとで見るからIDを削除
 * @param {number} id
 * @returns {boolean} 削除成功したか
 */
export function removeSavedId(id) {
  const ids = getSavedIds();
  const idx = ids.indexOf(id);
  if (idx === -1) return false;
  ids.splice(idx, 1);
  _save(ids);
  _dispatch();
  return true;
}

/**
 * あとで見るのトグル（追加/削除）
 * @param {number} id
 * @returns {{ added: boolean, removed: boolean, full: boolean }}
 */
export function toggleSavedId(id) {
  const ids = getSavedIds();
  if (ids.includes(id)) {
    removeSavedId(id);
    return { added: false, removed: true, full: false };
  }
  if (ids.length >= MAX_SAVED) {
    return { added: false, removed: false, full: true };
  }
  addSavedId(id);
  return { added: true, removed: false, full: false };
}

/**
 * あとで見るに含まれているか
 * @param {number} id
 * @returns {boolean}
 */
export function isSaved(id) {
  return getSavedIds().includes(id);
}

/**
 * あとで見るリストをクリア
 */
export function clearSavedIds() {
  _save([]);
  _dispatch();
}

/**
 * あとで見るの件数を取得
 * @returns {number}
 */
export function getSavedCount() {
  return getSavedIds().length;
}

/**
 * 上限件数
 * @returns {number}
 */
export function getMaxSaved() {
  return MAX_SAVED;
}

// ─── 内部ヘルパー ──────────────────────────────

function _save(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage full or disabled
  }
}

/**
 * カスタムイベントを発火して他コンポーネントに変更を通知
 */
function _dispatch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("saved-change"));
}
