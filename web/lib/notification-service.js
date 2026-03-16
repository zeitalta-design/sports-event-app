/**
 * 通知候補生成サービス
 * - 締切通知 (deadline_7d / deadline_3d / deadline_today)
 * - 保存検索一致通知 (saved_search_match)
 * - お気に入り締切通知 (favorite_deadline_7d / favorite_deadline_3d / favorite_deadline_today)
 */

import { getDb } from "./db";
import { getEventDetailPath } from "./sport-config";

/**
 * notifications テーブルに補助カラム・インデックスを追加（冪等）
 */
function ensureSchema(db) {
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN event_id INTEGER");
  } catch {
    // カラム既存時は無視
  }
  try {
    db.exec("ALTER TABLE notifications ADD COLUMN related_search_id INTEGER");
  } catch {
    // カラム既存時は無視
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(user_key, type, event_id)"
  );
}

/**
 * 日付文字列から N日後の日付文字列を返す
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} days
 * @returns {string} "YYYY-MM-DD"
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A. 締切通知を生成（全アクティブユーザーに対して個別生成）
 * @param {object} params
 * @param {string} params.today - "YYYY-MM-DD"
 * @param {object} params.db - Database instance
 * @returns {object[]} notification候補配列
 */
export function buildDeadlineNotifications({ today, db }) {
  const deadlineDefs = [
    { type: "deadline_today", days: 0, titlePrefix: "本日締切", bodyTemplate: (t, d) => `本日がエントリー締切です。` },
    { type: "deadline_3d", days: 3, titlePrefix: "締切間近", bodyTemplate: (t, d) => `エントリー締切は ${d} です。あと3日で締切です。` },
    { type: "deadline_7d", days: 7, titlePrefix: "締切間近", bodyTemplate: (t, d) => `エントリー締切は ${d} です。あと7日で締切です。` },
  ];

  // 全アクティブユーザーを取得
  const users = db.prepare("SELECT id FROM users WHERE is_active = 1").all();
  if (users.length === 0) return [];

  const notifications = [];

  for (const def of deadlineDefs) {
    const targetDate = addDays(today, def.days);
    const events = db
      .prepare(
        `SELECT id, title, entry_end_date, sport_type FROM events
         WHERE is_active = 1 AND entry_end_date = ?`
      )
      .all(targetDate);

    for (const ev of events) {
      for (const user of users) {
        notifications.push({
          user_key: String(user.id),
          type: def.type,
          title: `${def.titlePrefix}: ${ev.title}`,
          body: def.bodyTemplate(ev.title, ev.entry_end_date),
          payload_json: JSON.stringify({
            event_id: ev.id,
            deadline_date: ev.entry_end_date,
          }),
          event_id: ev.id,
          related_search_id: null,
          link_url: getEventDetailPath(ev),
        });
      }
    }
  }

  return notifications;
}

/**
 * B. 保存検索一致通知を生成
 * @param {object} params
 * @param {string} params.today - "YYYY-MM-DD"
 * @param {object} params.db - Database instance
 * @returns {object[]} notification候補配列
 */
export function buildSavedSearchNotifications({ today, db }) {
  const searches = db.prepare("SELECT * FROM saved_searches").all();
  if (searches.length === 0) return [];

  const notifications = [];

  for (const search of searches) {
    const where = ["e.is_active = 1"];
    const params = [];
    const condParts = [];
    let joins = "";

    if (search.sport_type) {
      where.push("e.sport_type = ?");
      params.push(search.sport_type);
      condParts.push(search.sport_type === "marathon" ? "マラソン" : search.sport_type);
    }
    if (search.prefecture) {
      where.push("e.prefecture = ?");
      params.push(search.prefecture);
      condParts.push(search.prefecture);
    }
    if (search.keyword) {
      where.push("(e.title LIKE ? OR e.normalized_title LIKE ?)");
      const kw = `%${search.keyword}%`;
      params.push(kw, kw);
      condParts.push(`「${search.keyword}」`);
    }
    if (search.event_month) {
      where.push("e.event_month = ?");
      params.push(search.event_month);
      condParts.push(`${search.event_month}月`);
    }

    // filters_json の distance 対応
    if (search.filters_json) {
      try {
        const filters = JSON.parse(search.filters_json);
        if (filters.distance) {
          const ranges = {
            "5": [0, 5],
            "10": [5.1, 10],
            half: [20, 22],
            full: [42, 43],
            ultra: [43.1, 999],
          };
          const range = ranges[filters.distance];
          if (range) {
            joins = "JOIN event_races er ON er.event_id = e.id";
            where.push("er.distance_km >= ? AND er.distance_km <= ?");
            params.push(range[0], range[1]);
            const distLabels = { "5": "5km", "10": "10km", half: "ハーフ", full: "フル", ultra: "ウルトラ" };
            condParts.push(distLabels[filters.distance] || filters.distance);
          }
        }
      } catch {
        // invalid JSON, skip
      }
    }

    const condStr = condParts.join(" / ") || "全件";

    const events = db
      .prepare(
        `SELECT DISTINCT e.id, e.title, e.sport_type FROM events e ${joins} WHERE ${where.join(" AND ")} LIMIT 50`
      )
      .all(...params);

    for (const ev of events) {
      notifications.push({
        user_key: search.user_key,
        type: "saved_search_match",
        title: `保存条件に一致する大会: ${ev.title}`,
        body: `「${condStr}」の条件に一致する大会が見つかりました。`,
        payload_json: JSON.stringify({
          event_id: ev.id,
          search_id: search.id,
        }),
        event_id: ev.id,
        related_search_id: search.id,
        link_url: `/marathon/${ev.id}`,
      });
    }
  }

  return notifications;
}

