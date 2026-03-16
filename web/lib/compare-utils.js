/**
 * 比較リスト状態管理ユーティリティ
 *
 * localStorageベースで比較対象の大会IDを管理する。
 * ログイン不要・サーバー保存不要。
 */

const STORAGE_KEY = "taikai_compare_ids";
const MAX_COMPARE = 3;

/**
 * 比較対象IDリストを取得
 * @returns {number[]}
 */
export function getCompareIds() {
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
 * 比較対象にIDを追加
 * @param {number} id
 * @returns {boolean} 追加成功したか
 */
export function addCompareId(id) {
  const ids = getCompareIds();
  if (ids.includes(id)) return false;
  if (ids.length >= MAX_COMPARE) return false;
  ids.push(id);
  _save(ids);
  _dispatch();
  return true;
}

/**
 * 比較対象からIDを削除
 * @param {number} id
 * @returns {boolean} 削除成功したか
 */
export function removeCompareId(id) {
  const ids = getCompareIds();
  const idx = ids.indexOf(id);
  if (idx === -1) return false;
  ids.splice(idx, 1);
  _save(ids);
  _dispatch();
  return true;
}

/**
 * 比較対象のトグル（追加/削除）
 * @param {number} id
 * @returns {{ added: boolean, removed: boolean, full: boolean }}
 */
export function toggleCompareId(id) {
  const ids = getCompareIds();
  if (ids.includes(id)) {
    removeCompareId(id);
    return { added: false, removed: true, full: false };
  }
  if (ids.length >= MAX_COMPARE) {
    return { added: false, removed: false, full: true };
  }
  addCompareId(id);
  return { added: true, removed: false, full: false };
}

/**
 * 比較対象に含まれているか
 * @param {number} id
 * @returns {boolean}
 */
export function isCompared(id) {
  return getCompareIds().includes(id);
}

/**
 * 比較リストをクリア
 */
export function clearCompareIds() {
  _save([]);
  _dispatch();
}

/**
 * 比較対象の件数を取得
 * @returns {number}
 */
export function getCompareCount() {
  return getCompareIds().length;
}

/**
 * 上限件数
 * @returns {number}
 */
export function getMaxCompare() {
  return MAX_COMPARE;
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
  window.dispatchEvent(new CustomEvent("compare-change"));
}
