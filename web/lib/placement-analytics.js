import { getDb } from "@/lib/db";

/**
 * 掲載効果分析ライブラリ
 *
 * placement 区分:
 *   standard   — 通常掲載（デフォルト）
 *   featured   — 注目の大会
 *   beginner   — 初心者向け
 *   deadline   — 締切間近
 *   popular    — 人気の大会
 */

export const VALID_PLACEMENTS = ["standard", "featured", "beginner", "deadline", "popular"];

const PLACEMENT_LABELS = {
  standard: "通常掲載",
  featured: "注目の大会",
  beginner: "初心者向け",
  deadline: "締切間近",
  popular: "人気の大会",
};

export function getPlacementLabel(p) {
  return PLACEMENT_LABELS[p] || p;
}

// ─── Placement 管理 ───

/**
 * 大会の掲載区分を設定する（既存のものがあれば終了→新規追加）
 */
export function setEventPlacement(eventId, placement) {
  if (!VALID_PLACEMENTS.includes(placement)) {
    return { ok: false, error: `Invalid placement: ${placement}` };
  }
  try {
    const db = getDb();
    // 同一placementが有効（ended_at IS NULL）なら何もしない
    const existing = db.prepare(
      `SELECT id FROM event_placements WHERE event_id = ? AND placement = ? AND ended_at IS NULL`
    ).get(eventId, placement);
    if (existing) return { ok: true, skipped: true };

    db.prepare(
      `INSERT INTO event_placements (event_id, placement) VALUES (?, ?)`
    ).run(eventId, placement);
    return { ok: true };
  } catch (err) {
    console.error("setEventPlacement error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * 大会の掲載区分を終了する
 */
export function endEventPlacement(eventId, placement) {
  try {
    const db = getDb();
    db.prepare(
      `UPDATE event_placements SET ended_at = datetime('now') WHERE event_id = ? AND placement = ? AND ended_at IS NULL`
    ).run(eventId, placement);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 大会の現在有効な掲載区分を取得
 */
export function getActiveEventPlacements(eventId) {
  try {
    const db = getDb();
    return db.prepare(
      `SELECT placement, started_at FROM event_placements WHERE event_id = ? AND ended_at IS NULL ORDER BY started_at`
    ).all(eventId);
  } catch {
    return [];
  }
}

// ─── Impression 記録 ───

/**
 * 表示回数をバッチ記録（日次UPSERT）
 * フロントから受け取ったイベントID群をまとめて記録
 */
export function recordImpressions(items) {
  // items: [{ eventId, placement }]
  if (!items || items.length === 0) return { ok: true, count: 0 };
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const stmt = db.prepare(
      `INSERT INTO event_impressions (event_id, placement, impression_date, impressions)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(event_id, placement, impression_date)
       DO UPDATE SET impressions = impressions + 1`
    );
    const tx = db.transaction((list) => {
      let count = 0;
      for (const { eventId, placement } of list) {
        if (!eventId || !placement) continue;
        stmt.run(eventId, placement, today);
        count++;
      }
      return count;
    });
    const count = tx(items);
    return { ok: true, count };
  } catch (err) {
    console.error("recordImpressions error:", err);
    return { ok: false, error: err.message };
  }
}

// ─── 集計 ───

/**
 * 掲載効果サマリー（Phase 1+2: 全大会の掲載効果一覧）
 *
 * @param {Object} opts
 * @param {number} [opts.days=14] 集計期間（日）
 * @param {number} [opts.limit=50]
 * @param {string} [opts.placement] フィルタ
 * @returns {Array}
 */
export function getPlacementEffectSummary({ days = 14, limit = 50, placement } = {}) {
  try {
    const db = getDb();

    // 現在有効な掲載を持つ大会を取得
    let placementFilter = "";
    const params = [];
    if (placement) {
      placementFilter = "AND ep.placement = ?";
      params.push(placement);
    }

    const rows = db.prepare(`
      SELECT
        ep.event_id,
        e.title,
        ep.placement,
        ep.started_at,
        COALESCE(imp.total_impressions, 0) AS impressions,
        COALESCE(clk.total_clicks, 0) AS clicks,
        CASE WHEN COALESCE(imp.total_impressions, 0) > 0
          THEN ROUND(CAST(COALESCE(clk.total_clicks, 0) AS REAL) / imp.total_impressions * 100, 2)
          ELSE 0
        END AS ctr,
        COALESCE(imp_prev.prev_impressions, 0) AS prev_impressions,
        COALESCE(clk_prev.prev_clicks, 0) AS prev_clicks,
        CASE WHEN COALESCE(imp_prev.prev_impressions, 0) > 0
          THEN ROUND(CAST(COALESCE(clk_prev.prev_clicks, 0) AS REAL) / imp_prev.prev_impressions * 100, 2)
          ELSE 0
        END AS prev_ctr
      FROM event_placements ep
      JOIN events e ON e.id = ep.event_id
      -- 現在期間のインプレッション
      LEFT JOIN (
        SELECT event_id, placement, SUM(impressions) AS total_impressions
        FROM event_impressions
        WHERE impression_date >= date('now', ? || ' days')
        GROUP BY event_id, placement
      ) imp ON imp.event_id = ep.event_id AND imp.placement = ep.placement
      -- 現在期間のクリック
      LEFT JOIN (
        SELECT event_id, placement, COUNT(*) AS total_clicks
        FROM event_activity_logs
        WHERE action_type IN ('entry_click', 'external_link_click', 'cta_click')
          AND placement IS NOT NULL
          AND created_at >= datetime('now', ? || ' days')
        GROUP BY event_id, placement
      ) clk ON clk.event_id = ep.event_id AND clk.placement = ep.placement
      -- 前期間のインプレッション
      LEFT JOIN (
        SELECT event_id, placement, SUM(impressions) AS prev_impressions
        FROM event_impressions
        WHERE impression_date >= date('now', ? || ' days')
          AND impression_date < date('now', ? || ' days')
        GROUP BY event_id, placement
      ) imp_prev ON imp_prev.event_id = ep.event_id AND imp_prev.placement = ep.placement
      -- 前期間のクリック
      LEFT JOIN (
        SELECT event_id, placement, COUNT(*) AS prev_clicks
        FROM event_activity_logs
        WHERE action_type IN ('entry_click', 'external_link_click', 'cta_click')
          AND placement IS NOT NULL
          AND created_at >= datetime('now', ? || ' days')
          AND created_at < datetime('now', ? || ' days')
        GROUP BY event_id, placement
      ) clk_prev ON clk_prev.event_id = ep.event_id AND clk_prev.placement = ep.placement
      WHERE ep.ended_at IS NULL
        ${placementFilter}
      ORDER BY impressions DESC, clicks DESC
      LIMIT ?
    `).all(
      `-${days}`,
      `-${days}`,
      `-${days * 2}`,
      `-${days}`,
      `-${days * 2}`,
      `-${days}`,
      ...params,
      limit
    );

    return rows.map((r) => ({
      eventId: r.event_id,
      title: r.title,
      placement: r.placement,
      placementLabel: getPlacementLabel(r.placement),
      startedAt: r.started_at,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      prevImpressions: r.prev_impressions,
      prevClicks: r.prev_clicks,
      prevCtr: r.prev_ctr,
      impressionChange: calcChange(r.prev_impressions, r.impressions),
      clickChange: calcChange(r.prev_clicks, r.clicks),
      ctrChange: r.prev_ctr > 0 ? Math.round((r.ctr - r.prev_ctr) / r.prev_ctr * 1000) / 10 : null,
    }));
  } catch (err) {
    console.error("getPlacementEffectSummary error:", err);
    return [];
  }
}

/**
 * placement別の平均効果（営業用KPI）
 */
export function getPlacementAverageStats({ days = 14 } = {}) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        ei.placement,
        COUNT(DISTINCT ei.event_id) AS event_count,
        SUM(ei.impressions) AS total_impressions,
        COALESCE(clk.total_clicks, 0) AS total_clicks,
        CASE WHEN SUM(ei.impressions) > 0
          THEN ROUND(CAST(COALESCE(clk.total_clicks, 0) AS REAL) / SUM(ei.impressions) * 100, 2)
          ELSE 0
        END AS avg_ctr
      FROM event_impressions ei
      LEFT JOIN (
        SELECT placement, COUNT(*) AS total_clicks
        FROM event_activity_logs
        WHERE action_type IN ('entry_click', 'external_link_click', 'cta_click')
          AND placement IS NOT NULL
          AND created_at >= datetime('now', ? || ' days')
        GROUP BY placement
      ) clk ON clk.placement = ei.placement
      WHERE ei.impression_date >= date('now', ? || ' days')
      GROUP BY ei.placement
      ORDER BY total_impressions DESC
    `).all(`-${days}`, `-${days}`);

    return rows.map((r) => ({
      placement: r.placement,
      label: getPlacementLabel(r.placement),
      eventCount: r.event_count,
      totalImpressions: r.total_impressions,
      totalClicks: r.total_clicks,
      avgCtr: r.avg_ctr,
    }));
  } catch (err) {
    console.error("getPlacementAverageStats error:", err);
    return [];
  }
}

function calcChange(prev, curr) {
  if (!prev || prev === 0) return curr > 0 ? 100 : 0;
  return Math.round((curr - prev) / prev * 1000) / 10;
}
