/**
 * ドメイン対応の比較リスト状態管理
 *
 * localStorage をドメインごとに分離して管理する。
 * 既存の lib/compare-utils.js は変更しない（sports は引き続き使用可能）。
 *
 * 使い方:
 *   import { getCompareIds, addCompareId } from "@/lib/core/compare-store";
 *   const ids = getCompareIds("saas");
 *   addCompareId("saas", 42);
 */

const MAX_COMPARE = 3;
const _isBrowser = typeof window !== "undefined";

function storageKey(domainId) {
  return `compare_ids_${domainId}`;
}

/**
 * IDs を sanitize する（不正値除去、重複除去、上限切り捨て）
 * @param {any[]} raw
 * @returns {number[]}
 */
function _sanitizeIds(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const v of raw) {
    const n = typeof v === "string" ? parseInt(v, 10) : v;
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    result.push(n);
    if (result.length >= MAX_COMPARE) break;
  }
  return result;
}

/**
 * store から比較対象IDリストを取得
 * @param {string} domainId
 * @returns {number[]}
 */
export function getCompareIds(domainId) {
  if (!_isBrowser) return [];
  try {
    const raw = localStorage.getItem(storageKey(domainId));
    if (!raw) return [];
    return _sanitizeIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * 比較対象にIDを追加
 * @param {string} domainId
 * @param {number} id
 * @returns {boolean}
 */
export function addCompareId(domainId, id) {
  if (!_isBrowser) return false;
  const ids = getCompareIds(domainId);
  if (ids.includes(id)) return false;
  if (ids.length >= MAX_COMPARE) return false;
  ids.push(id);
  _save(domainId, ids);
  _dispatch(domainId);
  return true;
}

/**
 * 比較対象からIDを削除
 * @param {string} domainId
 * @param {number} id
 * @returns {boolean}
 */
export function removeCompareId(domainId, id) {
  if (!_isBrowser) return false;
  const ids = getCompareIds(domainId);
  const idx = ids.indexOf(id);
  if (idx === -1) return false;
  ids.splice(idx, 1);
  _save(domainId, ids);
  _dispatch(domainId);
  return true;
}

/**
 * 比較対象のトグル
 * @param {string} domainId
 * @param {number} id
 * @returns {{ added: boolean, removed: boolean, full: boolean }}
 */
export function toggleCompareId(domainId, id) {
  if (!_isBrowser) return { added: false, removed: false, full: false };
  const ids = getCompareIds(domainId);
  if (ids.includes(id)) {
    removeCompareId(domainId, id);
    return { added: false, removed: true, full: false };
  }
  if (ids.length >= MAX_COMPARE) {
    return { added: false, removed: false, full: true };
  }
  addCompareId(domainId, id);
  return { added: true, removed: false, full: false };
}

/**
 * 比較リストをクリア
 * @param {string} domainId
 */
export function clearCompareIds(domainId) {
  if (!_isBrowser) return;
  _save(domainId, []);
  _dispatch(domainId);
}

/**
 * 比較対象の件数を取得
 * @param {string} domainId
 * @returns {number}
 */
export function getCompareCount(domainId) {
  return getCompareIds(domainId).length;
}

/**
 * 上限件数
 * @returns {number}
 */
export function getMaxCompare() {
  return MAX_COMPARE;
}

/**
 * URL パラメータ優先 / store フォールバックで比較 IDs を取得する
 *
 * @param {string} domainId - ドメインID ("saas" 等)
 * @param {URLSearchParams|null} searchParams - URL の searchParams（null 可）
 * @returns {{ ids: number[], source: "url" | "store" | "empty" }}
 */
export function getCompareIdsFromUrlOrStore(domainId, searchParams) {
  // 1. URL パラメータを試す
  if (searchParams) {
    const idsParam = searchParams.get("ids");
    if (idsParam && idsParam.trim() !== "") {
      const raw = idsParam.split(",").filter((s) => s.trim() !== "");
      const ids = _sanitizeIds(raw);
      if (ids.length > 0) {
        return { ids, source: "url" };
      }
    }
  }

  // 2. store フォールバック
  const storeIds = getCompareIds(domainId);
  if (storeIds.length > 0) {
    return { ids: storeIds, source: "store" };
  }

  // 3. 空
  return { ids: [], source: "empty" };
}

// ─── 内部ヘルパー ──────────────────────────────

function _save(domainId, ids) {
  if (!_isBrowser) return;
  try {
    localStorage.setItem(storageKey(domainId), JSON.stringify(ids));
  } catch {
    // localStorage full or disabled
  }
}

function _dispatch(domainId) {
  if (!_isBrowser) return;
  window.dispatchEvent(
    new CustomEvent("compare-change", { detail: { domainId } })
  );
}
