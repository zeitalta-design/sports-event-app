/**
 * Analyzer 共通: nyusatsu_results を Resolver 済み entity / cluster と
 * JOIN するための SQL フラグメント。
 *
 * 結合戦略（OR 条件）:
 *   1) winner_corporate_number = resolved_entities.corporate_number  (Layer 1 ヒット)
 *   2) resolution_aliases.raw_name = winner_name                     (alias 経由)
 *
 * どちらもヒットしない場合 entity_id は NULL。Analyzer 関数は
 * 目的に応じて NULL を除外 or "未解決プール" として扱う。
 */

/**
 * nyusatsu_results に entity_id / cluster_id / canonical_name を付与する
 * CTE 相当の SQL サブクエリ（結果を FROM 句で使う想定）。
 *
 * 生成されるカラム:
 *   - result_id, title, issuer_name, winner_name, winner_corporate_number,
 *     award_amount, award_date, category, target_area, bidding_method
 *   - entity_id          (LEFT JOIN 結果、NULL 可)
 *   - entity_name        (canonical)
 *   - entity_corp_number
 *   - cluster_id         (NULL 可)
 *   - cluster_name       (NULL 可)
 */
export const RESOLVED_RESULTS_SQL = `
  SELECT
    r.id                                         AS result_id,
    r.title                                      AS title,
    r.issuer_name                                AS issuer_name,
    r.winner_name                                AS winner_name,
    r.winner_corporate_number                    AS winner_corporate_number,
    r.award_amount                               AS award_amount,
    r.award_date                                 AS award_date,
    r.category                                   AS category,
    r.target_area                                AS target_area,
    r.bidding_method                             AS bidding_method,
    COALESCE(e_by_corp.id, e_by_alias.id)        AS entity_id,
    COALESCE(e_by_corp.canonical_name, e_by_alias.canonical_name) AS entity_name,
    COALESCE(e_by_corp.corporate_number, e_by_alias.corporate_number) AS entity_corp_number,
    COALESCE(e_by_corp.cluster_id, e_by_alias.cluster_id) AS cluster_id,
    c.canonical_name                             AS cluster_name
  FROM nyusatsu_results r
  LEFT JOIN resolved_entities e_by_corp
    ON r.winner_corporate_number IS NOT NULL
   AND r.winner_corporate_number != ''
   AND e_by_corp.corporate_number = r.winner_corporate_number
  LEFT JOIN resolution_aliases a
    ON e_by_corp.id IS NULL
   AND a.raw_name = r.winner_name
  LEFT JOIN resolved_entities e_by_alias
    ON e_by_corp.id IS NULL
   AND e_by_alias.id = a.entity_id
  LEFT JOIN entity_clusters c
    ON c.id = COALESCE(e_by_corp.cluster_id, e_by_alias.cluster_id)
  WHERE r.is_published = 1
    AND r.winner_name IS NOT NULL AND r.winner_name != ''
`;

/**
 * WHERE に追加する標準フィルタを組み立てる
 * @param {object} opts
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {string} [opts.category]
 * @param {string} [opts.issuerName]     発注機関完全一致
 * @param {boolean}[opts.resolvedOnly]   未解決 (entity_id NULL) を除外
 * @returns {{ where: string, params: object }}
 */
export function buildFilters(opts = {}) {
  const where = [];
  const params = {};
  if (opts.dateFrom) { where.push("award_date >= @dateFrom"); params.dateFrom = opts.dateFrom; }
  if (opts.dateTo)   { where.push("award_date <= @dateTo");   params.dateTo   = opts.dateTo; }
  if (opts.category) { where.push("category = @category");    params.category = opts.category; }
  if (opts.issuerName) { where.push("issuer_name = @issuerName"); params.issuerName = opts.issuerName; }
  if (opts.resolvedOnly) where.push("entity_id IS NOT NULL");
  return {
    where: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}
