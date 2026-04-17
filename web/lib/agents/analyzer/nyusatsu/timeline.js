/**
 * Analyzer: 落札の月別 / 年別推移
 *
 * 使用例:
 *   - 全体の月別件数
 *   - 特定 entity / cluster / issuer の月別件数・金額
 */
import { RESOLVED_RESULTS_SQL, buildFilters } from "./resolved.js";

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {"month"|"year"} [opts.granularity="month"]
 * @param {number} [opts.entityId]     特定 entity だけを対象
 * @param {number} [opts.clusterId]    特定 cluster だけを対象
 * @param {string} [opts.issuerName]   特定 発注機関だけ
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {string} [opts.category]
 * @returns {Array<{
 *   period:        string,   // "2026-04" or "2026"
 *   total_awards:  number,
 *   total_amount:  number,
 *   unique_buyers: number,
 *   unique_winners:number,
 * }>}
 */
export function getAwardTimeline({
  db,
  granularity = "month",
  entityId,
  clusterId,
  issuerName,
  dateFrom,
  dateTo,
  category,
} = {}) {
  if (!db) throw new TypeError("getAwardTimeline: db is required");

  const periodExpr = granularity === "year"
    ? "SUBSTR(award_date, 1, 4)"
    : "SUBSTR(award_date, 1, 7)";

  const filters = buildFilters({ dateFrom, dateTo, category, issuerName });
  const extra = [];
  const params = { ...filters.params };
  if (entityId != null) { extra.push("entity_id = @entityId"); params.entityId = entityId; }
  if (clusterId != null) { extra.push("cluster_id = @clusterId"); params.clusterId = clusterId; }
  // 日付必須（period 抽出のため）
  extra.push("award_date IS NOT NULL AND award_date != ''");

  const whereMerged = [filters.where.replace(/^WHERE\s+/, ""), ...extra].filter(Boolean).join(" AND ");
  const whereClause = whereMerged ? `WHERE ${whereMerged}` : "";

  const sql = `
    SELECT
      ${periodExpr}                     AS period,
      COUNT(*)                          AS total_awards,
      COALESCE(SUM(award_amount), 0)    AS total_amount,
      COUNT(DISTINCT issuer_name)       AS unique_buyers,
      COUNT(DISTINCT COALESCE(entity_id, winner_name)) AS unique_winners
    FROM (${RESOLVED_RESULTS_SQL})
    ${whereClause}
    GROUP BY period
    ORDER BY period ASC
  `;

  return db.prepare(sql).all(params);
}
