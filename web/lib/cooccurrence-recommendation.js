/**
 * 共起推薦サービス
 *
 * 閲覧ログ（marathon_view_events）に基づき、
 * 「この大会を見た人は、こんな大会も見ています」を算出する。
 *
 * 推薦ロジック:
 *   A を見た後に B を見た回数（referrer_marathon_id = A → marathon_id = B）の多い順。
 *   同一セッション内での遷移に限定し、直近90日のログを対象とする。
 */

import { getDb } from "@/lib/db";

// ─── 定数 ──────────────────────────────────────

const DEFAULT_LIMIT = 6;
const DEFAULT_DAYS = 90;
const MIN_COOCCURRENCE = 1; // 最低共起回数

// ─── メインAPI ──────────────────────────────────

/**
 * 共起推薦大会を取得する
 *
 * @param {number} marathonId - 基準大会ID
 * @param {object} [options={}]
 * @param {number} [options.limit=6] - 取得件数
 * @param {number} [options.days=90] - 集計対象日数
 * @returns {{ cooccurrences: Array<object>, totalCount: number }}
 *
 * cooccurrences の各要素:
 *   { id, title, event_date, event_month, prefecture, city,
 *     venue_name, entry_status, source_url, distance_labels,
 *     view_count, recommendation_source: "cooccurrence" }
 */
export function getCooccurrenceMarathons(marathonId, options = {}) {
  const { limit = DEFAULT_LIMIT, days = DEFAULT_DAYS } = options;

  const db = getDb();

  // テーブルが存在しない場合のフォールバック
  try {
    db.prepare(
      "SELECT 1 FROM marathon_view_events LIMIT 1"
    ).get();
  } catch {
    return { cooccurrences: [], totalCount: 0 };
  }

  // ── 共起カウント取得 ──
  // A（marathonId）を見た後に B を見た回数 + B を見た後に A を見た回数
  // 双方向で集計して精度を高める
  const rows = db
    .prepare(
      `SELECT marathon_id AS target_id, COUNT(*) AS cnt
       FROM marathon_view_events
       WHERE referrer_marathon_id = ?
         AND marathon_id != ?
         AND viewed_at > datetime('now', ?)
       GROUP BY marathon_id

       UNION ALL

       SELECT referrer_marathon_id AS target_id, COUNT(*) AS cnt
       FROM marathon_view_events
       WHERE marathon_id = ?
         AND referrer_marathon_id IS NOT NULL
         AND referrer_marathon_id != ?
         AND viewed_at > datetime('now', ?)
       GROUP BY referrer_marathon_id`
    )
    .all(
      marathonId, marathonId, `-${days} days`,
      marathonId, marathonId, `-${days} days`
    );

  // target_id ごとにカウントを合算
  const countMap = new Map();
  for (const row of rows) {
    const current = countMap.get(row.target_id) || 0;
    countMap.set(row.target_id, current + row.cnt);
  }

  // 最低共起回数でフィルタ → カウント降順ソート
  const sorted = [...countMap.entries()]
    .filter(([, cnt]) => cnt >= MIN_COOCCURRENCE)
    .sort((a, b) => b[1] - a[1]);

  const totalCount = sorted.length;

  if (sorted.length === 0) {
    return { cooccurrences: [], totalCount: 0 };
  }

  // 上位N件のIDを取得
  const topEntries = sorted.slice(0, limit);
  const targetIds = topEntries.map(([id]) => id);
  const viewCountMap = new Map(topEntries);

  // ── 大会情報を取得 ──
  const placeholders = targetIds.map(() => "?").join(",");
  const events = db
    .prepare(
      `SELECT id, title, event_date, event_month, prefecture, city,
              venue_name, entry_status, source_url
       FROM events
       WHERE id IN (${placeholders}) AND is_active = 1`
    )
    .all(...targetIds);

  if (events.length === 0) {
    return { cooccurrences: [], totalCount };
  }

  // ── 距離情報を取得 ──
  const eventIds = events.map((e) => e.id);
  const racePh = eventIds.map(() => "?").join(",");
  const raceRows = db
    .prepare(
      `SELECT event_id, distance_km FROM event_races
       WHERE event_id IN (${racePh}) AND distance_km IS NOT NULL`
    )
    .all(...eventIds);

  const raceMap = new Map();
  for (const row of raceRows) {
    if (!raceMap.has(row.event_id)) raceMap.set(row.event_id, []);
    raceMap.get(row.event_id).push(row.distance_km);
  }

  // ── 結果整形（共起回数の降順を維持）──
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const cooccurrences = targetIds
    .map((id) => {
      const ev = eventMap.get(id);
      if (!ev) return null;

      const distances = raceMap.get(id) || [];
      const distanceLabels = distances
        .map((km) => getDistanceLabel(km))
        .filter(Boolean);

      return {
        id: ev.id,
        title: ev.title,
        event_date: ev.event_date,
        event_month: ev.event_month,
        prefecture: ev.prefecture,
        city: ev.city,
        venue_name: ev.venue_name,
        entry_status: ev.entry_status,
        source_url: ev.source_url,
        distance_labels: [...new Set(distanceLabels)],
        view_count: viewCountMap.get(id) || 0,
        recommendation_source: "cooccurrence",
      };
    })
    .filter(Boolean);

  return { cooccurrences, totalCount };
}

// ─── ヘルパー ──────────────────────────────────

function getDistanceLabel(km) {
  if (!km || km <= 0) return null;
  if (km >= 42 && km <= 43) return "フル";
  if (km >= 20 && km <= 22) return "ハーフ";
  if (km > 5 && km <= 10) return "10km";
  if (km > 0 && km <= 5) return "5km";
  if (km > 43) return "ウルトラ";
  return null;
}
