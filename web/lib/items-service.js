/**
 * items サービス — SaaSナビ MVP のデータアクセス層
 *
 * 共通の items テーブル + saas_details テーブルへのCRUDと検索を提供。
 * 将来的に lib/core/items.js へ移行する候補だが、
 * MVP では YAGNI 原則で SaaS 固有ロジックも含めてここに置く。
 */

import { getDb } from "./db";

// ──────────────────────────────────────────
// 検索・一覧
// ──────────────────────────────────────────

/**
 * アイテム一覧を取得（フィルタ・ソート・ページネーション対応）
 */
export function searchItems({
  category,
  keyword,
  priceRange,
  companySize,
  hasFreePlan,
  hasFreeTrial,
  sort = "popularity",
  page = 1,
  pageSize = 20,
} = {}) {
  const db = getDb();
  const conditions = ["i.is_published = 1"];
  const params = [];

  if (category) {
    conditions.push("i.category = ?");
    params.push(category);
  }

  if (keyword) {
    conditions.push("(i.title LIKE ? OR i.summary LIKE ? OR i.description LIKE ?)");
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }

  if (priceRange) {
    if (priceRange === "0") {
      conditions.push("sd.has_free_plan = 1");
    } else if (priceRange.endsWith("-")) {
      const min = parseInt(priceRange);
      conditions.push("sd.price_monthly >= ?");
      params.push(min);
    } else if (priceRange.includes("-")) {
      const [min, max] = priceRange.split("-").map(Number);
      conditions.push("sd.price_monthly >= ? AND sd.price_monthly <= ?");
      params.push(min, max);
    }
  }

  if (companySize) {
    const [min, max] = companySize.split("-").map((v) => (v === "" ? null : Number(v)));
    if (min != null) {
      conditions.push("(sd.company_size_max IS NULL OR sd.company_size_max >= ?)");
      params.push(min);
    }
    if (max != null) {
      conditions.push("(sd.company_size_min IS NULL OR sd.company_size_min <= ?)");
      params.push(max);
    }
  }

  if (hasFreePlan) {
    conditions.push("sd.has_free_plan = 1");
  }

  if (hasFreeTrial) {
    conditions.push("sd.has_free_trial = 1");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy;
  switch (sort) {
    case "newest":
      orderBy = "i.created_at DESC";
      break;
    case "price_asc":
      orderBy = "COALESCE(sd.price_monthly, 999999) ASC";
      break;
    case "price_desc":
      orderBy = "COALESCE(sd.price_monthly, 0) DESC";
      break;
    default:
      orderBy = "i.popularity_score DESC, i.created_at DESC";
  }

  const offset = (page - 1) * pageSize;

  const countRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM items i
    LEFT JOIN saas_details sd ON sd.item_id = i.id
    ${where}
  `).get(...params);

  const items = db.prepare(`
    SELECT
      i.*,
      sd.price_monthly, sd.price_display, sd.has_free_plan, sd.has_free_trial,
      sd.trial_days, sd.company_size_label, sd.api_available, sd.mobile_app,
      sd.support_type, sd.deployment_type,
      p.name as provider_name, p.slug as provider_slug, p.logo_url as provider_logo
    FROM items i
    LEFT JOIN saas_details sd ON sd.item_id = i.id
    LEFT JOIN providers p ON p.id = i.provider_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return {
    items,
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize),
  };
}

// ──────────────────────────────────────────
// 詳細取得
// ──────────────────────────────────────────

/**
 * スラッグまたはIDでアイテムを取得
 */
