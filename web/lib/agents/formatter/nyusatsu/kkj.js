/**
 * Formatter: nyusatsu.kkj
 * 官公需情報ポータル（KKJ）の生レコード → 統一スキーマ
 *
 * 入力: parseKkjXml が返すレコード shape
 *   { key, externalUri, projectName, cftIssueDate, submissionDeadline,
 *     periodEndTime, organizationName, prefectureName, cityName,
 *     category, procedureType, location, description, ... }
 *
 * 出力: 統一スキーマ（最小7フィールド + raw）
 */
import { toIsoDate, stripFileSizeSuffix } from "../util.js";

export const SOURCE_ID = "nyusatsu.kkj";

/**
 * @param {Object} raw  - parseKkjXml が返す生レコード 1件
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
    title: stripFileSizeSuffix(raw.projectName),
    organization: raw.organizationName || null,
    published_at: toIsoDate(raw.cftIssueDate),
    deadline:
      toIsoDate(raw.submissionDeadline) ||
      toIsoDate(raw.periodEndTime) ||
      null,
    detail_url: raw.externalUri || null,
    raw,
  };
}

export default format;
