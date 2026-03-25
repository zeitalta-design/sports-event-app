/**
 * 入札ナビ — DB アクセス層
 * yutai / hojokin repository と同じパターン。
 */

import { getDb } from "@/lib/db";

export function listNyusatsuItems({
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
    where.push("(title LIKE @kw OR summary LIKE @kw OR issuer_name LIKE @kw)");
    params.kw = `%${keyword}%`;
  }
  if (category) {
    where.push("category = @category");
    params.category = category;
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;

  let orderBy;
  switch (sort) {
    case "deadline":
      orderBy = "CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC";
      break;
    case "budget_desc":
      orderBy = "budget_amount DESC";
      break;
    case "newest":
      orderBy = "created_at DESC";
      break;
    default:
      orderBy = "id ASC";
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM nyusatsu_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;

  const items = db.prepare(`
    SELECT * FROM nyusatsu_items ${whereClause}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset });

  return { items, total, totalPages };
}

export function getNyusatsuBySlug(slug) {
  const db = getDb();
  return db.prepare("SELECT * FROM nyusatsu_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getNyusatsuById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM nyusatsu_items WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getNyusatsuByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const ph = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM nyusatsu_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

/**
 * slug をキーに upsert（import 用）
 */
export function upsertNyusatsuItem(item) {
  const db = getDb();
  const existing = item.slug
    ? db.prepare("SELECT id FROM nyusatsu_items WHERE slug = ?").get(item.slug)
    : null;

  if (existing) {
    db.prepare(`
      UPDATE nyusatsu_items SET
        title = @title, category = @category, issuer_name = @issuer_name,
        target_area = @target_area, deadline = @deadline,
        budget_amount = @budget_amount, bidding_method = @bidding_method,
        summary = @summary, status = @status, is_published = @is_published,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO nyusatsu_items
      (slug, title, category, issuer_name, target_area, deadline,
       budget_amount, bidding_method, summary, status, is_published,
       created_at, updated_at)
    VALUES
      (@slug, @title, @category, @issuer_name, @target_area, @deadline,
       @budget_amount, @bidding_method, @summary, @status, @is_published,
       datetime('now'), datetime('now'))
  `).run(item);
  return { action: "insert", id: result.lastInsertRowid };
}

export function listNyusatsuSlugsForSitemap() {
  const db = getDb();
  return db.prepare(
    "SELECT slug, updated_at FROM nyusatsu_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id"
  ).all();
}

// ─── Admin 用関数 ─────────────────────

export function listNyusatsuAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR slug LIKE @kw OR issuer_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM nyusatsu_items ${whereClause}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM nyusatsu_items ${whereClause} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getNyusatsuAdminById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM nyusatsu_items WHERE id = ?").get(id) || null;
}

export function createNyusatsuItem(item) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO nyusatsu_items (slug, title, category, issuer_name, target_area, deadline,
      budget_amount, bidding_method, summary, status, is_published, created_at, updated_at)
    VALUES (@slug, @title, @category, @issuer_name, @target_area, @deadline,
      @budget_amount, @bidding_method, @summary, @status, @is_published, datetime('now'), datetime('now'))
  `).run(item);
  return { id: result.lastInsertRowid };
}

export function updateNyusatsuItem(id, item) {
  const db = getDb();
  db.prepare(`
    UPDATE nyusatsu_items SET slug = @slug, title = @title, category = @category,
      issuer_name = @issuer_name, target_area = @target_area, deadline = @deadline,
      budget_amount = @budget_amount, bidding_method = @bidding_method,
      summary = @summary, status = @status, is_published = @is_published, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...item, id });
  return { id };
}