/**
 * C. お気に入り大会の締切通知を生成
 * @param {object} params
 * @param {string} params.today - "YYYY-MM-DD"
 * @param {object} params.db - Database instance
 * @returns {object[]} notification候補配列
 */
export function buildFavoriteDeadlineNotifications({ today, db }) {
  const defs = [
    { type: "favorite_deadline_today", days: 0, titlePrefix: "お気に入り大会が本日締切", bodyTemplate: (title, date) => `お気に入り登録している「${title}」のエントリーが本日締切です。お見逃しなく！` },
    { type: "favorite_deadline_3d", days: 3, titlePrefix: "お気に入り大会が締切間近", bodyTemplate: (title, date) => `お気に入り登録している「${title}」のエントリー締切は ${date} です。あと3日で締切です。エントリーを確認してください。` },
    { type: "favorite_deadline_7d", days: 7, titlePrefix: "お気に入り大会が締切間近", bodyTemplate: (title, date) => `お気に入り登録している「${title}」のエントリー締切は ${date} です。あと7日で締切です。` },
  ];

  const notifications = [];

  for (const def of defs) {
    const targetDate = addDays(today, def.days);
    const rows = db
      .prepare(
        `SELECT f.user_key, e.id, e.title, e.entry_end_date, e.sport_type
         FROM favorites f
         JOIN events e ON e.id = f.event_id
         WHERE e.is_active = 1 AND e.entry_end_date = ?`
      )
      .all(targetDate);

    for (const row of rows) {
      notifications.push({
        user_key: row.user_key,
        type: def.type,
        title: `${def.titlePrefix}: ${row.title}`,
        body: def.bodyTemplate(row.title, row.entry_end_date),
        payload_json: JSON.stringify({
          event_id: row.id,
          source: "favorite",
          deadline_date: row.entry_end_date,
          days_left: def.days,
        }),
        event_id: row.id,
        related_search_id: null,
        link_url: getEventDetailPath(row),
      });
    }
  }

  return notifications;
}

/**
 * 通知候補をDBに挿入（重複はINSERT OR IGNOREで無視）
 * @param {object} db - Database instance
 * @param {object[]} notifications
 * @returns {number} 挿入件数
 */
export function insertNotifications(db, notifications) {
  if (notifications.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO notifications
    (user_key, type, title, body, payload_json, event_id, related_search_id, link_url, created_at)
    VALUES (@user_key, @type, @title, @body, @payload_json, @event_id, @related_search_id, @link_url, datetime('now'))
  `);

  let inserted = 0;
  const doInsert = db.transaction(() => {
    for (const n of notifications) {
      const result = stmt.run(n);
      if (result.changes > 0) inserted++;
    }
  });
  doInsert();

  return inserted;
}

/**
 * user_key ごとの通知設定を取得
 * 設定がなければ全ON扱い
 */
function getSettingsMap(db) {
  // notification_settings テーブルの存在確認
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_settings'"
  ).get();
  if (!tableExists) return {};

  const rows = db.prepare("SELECT * FROM notification_settings").all();
  const map = {};
  for (const row of rows) {
    map[row.user_key] = row;
  }
  return map;
}

/**
 * 通知種別が設定で有効かチェック
 */
function isTypeEnabled(settingsMap, userKey, type) {
  const settings = settingsMap[userKey];
  if (!settings) return true; // 設定なし = 全ON
  const colName = `enable_${type}`;
  if (settings[colName] === undefined) return true;
  return !!settings[colName];
}

/**
 * 全種類の通知候補を生成・挿入
 * @param {object} params
 * @param {string} params.today - "YYYY-MM-DD"
 * @returns {object} 結果サマリー
 */
export function generateAllNotifications({ today }) {
  const db = getDb();
  ensureSchema(db);

  const settingsMap = getSettingsMap(db);

  const deadlines = buildDeadlineNotifications({ today, db });
  const matches = buildSavedSearchNotifications({ today, db });
  const favorites = buildFavoriteDeadlineNotifications({ today, db });

  // 設定でOFFの通知をフィルタ
  const all = [...deadlines, ...matches, ...favorites].filter((n) =>
    isTypeEnabled(settingsMap, n.user_key, n.type)
  );

  const inserted = insertNotifications(db, all);

  // 種別ごとの内訳
  const breakdown = {};
  for (const n of all) {
    breakdown[n.type] = (breakdown[n.type] || 0) + 1;
  }

  // 対象ユーザー数
  const userKeys = new Set(all.map((n) => n.user_key));

  return {
    deadlines: deadlines.length,
    matches: matches.length,
    favorites: favorites.length,
    total: all.length,
    inserted,
    skipped: all.length - inserted,
    breakdown,
    userCount: userKeys.size,
  };
}
