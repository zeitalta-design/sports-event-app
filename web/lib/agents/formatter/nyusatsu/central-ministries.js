/**
 * Formatter: nyusatsu.central-ministries
 * 中央省庁（maff / meti / soumu / mhlw / mlit / env）の生レコード → 統一スキーマ
 *
 * 入力: scrapeMaff/scrapeMeti etc が返す行 shape
 *   { title, announce_date, deadline, detail_url, source, issuer, category? }
 *
 * 出力: 統一スキーマ（最小7フィールド + raw）
 */
import { toIsoDate } from "../util.js";

export const SOURCE_ID = "nyusatsu.central-ministries";

/** 省庁コード → 日本語名（issuer が無い時の保険） */
const MINISTRY_LABEL = {
  maff: "農林水産省",
  meti: "経済産業省",
  soumu: "総務省",
  mhlw: "厚生労働省",
  mlit: "国土交通省",
  env: "環境省",
};

/**
 * @param {Object} raw  - 中央省庁 scrape 関数が返す生レコード 1件
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
  const organization =
    raw.issuer || MINISTRY_LABEL[raw.source] || raw.source || null;

  return {
    source: SOURCE_ID,
    title: raw.title ? String(raw.title).trim().slice(0, 300) : null,
    organization,
    published_at: toIsoDate(raw.announce_date),
    deadline: toIsoDate(raw.deadline),
    detail_url: raw.detail_url || null,
    raw,
  };
}

export default format;
