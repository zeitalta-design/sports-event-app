/**
 * Phase205: 大会タグサービス
 *
 * タグ例: フラット, 絶景, 初心者, 都市型, ローカル, 温泉, 海沿い, 山岳
 */

import { getDb } from "@/lib/db";

// ─── 定義済みタグ ──────────────────────────────

export const STANDARD_TAGS = [
  { value: "flat", label: "フラット", icon: "🛣️", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "scenic", label: "絶景", icon: "🏔️", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { value: "beginner", label: "初心者", icon: "🌱", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "urban", label: "都市型", icon: "🏙️", color: "bg-gray-50 text-gray-700 border-gray-200" },
  { value: "local", label: "ローカル", icon: "🏡", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "onsen", label: "温泉", icon: "♨️", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "coastal", label: "海沿い", icon: "🌊", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "mountain", label: "山岳", icon: "⛰️", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "night", label: "ナイトラン", icon: "🌙", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "charity", label: "チャリティ", icon: "💝", color: "bg-pink-50 text-pink-700 border-pink-200" },
];

// ─── 取得系 ──────────────────────────────────

/**
 * 大会のタグ一覧を取得
 */
export function getEventTags(eventId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT tag FROM event_tags WHERE event_id = ? ORDER BY tag`
  ).all(eventId);

  return rows.map((r) => {
    const def = STANDARD_TAGS.find((t) => t.value === r.tag);
    return def || { value: r.tag, label: r.tag, icon: "🏷️", color: "bg-gray-50 text-gray-600 border-gray-200" };
  });
}

/**
 * 複数大会のタグを一括取得
 */
export function getBatchEventTags(eventIds) {
  if (!eventIds || eventIds.length === 0) return new Map();
  const db = getDb();
  const ph = eventIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT event_id, tag FROM event_tags WHERE event_id IN (${ph}) ORDER BY event_id, tag`
  ).all(...eventIds);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.event_id)) map.set(row.event_id, []);
    const def = STANDARD_TAGS.find((t) => t.value === row.tag);
    map.get(row.event_id).push(
      def || { value: row.tag, label: row.tag, icon: "🏷️", color: "bg-gray-50 text-gray-600 border-gray-200" }
    );
  }
  return map;
}

// ─── 更新系 ──────────────────────────────────

/**
 * 大会にタグを追加
 */
export function addEventTag(eventId, tag) {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO event_tags (event_id, tag) VALUES (?, ?)`
  ).run(eventId, tag);
}

/**
 * 大会からタグを削除
 */
export function removeEventTag(eventId, tag) {
  const db = getDb();
  db.prepare(
    `DELETE FROM event_tags WHERE event_id = ? AND tag = ?`
  ).run(eventId, tag);
}

/**
 * 大会のタグを一括設定（既存を置換）
 */
export function setEventTags(eventId, tags) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM event_tags WHERE event_id = ?`).run(eventId);
    const ins = db.prepare(`INSERT INTO event_tags (event_id, tag) VALUES (?, ?)`);
    for (const tag of tags) {
      ins.run(eventId, tag);
    }
  });
  tx();
}

/**
 * 特定タグの大会一覧
 */
export function getEventsByTag(tag, { limit = 20, sportType = null } = {}) {
  const db = getDb();
  const sportFilter = sportType ? "AND e.sport_type = ?" : "";
  const params = sportType ? [tag, sportType, limit] : [tag, limit];

  return db.prepare(`
    SELECT e.id, e.title, e.event_date, e.prefecture, e.entry_status, e.sport_type,
           e.description, e.popularity_score
    FROM events e
    INNER JOIN event_tags et ON et.event_id = e.id AND et.tag = ?
    WHERE e.is_active = 1 AND e.event_date >= date('now')
      ${sportFilter}
    ORDER BY e.popularity_score DESC, e.event_date ASC
    LIMIT ?
  `).all(...params);
}

/**
 * 大会テキストからタグを自動推定
 */
export function autoDetectTags(event) {
  const tags = [];
  const text = [event.title, event.description, event.features_json || ""].join(" ").toLowerCase();

  if (/フラット|平坦|高低差.{0,3}少/.test(text)) tags.push("flat");
  if (/絶景|景色|眺望|パノラマ/.test(text)) tags.push("scenic");
  if (/初心者|ビギナー|初めて|ファンラン/.test(text)) tags.push("beginner");
  if (/都市|シティ|市街|駅前/.test(text)) tags.push("urban");
  if (/地方|ローカル|里山|田舎|村/.test(text)) tags.push("local");
  if (/温泉|入浴|湯/.test(text)) tags.push("onsen");
  if (/海沿い|海岸|ビーチ|湘南|海/.test(text)) tags.push("coastal");
  if (/山岳|登山|アルプス|山頂|峠/.test(text)) tags.push("mountain");
  if (/ナイト|夜|夕方|イルミ/.test(text)) tags.push("night");
  if (/チャリティ|寄付|社会貢献/.test(text)) tags.push("charity");

  return tags;
}
