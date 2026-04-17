/**
 * organizations 一覧 / 単発検索用のリポジトリ。
 * Cross-domain 企業ハブ（/organizations）向けの薄い API が使う。
 *
 * ポリシー:
 *   - 一覧には「件数バッジ」だけ載せる（詳細集計・ダッシュボードは禁止）
 *   - ドメイン別 COUNT は page 単位で 5 クエリ（N ではなく 5）にまとめる
 *   - fuzzy / LLM は使わない
 */
import { getDb } from "@/lib/db";

/**
 * @param {Object} opts
 * @param {string} [opts.keyword]   - 表示名 / 正規化名 LIKE
 * @param {string} [opts.corp]      - corporate_number 完全一致
 * @param {number} [opts.page=1]
 * @param {number} [opts.pageSize=20]
 * @param {boolean}[opts.onlyCorp]  - corporate_number ありだけに絞る
 * @returns {{
 *   items: Array<{
 *     id: number, display_name: string|null, normalized_name: string|null,
 *     corporate_number: string|null, prefecture: string|null, city: string|null,
 *     source: string|null,
 *     counts: { nyusatsu: number, hojokin: number, kyoninka: number,
 *               gyosei_shobun: number, sanpai: number }
 *   }>,
 *   total: number, page: number, pageSize: number, totalPages: number
 * }}
 */
export function listOrganizations({
  keyword = "",
  corp = "",
  page = 1,
  pageSize = 20,
  onlyCorp = false,
} = {}) {
  const db = getDb();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

  const where = ["o.is_active = 1"];
  const params = {};
  if (corp) {
    where.push("o.corporate_number = @corp");
    params.corp = String(corp).trim();
  } else if (keyword) {
    where.push("(o.display_name LIKE @kw OR o.normalized_name LIKE @kw OR o.corporate_number = @corpExact)");
    params.kw = `%${String(keyword).trim()}%`;
    params.corpExact = String(keyword).trim();
  }
  if (onlyCorp) {
    where.push("o.corporate_number IS NOT NULL AND o.corporate_number != ''");
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const total = db.prepare(`SELECT COUNT(*) n FROM organizations o ${whereSql}`).get(params)?.n || 0;
  const totalPages = Math.max(1, Math.ceil(total / ps));

  const rows = db.prepare(`
    SELECT o.id, o.display_name, o.normalized_name, o.corporate_number,
           o.prefecture, o.city, o.source, o.created_at
    FROM organizations o
    ${whereSql}
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: ps, offset: (p - 1) * ps });

  if (rows.length === 0) {
    return { items: [], total, page: p, pageSize: ps, totalPages };
  }

  // ─── page 単位の bulk count（5 クエリで済む） ──────────────────────
  const orgIds = rows.map((r) => r.id);
  const corps = rows.map((r) => r.corporate_number).filter((c) => c);
  const orgIn = `(${orgIds.map(() => "?").join(",")})`;
  const corpIn = corps.length > 0 ? `(${corps.map(() => "?").join(",")})` : null;

  const counts = Object.fromEntries(orgIds.map((id) => [id, {
    nyusatsu: 0, hojokin: 0, kyoninka: 0, gyosei_shobun: 0, sanpai: 0,
  }]));
  const corpToOrg = new Map();
  for (const r of rows) { if (r.corporate_number) corpToOrg.set(r.corporate_number, r.id); }

  // hojokin (organization_id)
  for (const row of db.prepare(
    `SELECT organization_id, COUNT(*) n FROM hojokin_items
      WHERE organization_id IN ${orgIn} AND is_published = 1
      GROUP BY organization_id`
  ).all(...orgIds)) {
    if (counts[row.organization_id]) counts[row.organization_id].hojokin = row.n;
  }

  // kyoninka (organization_id)
  for (const row of db.prepare(
    `SELECT organization_id, COUNT(*) n FROM kyoninka_entities
      WHERE organization_id IN ${orgIn} AND is_published = 1
      GROUP BY organization_id`
  ).all(...orgIds)) {
    if (counts[row.organization_id]) counts[row.organization_id].kyoninka = row.n;
  }

  // gyosei_shobun (organization_id)
  for (const row of db.prepare(
    `SELECT organization_id, COUNT(*) n FROM administrative_actions
      WHERE organization_id IN ${orgIn} AND is_published = 1
      GROUP BY organization_id`
  ).all(...orgIds)) {
    if (counts[row.organization_id]) counts[row.organization_id].gyosei_shobun = row.n;
  }

  // nyusatsu (corporate_number)
  if (corpIn) {
    for (const row of db.prepare(
      `SELECT winner_corporate_number AS corp, COUNT(*) n FROM nyusatsu_results
        WHERE winner_corporate_number IN ${corpIn} AND is_published = 1
        GROUP BY winner_corporate_number`
    ).all(...corps)) {
      const oid = corpToOrg.get(row.corp);
      if (oid != null && counts[oid]) counts[oid].nyusatsu = row.n;
    }

    // sanpai (corporate_number)
    for (const row of db.prepare(
      `SELECT corporate_number AS corp, COUNT(*) n FROM sanpai_items
        WHERE corporate_number IN ${corpIn} AND is_published = 1
        GROUP BY corporate_number`
    ).all(...corps)) {
      const oid = corpToOrg.get(row.corp);
      if (oid != null && counts[oid]) counts[oid].sanpai = row.n;
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    normalized_name: r.normalized_name,
    corporate_number: r.corporate_number,
    prefecture: r.prefecture,
    city: r.city,
    source: r.source,
    counts: counts[r.id],
  }));

  return { items, total, page: p, pageSize: ps, totalPages };
}
