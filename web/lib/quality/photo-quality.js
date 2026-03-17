import { getDb } from "@/lib/db";

/**
 * Phase211: 写真品質管理サービス
 *
 * 重複候補・小画像・キャプション未入力・alt未設定・pendingの検知
 */

/**
 * 写真品質フラグを検出
 */
export function checkPhotoQuality(photo) {
  const flags = [];

  // キャプション未入力
  if (!photo.caption || photo.caption.trim() === "") {
    flags.push({ type: "no_caption", label: "キャプションなし" });
  }

  // alt未設定
  if (!photo.alt_text || photo.alt_text.trim() === "") {
    flags.push({ type: "no_alt", label: "ALT未設定" });
  }

  // image_typeがother
  if (photo.image_type === "other" || !photo.image_type) {
    flags.push({ type: "no_type", label: "タイプ未分類" });
  }

  return flags;
}

/**
 * 同一イベント内で重複候補の写真を検出（ファイル名ベースの簡易検知）
 */
export function detectDuplicatePhotos({ limit = 50 } = {}) {
  const db = getDb();

  // 同一イベント・同一ファイル名（URLの末尾部分）で重複検出
  const duplicates = db.prepare(`
    SELECT p1.id as id_a, p2.id as id_b,
           p1.event_id, p1.image_url as url_a, p2.image_url as url_b,
           e.title as event_title
    FROM event_photos p1
    INNER JOIN event_photos p2 ON p1.event_id = p2.event_id AND p1.id < p2.id
    LEFT JOIN events e ON p1.event_id = e.id
    WHERE p1.image_url = p2.image_url
      OR (
        p1.image_url IS NOT NULL AND p2.image_url IS NOT NULL
        AND REPLACE(REPLACE(p1.image_url, RTRIM(p1.image_url, REPLACE(p1.image_url, '/', '')), ''), '/', '')
          = REPLACE(REPLACE(p2.image_url, RTRIM(p2.image_url, REPLACE(p2.image_url, '/', '')), ''), '/', '')
      )
    LIMIT ?
  `).all(limit);

  return duplicates.map((d) => ({
    eventId: d.event_id,
    eventTitle: d.event_title,
    photoA: { id: d.id_a, url: d.url_a },
    photoB: { id: d.id_b, url: d.url_b },
  }));
}

/**
 * 要確認写真一覧（品質フラグ付き）
 */
export function getFlaggedPhotos({ limit = 50, offset = 0, statusFilter = "" } = {}) {
  const db = getDb();

  let where = "1=1";
  const params = [];
  if (statusFilter) {
    where = "p.status = ?";
    params.push(statusFilter);
  }

  const photos = db.prepare(`
    SELECT p.id, p.event_id, p.image_url, p.image_type, p.caption,
           p.alt_text, p.status, p.source_type, p.uploaded_by,
           p.created_at, e.title as event_title
    FROM event_photos p
    LEFT JOIN events e ON p.event_id = e.id
    WHERE ${where}
    ORDER BY p.created_at DESC
  `).all(...params);

  const flagged = [];
  for (const p of photos) {
    const flags = checkPhotoQuality(p);
    // pending は常にフラグ
    if (p.status === "pending") {
      flags.unshift({ type: "pending", label: "承認待ち" });
    }
    if (flags.length > 0) {
      flagged.push({ ...p, flags });
    }
  }

  return {
    total: flagged.length,
    items: flagged.slice(offset, offset + limit),
  };
}

/**
 * 写真品質サマリ
 */
export function getPhotoQualityStats() {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos`).get()?.cnt || 0;
  const published = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE status = 'published'`).get()?.cnt || 0;
  const pending = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE status = 'pending'`).get()?.cnt || 0;
  const hidden = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE status = 'hidden'`).get()?.cnt || 0;
  const noCaption = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE (status = 'published' OR status IS NULL) AND (caption IS NULL OR caption = '')`).get()?.cnt || 0;
  const noAlt = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE (status = 'published' OR status IS NULL) AND (alt_text IS NULL OR alt_text = '')`).get()?.cnt || 0;
  const noType = db.prepare(`SELECT COUNT(*) as cnt FROM event_photos WHERE (status = 'published' OR status IS NULL) AND (image_type IS NULL OR image_type = 'other')`).get()?.cnt || 0;

  return { total, published, pending, hidden, noCaption, noAlt, noType };
}
