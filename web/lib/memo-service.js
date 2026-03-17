import { getDb } from "./db.js";

/**
 * Phase171: 大会メモサービス（サーバーサイド）
 *
 * ログインユーザーのメモをDB管理。
 * 参加前（持ち物・交通）から参加後（気づき・改善点）まで対応。
 */

/**
 * メモカテゴリ定義（参加前 + 参加後）
 */
export const MEMO_CATEGORIES = [
  // 参加前
  { key: "持ち物",       icon: "🎒", placeholder: "ゼッケン、シューズ、ウェア...",     phase: "before" },
  { key: "当日の予定",    icon: "📅", placeholder: "受付時間、スタート時間...",        phase: "before" },
  { key: "交通・宿泊",    icon: "🚃", placeholder: "新幹線、ホテル、駐車場...",       phase: "before" },
  { key: "スケジュール",   icon: "⏰", placeholder: "前日入り、起床時間...",          phase: "before" },
  // 参加後
  { key: "当日の気づき",   icon: "💡", placeholder: "コースの坂がきつかった、給水所が...", phase: "after" },
  { key: "来年の改善点",   icon: "📈", placeholder: "前半のペース配分、補給タイミング...", phase: "after" },
  { key: "アクセス注意点",  icon: "🚗", placeholder: "渋滞しやすいルート、穴場駐車場...", phase: "after" },
  { key: "家族向けメモ",   icon: "👨‍👩‍👧", placeholder: "応援スポット、子供の待機場所...",  phase: "after" },
  { key: "大会メモ",      icon: "📝", placeholder: "コース注意点、目標タイム...",      phase: "both" },
];

const MAX_MEMO_LENGTH = 2000;

// ─── CRUD ────────────────────────────────────

/**
 * ユーザーの特定大会メモを全カテゴリ取得
 */
export function getUserEventMemos(userId, eventId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT category, memo_text, updated_at
    FROM event_memos
    WHERE user_id = ? AND event_id = ?
    ORDER BY updated_at DESC
  `).all(userId, eventId);

  const items = {};
  let latestUpdated = null;
  for (const row of rows) {
    items[row.category] = row.memo_text;
    if (!latestUpdated || row.updated_at > latestUpdated) {
      latestUpdated = row.updated_at;
    }
  }
  return { items, updatedAt: latestUpdated, count: rows.filter((r) => r.memo_text.trim()).length };
}

/**
 * メモを保存（upsert）
 */
export function saveUserMemo(userId, eventId, category, text) {
  const db = getDb();
  const trimmed = (text || "").slice(0, MAX_MEMO_LENGTH);

  db.prepare(`
    INSERT INTO event_memos (user_id, event_id, category, memo_text, updated_at, created_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id, event_id, category) DO UPDATE SET
      memo_text = excluded.memo_text,
      updated_at = datetime('now')
  `).run(userId, eventId, category, trimmed);

  return { ok: true };
}

/**
 * 特定大会のメモを全削除
 */
export function deleteUserEventMemos(userId, eventId) {
  const db = getDb();
  db.prepare("DELETE FROM event_memos WHERE user_id = ? AND event_id = ?").run(userId, eventId);
  return { ok: true };
}

/**
 * ユーザーの全大会メモサマリー取得（メモがある大会ID一覧 + カウント）
 */
export function getUserMemoSummary(userId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT event_id,
      COUNT(*) as memo_count,
      MAX(updated_at) as last_updated
    FROM event_memos
    WHERE user_id = ? AND memo_text != ''
    GROUP BY event_id
    ORDER BY last_updated DESC
  `).all(userId);

  return rows;
}

/**
 * 複数大会のメモカウントをまとめて取得（recap用）
 */
export function getUserMemoCountsForEvents(userId, eventIds) {
  if (!eventIds || eventIds.length === 0) return {};
  const db = getDb();
  const placeholders = eventIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT event_id, COUNT(*) as memo_count
    FROM event_memos
    WHERE user_id = ? AND event_id IN (${placeholders}) AND memo_text != ''
    GROUP BY event_id
  `).all(userId, ...eventIds);

  const counts = {};
  for (const row of rows) {
    counts[row.event_id] = row.memo_count;
  }
  return counts;
}