export function getItemBySlug(slug) {
  const db = getDb();
  const item = db.prepare(`
    SELECT
      i.*,
      sd.price_monthly, sd.price_display, sd.has_free_plan, sd.has_free_trial,
      sd.trial_days, sd.company_size_min, sd.company_size_max, sd.company_size_label,
      sd.api_available, sd.mobile_app, sd.support_type, sd.deployment_type,
      p.name as provider_name, p.slug as provider_slug, p.url as provider_url,
      p.logo_url as provider_logo, p.description as provider_description
    FROM items i
    LEFT JOIN saas_details sd ON sd.item_id = i.id
    LEFT JOIN providers p ON p.id = i.provider_id
    WHERE i.slug = ? AND i.is_published = 1
  `).get(slug);

  if (!item) return null;

  // バリアント（プラン）
  item.variants = db.prepare(
    "SELECT * FROM item_variants WHERE item_id = ? ORDER BY sort_order, id"
  ).all(item.id);

  // タグ
  item.tags = db.prepare(
    "SELECT * FROM item_tags WHERE item_id = ? ORDER BY tag_group, tag"
  ).all(item.id);

  // レビュー
  item.reviews = db.prepare(
    "SELECT * FROM item_reviews WHERE item_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 10"
  ).all(item.id);

  // レビュー集計
  const reviewAgg = db.prepare(`
    SELECT COUNT(*) as count, AVG(rating_overall) as avg_rating
    FROM item_reviews WHERE item_id = ? AND is_approved = 1
  `).get(item.id);
  item.review_count = reviewAgg.count;
  item.review_avg = reviewAgg.avg_rating ? Math.round(reviewAgg.avg_rating * 10) / 10 : null;

  // extension_json をパース
  if (item.extension_json) {
    try {
      item.extension = JSON.parse(item.extension_json);
    } catch {
      item.extension = {};
    }
  } else {
    item.extension = {};
  }

  return item;
}

export function getItemById(id) {
  const db = getDb();
  const item = db.prepare(`
    SELECT i.*, p.name as provider_name, p.slug as provider_slug
    FROM items i
    LEFT JOIN providers p ON p.id = i.provider_id
    WHERE i.id = ?
  `).get(id);
  return item || null;
}

/**
 * 同カテゴリの他ツール（代替候補）
 */
export function getAlternatives(itemId, category, limit = 5) {
  const db = getDb();
  return db.prepare(`
    SELECT
      i.id, i.title, i.slug, i.category, i.summary, i.hero_image_url,
      sd.price_display, sd.has_free_plan,
      p.name as provider_name
    FROM items i
    LEFT JOIN saas_details sd ON sd.item_id = i.id
    LEFT JOIN providers p ON p.id = i.provider_id
    WHERE i.category = ? AND i.id != ? AND i.is_published = 1
    ORDER BY i.popularity_score DESC
    LIMIT ?
  `).all(category, itemId, limit);
}

// ──────────────────────────────────────────
// 比較
// ──────────────────────────────────────────

/**
 * 複数アイテムを比較用に取得
 */
export function getItemsForCompare(ids) {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`
    SELECT
      i.*,
      sd.price_monthly, sd.price_display, sd.has_free_plan, sd.has_free_trial,
      sd.trial_days, sd.company_size_label, sd.api_available, sd.mobile_app,
      sd.support_type, sd.deployment_type,
      p.name as provider_name, p.slug as provider_slug, p.logo_url as provider_logo
    FROM items i
    LEFT JOIN saas_details sd ON sd.item_id = i.id
    LEFT JOIN providers p ON p.id = i.provider_id
    WHERE i.id IN (${placeholders}) AND i.is_published = 1
  `).all(...ids);
}

// ──────────────────────────────────────────
// カテゴリ別件数
// ──────────────────────────────────────────

export function getCategoryCounts() {
  const db = getDb();
  return db.prepare(`
    SELECT category, COUNT(*) as count
    FROM items
    WHERE is_published = 1
    GROUP BY category
  `).all();
}

// ──────────────────────────────────────────
// 管理画面用
// ──────────────────────────────────────────

/**
 * 管理画面用: アイテム一覧（下書き含む）
 */
export function adminSearchItems({ keyword, category, isPublished, page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (category) {
    conditions.push("i.category = ?");
    params.push(category);
  }
  if (keyword) {
    conditions.push("(i.title LIKE ? OR i.summary LIKE ?)");
    const kw = `%${keyword}%`;
    params.push(kw, kw);
  }
  if (isPublished !== undefined && isPublished !== null && isPublished !== "") {
    conditions.push("i.is_published = ?");
    params.push(Number(isPublished));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM items i ${where}`).get(...params);

  const items = db.prepare(`
    SELECT i.*, p.name as provider_name
    FROM items i
    LEFT JOIN providers p ON p.id = i.provider_id
    ${where}
    ORDER BY i.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return { items, total: countRow.total, page, pageSize };
}

/**
 * 管理画面用: アイテム作成
 */
export function createItem(data) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO items (title, slug, category, subcategory, status, description, summary,
      url, hero_image_url, price_min, price_max, provider_id, extension_json, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.title, data.slug, data.category, data.subcategory || null,
    data.status || "active", data.description || null, data.summary || null,
    data.url || null, data.hero_image_url || null,
    data.price_min ?? null, data.price_max ?? null,
    data.provider_id || null, data.extension_json || null,
    data.is_published ? 1 : 0
  );
  return result.lastInsertRowid;
}

/**
 * 管理画面用: アイテム更新
 */
export function updateItem(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE items SET
      title = ?, slug = ?, category = ?, subcategory = ?, status = ?,
      description = ?, summary = ?, url = ?, hero_image_url = ?,
      price_min = ?, price_max = ?, provider_id = ?,
      extension_json = ?, is_published = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.title, data.slug, data.category, data.subcategory || null,
    data.status || "active", data.description || null, data.summary || null,
    data.url || null, data.hero_image_url || null,
    data.price_min ?? null, data.price_max ?? null,
    data.provider_id || null, data.extension_json || null,
    data.is_published ? 1 : 0, id
  );
}

