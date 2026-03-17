import { getDb } from "./db.js";

/**
 * Phase158: 大会写真サービス
 *
 * 大会写真のCRUD + 詳細ページ向けデータ取得。
 * image_type: hero, course, venue, start, finish, crowd, scenery, other
 * source_type: official, organizer, user, editorial
 */

const IMAGE_TYPE_ORDER = {
  hero: 0,
  course: 1,
  venue: 2,
  start: 3,
  finish: 4,
  crowd: 5,
  scenery: 6,
  other: 9,
};

// ---------------------------------------------------------------------------
// 公開: 写真取得
// ---------------------------------------------------------------------------

/**
 * 大会の公開写真一覧を取得
 */
export function getEventPhotos(eventId, { imageType, limit = 50, offset = 0 } = {}) {
  const db = getDb();

  let where = "event_id = ? AND status = 'published'";
  const params = [eventId];

  if (imageType) {
    where += " AND image_type = ?";
    params.push(imageType);
  }

  const rows = db.prepare(`
    SELECT * FROM event_photos
    WHERE ${where}
    ORDER BY display_order ASC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM event_photos WHERE ${where}
  `).get(...params);

  return { photos: rows, total: countRow?.cnt || 0 };
}

/**
 * 大会のヒーロー画像を取得（1枚）
 */
export function getEventHeroPhoto(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM event_photos
    WHERE event_id = ? AND status = 'published'
    ORDER BY
      CASE WHEN image_type = 'hero' THEN 0 ELSE 1 END,
      display_order ASC
    LIMIT 1
  `).get(eventId) || null;
}

/**
 * 大会のギャラリー写真（ヒーロー除く、型別にグルーピング）
 */
export function getEventGalleryPhotos(eventId, limit = 12) {
  const db = getDb();
  const photos = db.prepare(`
    SELECT * FROM event_photos
    WHERE event_id = ? AND status = 'published'
    ORDER BY display_order ASC, created_at DESC
    LIMIT ?
  `).all(eventId, limit);

  // カテゴリ別にグルーピング
  const grouped = {};
  for (const p of photos) {
    const type = p.image_type || "other";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(p);
  }

  return { photos, grouped };
}

/**
 * 大会の写真枚数を取得
 */
export function getEventPhotoCount(eventId) {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM event_photos WHERE event_id = ? AND status = 'published'"
  ).get(eventId);
  return row?.cnt || 0;
}

/**
 * カテゴリ別写真取得（口コミ・結果との接続用）
 */
export function getEventPhotosByType(eventId, imageTypes) {
  const db = getDb();
  const placeholders = imageTypes.map(() => "?").join(",");
  return db.prepare(`
    SELECT * FROM event_photos
    WHERE event_id = ? AND status = 'published'
      AND image_type IN (${placeholders})
    ORDER BY display_order ASC, created_at DESC
    LIMIT 6
  `).all(eventId, ...imageTypes);
}

/**
 * 写真の利用可能年度一覧
 */
export function getEventPhotoYears(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT taken_year
    FROM event_photos
    WHERE event_id = ? AND status = 'published' AND taken_year IS NOT NULL
    ORDER BY taken_year DESC
  `).all(eventId).map((r) => r.taken_year);
}

/**
 * 写真のimage_type一覧（大会別）
 */
export function getEventPhotoTypes(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT image_type, COUNT(*) as count
    FROM event_photos
    WHERE event_id = ? AND status = 'published'
    GROUP BY image_type
    ORDER BY count DESC
  `).all(eventId);
}

// ---------------------------------------------------------------------------
// 管理: 写真管理
// ---------------------------------------------------------------------------

/**
 * 管理画面用: 写真一覧
 */
export function getAdminPhotos({ eventId, sportType, status, imageType, limit = 50, offset = 0 } = {}) {
  const db = getDb();

  let where = "1=1";
  const params = [];

  if (eventId) {
    where += " AND ep.event_id = ?";
    params.push(eventId);
  }
  if (sportType) {
    where += " AND ep.sport_type = ?";
    params.push(sportType);
  }
  if (status) {
    where += " AND ep.status = ?";
    params.push(status);
  }
  if (imageType) {
    where += " AND ep.image_type = ?";
    params.push(imageType);
  }

  const rows = db.prepare(`
    SELECT ep.*, e.title as event_title
    FROM event_photos ep
    LEFT JOIN events e ON ep.event_id = e.id
    WHERE ${where}
    ORDER BY ep.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(*) as cnt FROM event_photos ep WHERE ${where}
  `).get(...params);

  return { photos: rows, total: countRow?.cnt || 0 };
}

/**
 * 写真ステータス更新
 */
export function updatePhotoStatus(photoId, newStatus) {
  const db = getDb();
  db.prepare(
    "UPDATE event_photos SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(newStatus, photoId);
  return { success: true };
}

/**
 * 写真メタデータ更新
 */
export function updatePhotoMeta(photoId, updates) {
  const db = getDb();
  const allowed = ["image_type", "caption", "alt_text", "display_order", "source_type", "status"];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }

  if (sets.length === 0) return { success: false, error: "no_updates" };

  sets.push("updated_at = datetime('now')");
  params.push(photoId);

  db.prepare(`UPDATE event_photos SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  return { success: true };
}

/**
 * 写真追加
 */
export function createPhoto(data) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO event_photos (
      event_id, sport_type, image_url, thumbnail_url,
      image_type, caption, alt_text, source_type, source_url,
      display_order, status, uploaded_by, taken_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.event_id,
    data.sport_type || null,
    data.image_url,
    data.thumbnail_url || null,
    data.image_type || "other",
    data.caption || null,
    data.alt_text || null,
    data.source_type || "editorial",
    data.source_url || null,
    data.display_order || 0,
    data.status || "published",
    data.uploaded_by || null,
    data.taken_year || null,
  );
  return { success: true, id: result.lastInsertRowid };
}

/**
 * イメージタイプのラベル
 */
export const IMAGE_TYPE_LABELS = {
  hero: "メイン",
  course: "コース",
  venue: "会場",
  start: "スタート",
  finish: "フィニッシュ",
  crowd: "盛り上がり",
  scenery: "景色",
  other: "その他",
};

export const SOURCE_TYPE_LABELS = {
  official: "公式",
  organizer: "運営",
  user: "ユーザー",
  editorial: "編集部",
};
