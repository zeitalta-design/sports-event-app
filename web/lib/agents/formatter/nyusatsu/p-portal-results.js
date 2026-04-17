/**
 * Formatter: nyusatsu.p-portal-results
 * 調達ポータル 落札実績 CSV の生レコード → 統一スキーマ
 *
 * こちらは「公告」ではなく「落札結果」なので:
 *   published_at = 開札日 (awardDate)
 *   deadline     = 落札結果なので締切概念なし → null
 *
 * 入力: parseCsv (nyusatsu-result-fetcher) が返す shape
 *   { procurementId, title, awardDate, awardAmount, methodCode,
 *     issuerCode, winnerName, corporateNumber }
 *
 * 出力: 統一スキーマ（最小7フィールド + raw）
 */
import { toIsoDate } from "../util.js";

export const SOURCE_ID = "nyusatsu.p-portal-results";

const DETAIL_URL = "https://www.p-portal.go.jp/pps-web-biz/UAA01/OAA0101";

/**
 * @param {Object} raw  - parseCsv が返す生レコード 1件
 * @returns {{
 *   source: string, title: string|null, organization: string|null,
 *   published_at: string|null, deadline: string|null,
 *   detail_url: string|null, raw: Object
 * }}
 */
export function format(raw) {
  if (!raw || typeof raw !== "object") {
    throw new TypeError("format: raw record is required");
  }
  return {
    source: SOURCE_ID,
    title: raw.title ? String(raw.title).trim() : null,
    // 発注機関: 現状 CSV は issuerCode のみ（コード→名称変換は Resolver 側の責務）
    organization: raw.issuerCode || null,
    published_at: toIsoDate(raw.awardDate),
    deadline: null, // 落札結果なので締切概念なし
    detail_url: DETAIL_URL,
    raw,
  };
}

export default format;
