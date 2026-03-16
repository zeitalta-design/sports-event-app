/**
 * 通知対象ユーザー抽出サービス
 *
 * 大会の状態変化に対して通知すべきユーザーを特定する。
 * - お気に入り登録ユーザー
 * - 保存検索マッチユーザー
 * - 重複除去・無効ユーザー除外
 */

import { getDb } from "@/lib/db";

// ─── お気に入りユーザー抽出 ─────────────────────────

/**
 * 指定大会をお気に入り登録しているユーザーを取得
 *
 * @param {number} eventId
 * @returns {Array<{ userKey: string, source: string }>}
 */
export function getFavoriteUsersForEvent(eventId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT f.user_key
       FROM favorites f
       JOIN users u ON u.id = CAST(f.user_key AS INTEGER)
       WHERE f.event_id = ? AND u.is_active = 1`
    )
    .all(eventId);

  return rows.map((r) => ({
    userKey: r.user_key,
    source: "favorite",
  }));
}

// ─── 保存検索マッチユーザー抽出 ──────────────────────

/**
 * 指定大会が保存検索条件にマッチするユーザーを取得
 *
 * @param {object} event - { id, sport_type, prefecture, title, normalized_title, event_month }
 * @returns {Array<{ userKey: string, source: string, searchId: number }>}
 */
export function getSavedSearchMatchedUsers(event) {
  const db = getDb();
  const searches = db.prepare("SELECT * FROM saved_searches").all();
  if (searches.length === 0) return [];

  const results = [];

  for (const search of searches) {
    if (!doesEventMatchSearch(event, search, db)) continue;

    // ユーザーが有効か確認
    const user = db
      .prepare("SELECT id, is_active FROM users WHERE id = CAST(? AS INTEGER)")
      .get(search.user_key);
    if (!user || !user.is_active) continue;

    results.push({
      userKey: search.user_key,
      source: "saved_search",
      searchId: search.id,
    });
  }

  return results;
}

/**
 * 大会が保存検索条件にマッチするかチェック
 */
function doesEventMatchSearch(event, search, db) {
  // 条件が1つもなければマッチしない
  let hasCondition = false;

  if (search.sport_type) {
    hasCondition = true;
    if (event.sport_type !== search.sport_type) return false;
  }

  if (search.prefecture) {
    hasCondition = true;
    if (event.prefecture !== search.prefecture) return false;
  }

  if (search.keyword) {
    hasCondition = true;
    const kw = search.keyword.toLowerCase();
    const title = (event.title || "").toLowerCase();
    const norm = (event.normalized_title || "").toLowerCase();
    if (!title.includes(kw) && !norm.includes(kw)) return false;
  }

  if (search.event_month) {
    hasCondition = true;
    if (event.event_month !== search.event_month) return false;
  }

  // filters_json の distance 対応
  if (search.filters_json) {
    try {
      const filters = JSON.parse(search.filters_json);
      if (filters.distance) {
        hasCondition = true;
        const ranges = {
          "5": [0, 5],
          "10": [5.1, 10],
          half: [20, 22],
          full: [42, 43],
          ultra: [43.1, 999],
        };
        const range = ranges[filters.distance];
        if (range) {
          const race = db
            .prepare(
              "SELECT 1 FROM event_races WHERE event_id = ? AND distance_km >= ? AND distance_km <= ? LIMIT 1"
            )
            .get(event.id, range[0], range[1]);
          if (!race) return false;
        }
      }
    } catch {
      // invalid JSON
    }
  }

  return hasCondition;
}

// ─── 統合: 変化に対する通知対象抽出 ──────────────────

/**
 * 大会の状態変化に対する通知対象ユーザーを統合抽出する
 *
 * @param {object} event - events テーブルのレコード
 * @param {object} changeInfo - { changeType }
 * @returns {Array<{ userKey: string, source: string, channel: string, searchId?: number }>}
 */
export function getNotificationTargetsForEventChange(event, changeInfo) {
  const db = getDb();

  // 1. お気に入りユーザー
  const favoriteUsers = getFavoriteUsersForEvent(event.id);

  // 2. 保存検索マッチユーザー
  const searchUsers = getSavedSearchMatchedUsers(event);

  // 3. 重複除去（同一ユーザーはお気に入り優先）
  const userMap = new Map();

  for (const u of favoriteUsers) {
    userMap.set(u.userKey, {
      userKey: u.userKey,
      source: u.source,
      channel: getPreferredChannel(db, u.userKey),
    });
  }

  for (const u of searchUsers) {
    if (!userMap.has(u.userKey)) {
      userMap.set(u.userKey, {
        userKey: u.userKey,
        source: u.source,
        channel: getPreferredChannel(db, u.userKey),
        searchId: u.searchId,
      });
    }
  }

  return Array.from(userMap.values());
}

/**
 * ユーザーの通知チャンネルを決定する
 * 現時点では in_app 固定（将来 email/push 対応可能）
 */
function getPreferredChannel(db, userKey) {
  // 将来: notification_settings からチャンネル設定を取得
  return "in_app";
}
