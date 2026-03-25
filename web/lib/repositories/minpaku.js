import { getDb } from "@/lib/db";

export function listMinpakuItems({ keyword = "", category = "", sort = "popular", page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const where = ["is_published = 1"];
  const params = {};
  if (keyword) { where.push("(title LIKE @kw OR area LIKE @kw OR host_name LIKE @kw OR summary LIKE @kw)"); params.kw = `%${keyword}%`; }
  if (category) { where.push("category = @category"); params.category = category; }
  const wc = `WHERE ${where.join(" AND ")}`;
  let ob;
  switch (sort) {
    case "price_asc": ob = "price_per_night ASC"; break;
    case "price_desc": ob = "price_per_night DESC"; break;
    case "rating_desc": ob = "COALESCE(rating,0) DESC"; break;
    case "newest": ob = "created_at DESC"; break;
    default: ob = "id ASC";
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM minpaku_items ${wc}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM minpaku_items ${wc} ORDER BY ${ob} LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getMinpakuBySlug(slug) {
  return getDb().prepare("SELECT * FROM minpaku_items WHERE slug = ? AND is_published = 1").get(slug) || null;
}

export function getMinpakuById(id) {
  return getDb().prepare("SELECT * FROM minpaku_items WHERE id = ? AND is_published = 1").get(id) || null;
}

export function getMinpakuByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const ph = ids.map(() => "?").join(",");
  return getDb().prepare(`SELECT * FROM minpaku_items WHERE id IN (${ph}) AND is_published = 1`).all(...ids);
}

export function upsertMinpakuItem(item) {
  const db = getDb();
  const existing = item.slug ? db.prepare("SELECT id FROM minpaku_items WHERE slug = ?").get(item.slug) : null;
  if (existing) {
    db.prepare(`UPDATE minpaku_items SET title=@title, category=@category, area=@area, property_type=@property_type, capacity=@capacity, price_per_night=@price_per_night, min_nights=@min_nights, host_name=@host_name, rating=@rating, review_count=@review_count, summary=@summary, status=@status, is_published=@is_published, updated_at=datetime('now') WHERE id=@id`).run({ ...item, id: existing.id });
    return { action: "update", id: existing.id };
  }
  const r = db.prepare(`INSERT INTO minpaku_items (slug, title, category, area, property_type, capacity, price_per_night, min_nights, host_name, rating, review_count, summary, status, is_published, created_at, updated_at) VALUES (@slug, @title, @category, @area, @property_type, @capacity, @price_per_night, @min_nights, @host_name, @rating, @review_count, @summary, @status, @is_published, datetime('now'), datetime('now'))`).run(item);
  return { action: "insert", id: r.lastInsertRowid };
}

export function listMinpakuSlugsForSitemap() {
  return getDb().prepare("SELECT slug, updated_at FROM minpaku_items WHERE is_published = 1 AND slug IS NOT NULL AND slug != '' ORDER BY id").all();
}

// Admin
export function listMinpakuAdminItems({ keyword = "", page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const where = []; const params = {};
  if (keyword) { where.push("(title LIKE @kw OR slug LIKE @kw OR area LIKE @kw OR host_name LIKE @kw)"); params.kw = `%${keyword}%`; }
  const wc = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM minpaku_items ${wc}`).get(params).c;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (Math.max(1, page) - 1) * pageSize;
  const items = db.prepare(`SELECT * FROM minpaku_items ${wc} ORDER BY id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { items, total, totalPages };
}

export function getMinpakuAdminById(id) {
  return getDb().prepare("SELECT * FROM minpaku_items WHERE id = ?").get(id) || null;
}

export function createMinpakuItem(item) {
  const r = getDb().prepare(`INSERT INTO minpaku_items (slug, title, category, area, property_type, capacity, price_per_night, min_nights, host_name, rating, review_count, summary, status, is_published, created_at, updated_at) VALUES (@slug, @title, @category, @area, @property_type, @capacity, @price_per_night, @min_nights, @host_name, @rating, @review_count, @summary, @status, @is_published, datetime('now'), datetime('now'))`).run(item);
  return { id: r.lastInsertRowid };
}

export function updateMinpakuItem(id, item) {
  getDb().prepare(`UPDATE minpaku_items SET slug=@slug, title=@title, category=@category, area=@area, property_type=@property_type, capacity=@capacity, price_per_night=@price_per_night, min_nights=@min_nights, host_name=@host_name, rating=@rating, review_count=@review_count, summary=@summary, status=@status, is_published=@is_published, updated_at=datetime('now') WHERE id=@id`).run({ ...item, id });
  return { id };
}
