/**
 * Analyzer: 落札者と発注機関の関係性分析
 *
 * ・特定 entity/cluster がどの発注機関からどれだけ落札しているか
 * ・concentration_score（偏り度合い、0=均等、1=完全1機関依存）
 *   → Herfindahl-Hirschman Index (HHI) を [0,1] に正規化
 *     HHI = Σ (share_i)^2, shareは件数または金額の占有率
 */
import { RESOLVED_RESULTS_SQL, buildFilters } from "./resolved.js";

/**
 * 特定落札者の発注機関別内訳。
 *
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} [opts.entityId]
 * @param {number} [opts.clusterId]
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {string} [opts.category]
 * @param {number} [opts.limit=20]
 * @returns {{
 *   items: Array<{ issuer_name: string, count: number, total_amount: number, share_count: number, share_amount: number }>,
 *   total_awards: number,
 *   total_amount: number,
 *   concentration_count:  number,   // HHI based on count share  (0-1)
 *   concentration_amount: number,   // HHI based on amount share (0-1)
 *   top_issuer: string|null,
 * }}
 */
export function getBuyerRelations({
  db,
  entityId,
  clusterId,
  dateFrom,
  dateTo,
  category,
  limit = 20,
} = {}) {
  if (!db) throw new TypeError("getBuyerRelations: db is required");
  if (entityId == null && clusterId == null) {
    throw new TypeError("getBuyerRelations: entityId または clusterId が必要");
  }

  const filters = buildFilters({ dateFrom, dateTo, category });
  const extra = [];
  const params = { ...filters.params };
  if (entityId != null) { extra.push("entity_id = @entityId"); params.entityId = entityId; }
  if (clusterId != null) { extra.push("cluster_id = @clusterId"); params.clusterId = clusterId; }
  extra.push("issuer_name IS NOT NULL AND issuer_name != ''");

  const whereMerged = [filters.where.replace(/^WHERE\s+/, ""), ...extra].filter(Boolean).join(" AND ");
  const whereClause = whereMerged ? `WHERE ${whereMerged}` : "";

  // 発注機関別 全件取得（concentration 計算のため全件必要）
  const allRows = db.prepare(`
    SELECT issuer_name,
           COUNT(*)                       AS count,
           COALESCE(SUM(award_amount), 0) AS total_amount
    FROM (${RESOLVED_RESULTS_SQL})
    ${whereClause}
    GROUP BY issuer_name
    ORDER BY count DESC, total_amount DESC
  `).all(params);

  const totalAwards = allRows.reduce((s, r) => s + r.count, 0);
  const totalAmount = allRows.reduce((s, r) => s + (r.total_amount || 0), 0);

  // HHI 計算（share の二乗和）。[0..1] の範囲。
  // 件数なし（何もヒットなし）は 0
  const concentrationCount = totalAwards > 0
    ? allRows.reduce((s, r) => s + Math.pow(r.count / totalAwards, 2), 0)
    : 0;
  const concentrationAmount = totalAmount > 0
    ? allRows.reduce((s, r) => s + Math.pow((r.total_amount || 0) / totalAmount, 2), 0)
    : 0;

  const items = allRows.slice(0, limit).map((r) => ({
    issuer_name: r.issuer_name,
    count: r.count,
    total_amount: r.total_amount || 0,
    share_count:  totalAwards > 0 ? r.count / totalAwards : 0,
    share_amount: totalAmount > 0 ? (r.total_amount || 0) / totalAmount : 0,
  }));

  return {
    items,
    total_awards: totalAwards,
    total_amount: totalAmount,
    concentration_count:  round4(concentrationCount),
    concentration_amount: round4(concentrationAmount),
    top_issuer: allRows[0]?.issuer_name || null,
  };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}