/**
 * 管理画面用: SaaS詳細の upsert
 */
export function upsertSaasDetails(itemId, data) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM saas_details WHERE item_id = ?").get(itemId);
  if (existing) {
    db.prepare(`
      UPDATE saas_details SET
        price_monthly = ?, price_display = ?, has_free_plan = ?, has_free_trial = ?,
        trial_days = ?, company_size_min = ?, company_size_max = ?, company_size_label = ?,
        api_available = ?, mobile_app = ?, support_type = ?, deployment_type = ?
      WHERE item_id = ?
    `).run(
      data.price_monthly ?? null, data.price_display || null,
      data.has_free_plan ? 1 : 0, data.has_free_trial ? 1 : 0,
      data.trial_days ?? null,
      data.company_size_min ?? null, data.company_size_max ?? null,
      data.company_size_label || null,
      data.api_available ? 1 : 0, data.mobile_app ? 1 : 0,
      data.support_type || null, data.deployment_type || "cloud",
      itemId
    );
  } else {
    db.prepare(`
      INSERT INTO saas_details (item_id, price_monthly, price_display, has_free_plan, has_free_trial,
        trial_days, company_size_min, company_size_max, company_size_label,
        api_available, mobile_app, support_type, deployment_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      data.price_monthly ?? null, data.price_display || null,
      data.has_free_plan ? 1 : 0, data.has_free_trial ? 1 : 0,
      data.trial_days ?? null,
      data.company_size_min ?? null, data.company_size_max ?? null,
      data.company_size_label || null,
      data.api_available ? 1 : 0, data.mobile_app ? 1 : 0,
      data.support_type || null, data.deployment_type || "cloud"
    );
  }
}

/**
 * 管理画面用: バリアント（プラン）の一括更新
 */
export function replaceVariants(itemId, variants) {
  const db = getDb();
  db.prepare("DELETE FROM item_variants WHERE item_id = ?").run(itemId);
  const insert = db.prepare(
    "INSERT INTO item_variants (item_id, name, attributes_json, sort_order) VALUES (?, ?, ?, ?)"
  );
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    insert.run(itemId, v.name, JSON.stringify(v.attributes || {}), i);
  }
}

/**
 * 管理画面用: タグの一括更新
 */
export function replaceTags(itemId, tags) {
  const db = getDb();
  db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO item_tags (item_id, tag, tag_group) VALUES (?, ?, ?)"
  );
  for (const t of tags) {
    insert.run(itemId, t.tag || t, t.tag_group || "feature");
  }
}

// ──────────────────────────────────────────
// プロバイダー管理
// ──────────────────────────────────────────

export function getAllProviders() {
  const db = getDb();
  return db.prepare("SELECT * FROM providers ORDER BY name").all();
}

export function getProviderById(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM providers WHERE id = ?").get(id);
}

export function createProvider(data) {
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO providers (name, slug, url, logo_url, description) VALUES (?, ?, ?, ?, ?)"
  ).run(data.name, data.slug, data.url || null, data.logo_url || null, data.description || null);
  return result.lastInsertRowid;
}

export function updateProvider(id, data) {
  const db = getDb();
  db.prepare(
    "UPDATE providers SET name = ?, slug = ?, url = ?, logo_url = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(data.name, data.slug, data.url || null, data.logo_url || null, data.description || null, id);
}

export function deleteProvider(id) {
  const db = getDb();
  // アイテムが紐づいていたら削除不可
  const count = db.prepare("SELECT COUNT(*) as c FROM items WHERE provider_id = ?").get(id);
  if (count.c > 0) {
    throw new Error(`${count.c}件のツールが紐づいているため削除できません`);
  }
  db.prepare("DELETE FROM providers WHERE id = ?").run(id);
}
