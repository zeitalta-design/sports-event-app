/**
 * slug ユーティリティ
 * 主催者名・シリーズ名からURL用のslugを生成する
 */

/**
 * 文字列をURL安全なslugに変換
 * - 英数字・日本語対応
 * - 空白 → ハイフン
 * - 連続ハイフン整理
 * - 小文字化（ASCII部分）
 *
 * @param {string} str
 * @returns {string}
 */
export function toSlug(str) {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "-") // 空白（全角含む）→ ハイフン
    .replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f-]/g, "") // 英数字・日本語・ハイフン以外除去
    .replace(/-+/g, "-") // 連続ハイフン → 単一ハイフン
    .replace(/^-|-$/g, ""); // 先頭・末尾ハイフン除去
}

/**
 * slug からの逆引き用: slug同士の一致判定
 * @param {string} slug1
 * @param {string} slug2
 * @returns {boolean}
 */
export function slugMatch(slug1, slug2) {
  return toSlug(slug1) === toSlug(slug2);
}
