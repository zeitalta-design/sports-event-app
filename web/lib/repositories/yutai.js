/**
 * 株主優待ナビ — DB アクセス層
 *
 * yutai_items テーブルへの CRUD を提供する。
 * 一覧 / 詳細 / compare / favorites から使われる。
 */

import { getDb } from "@/lib/db";

/**
 * 一覧取得（フィルタ + ページネーション）
 *
 * @param {Object} opts
 * @param {string} [opts.keyword]
 * @param {string} [opts.category]
 * @param {string} [opts.sort]       - "popular" | "newest" | "min_investment_asc" | "min_investment_desc"
 * @param {number} [opts.page]       - default 1
 * @param {number} [opts.pageSize]   - default 20
 * @returns {{ items: object[], total: number, totalPages: number }}
 */
export function listYutaiItems({
  keyword = "",
  category = "",
  sort = "popular",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};

  if (keyword) {
    where.push("(title LIKE @kw OR code LIKE @kw OR benefit_summary LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  // ソート
  let orderBy;
  switch (sort) {
    case "newest":
      orderBy = "created_at DESC";
      break;
    case "min_investment_asc":
      orderBy = "min_investment ASC";
      break;
    case "min_investment_desc":
      orderBy = "min_investment DESC";
      break;
    default:
      orderBy = "id ASC"; // popular = default order
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM yutai_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM yutai_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  // confirm_months を JSON パース
  return {
    items: items.map(normalizeItem),
    total,
    totalPages,
  };
}

/**
 * slug で1件取得
 * @param {string} slug
 * @returns {object|null}
 */
export function getYutaiBySlug(slug) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM yutai_items WHERE slug = ? AND is_published = 1").get(slug);
  return row ? normalizeItem(row) : null;
}

/**
 * ID で1件取得
 * @param {number} id
 * @returns {object|null}
 */
export function getYutaiById(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM yutai_items WHERE id = ? AND is_published = 1").get(id);
  return row ? normalizeItem(row) : null;
}

/**
 * 複数 ID で取得（compare 用）
 * @param {number[]} ids
 * @returns {object[]}
 */
export function getYutaiByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT * FROM yutai_items WHERE id IN (${placeholders}) AND is_published = 1`
  ).all(...ids);
  return rows.map(normalizeItem);
}

/**
 * code をキーに upsert（import 用）
 * @param {object} item - 正規化済みアイテム
 * @returns {{ action: "insert" | "update" | "skip", id: number|null }}
 */
export function upsertYutaiItem(item) {
  const db = getDb();

  // code で既存を検索
  let existing = null;
  if (item.code) {
    existing = db.prepare("SELECT id FROM yutai_items WHERE code = ?").get(item.code);
  }
  // code がなければ slug で検索
  if (!existing && item.slug) {
    existing = db.prepare("SELECT id FROM yutai_items WHERE slug = ?").get(item.slug);
  }

  if (existing) {
    db.prepare(`
      UPDATE yutai_items SET
        slug = @slug, title = @title, category = @category,
        confirm_months = @confirm_months, min_investment = @min_investment,
        benefit_summary = @benefit_summary, dividend_yield = @dividend_yield,
        benefit_yield = @benefit_yield, is_published = @is_published,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO yutai_items
      (code, slug, title, category, confirm_months, min_investment,
       benefit_summary, dividend_yield, benefit_yield, is_published,
       created_at, updated_at)
    VALUES
      (@code, @slug, @title, @category, @confirm_months, @min_investment,
       @benefit_summary, @dividend_yield, @benefit_yield, @is_published,
       datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

/**
 * sitemap 用: 公開中アイテムの slug + updated_at を軽量取得
 * @returns {{ slug: string, updated_at: string|null }[]}
 */
export function listYutaiSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM yutai_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

/**
 * 管理画面用一覧（公開/非公開問わず全件、検索・ページネーション付き）
 */
export function listYutaiAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) {
    where.push("(title LIKE @kw OR code LIKE @kw OR slug LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM yutai_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM yutai_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items: items.map(normalizeItem), total, totalPages };
}

/**
 * 管理画面用 ID 取得（非公開含む）
 */
export function getYutaiAdminById(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM yutai_items WHERE id = ?").get(id);
  return row ? normalizeItem(row) : null;
}

/**
 * 新規作成
 */
export function createYutaiItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO yutai_items (code, slug, title, category, confirm_months, min_investment,
      benefit_summary, dividend_yield, benefit_yield, is_published, created_at, updated_at)
    VALUES (@code, @slug, @title, @category, @confirm_months, @min_investment,
      @benefit_summary, @dividend_yield, @benefit_yield, @is_published, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

/**
 * 更新
 */
export function updateYutaiItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE yutai_items SET code = @code, slug = @slug, title = @title, category = @category,
      confirm_months = @confirm_months, min_investment = @min_investment,
      benefit_summary = @benefit_summary, dividend_yield = @dividend_yield,
      benefit_yield = @benefit_yield, is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}

/**
 * DB 行を正規化（confirm_months の JSON パースなど）
 */
function normalizeItem(row) {
  let confirmMonths = [];
  try {
    confirmMonths = JSON.parse(row.confirm_months || "[]");
  } catch {
    confirmMonths = [];
  }
  return {
    ...row,
    confirm_months: confirmMonths,
  };
}
