import { getDb } from "@/lib/db";

/**
 * Phase212: 結果品質管理サービス
 *
 * 異常タイム・順位欠損・ゼッケン欠損・カテゴリ欠損・年度ずれの検知
 */

const TIME_LIMITS = {
  marathon: { min: "1:30:00", max: "10:00:00" },
  trail: { min: "0:30:00", max: "48:00:00" },
  default: { min: "0:10:00", max: "24:00:00" },
};

function timeToSeconds(t) {
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/**
 * 結果レコードの品質フラグを検出
 */
export function checkResultQuality(result, sportType = "default") {
  const flags = [];
  const limits = TIME_LIMITS[sportType] || TIME_LIMITS.default;

  // 異常タイムチェック
  if (result.finish_time) {
    const sec = timeToSeconds(result.finish_time);
    const minSec = timeToSeconds(limits.min);
    const maxSec = timeToSeconds(limits.max);
    if (sec !== null) {
      if (sec < minSec) flags.push({ type: "time_too_fast", label: "タイム異常（速すぎ）", detail: result.finish_time });
      if (sec > maxSec) flags.push({ type: "time_too_slow", label: "タイム異常（遅すぎ）", detail: result.finish_time });
    }
  }

  // ゼッケン欠損
  if (!result.bib_number || result.bib_number.trim() === "") {
    flags.push({ type: "no_bib", label: "ゼッケンなし" });
  }

  // 順位欠損
  if (!result.overall_rank && result.finish_status === "finished") {
    flags.push({ type: "no_rank", label: "順位なし（完走）" });
  }

  // カテゴリ欠損
  if (!result.category_name || result.category_name.trim() === "") {
    flags.push({ type: "no_category", label: "カテゴリなし" });
  }

  // 性別欠損
  if (!result.gender || result.gender.trim() === "") {
    flags.push({ type: "no_gender", label: "性別なし" });
  }

  return flags;
}

/**
 * イベントの結果データ品質を一括チェック
 */
export function checkEventResultsQuality(eventId) {
  const db = getDb();
  const results = db.prepare(`
    SELECT er.*, e.sport_type, e.event_date, e.title as event_title
    FROM event_results er
    LEFT JOIN events e ON er.event_id = e.id
    WHERE er.event_id = ?
  `).all(eventId);

  if (results.length === 0) return { eventId, issues: [], summary: {} };

  const event = results[0];
  const sportType = event.sport_type || "default";
  const issues = [];

  // 年度ずれチェック
  if (event.event_date && results[0]?.result_year) {
    const eventYear = parseInt(event.event_date.slice(0, 4));
    const resultYear = parseInt(results[0].result_year);
    if (Math.abs(eventYear - resultYear) > 1) {
      issues.push({ type: "year_mismatch", label: "年度ずれ疑い", detail: `大会: ${eventYear}年 / 結果: ${resultYear}年` });
    }
  }

  // 個別レコードチェック
  let noBib = 0, noRank = 0, noCategory = 0, noGender = 0, abnormalTime = 0;
  for (const r of results) {
    const flags = checkResultQuality(r, sportType);
    for (const f of flags) {
      if (f.type === "no_bib") noBib++;
      else if (f.type === "no_rank") noRank++;
      else if (f.type === "no_category") noCategory++;
      else if (f.type === "no_gender") noGender++;
      else if (f.type.startsWith("time_")) abnormalTime++;
    }
  }

  // 順位の連番チェック
  const ranks = results.filter((r) => r.overall_rank).map((r) => r.overall_rank).sort((a, b) => a - b);
  let gapCount = 0;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] - ranks[i - 1] > 1) gapCount++;
  }
  if (gapCount > 0) {
    issues.push({ type: "rank_gaps", label: "順位に飛びあり", detail: `${gapCount}箇所` });
  }

  return {
    eventId,
    eventTitle: event.event_title,
    totalResults: results.length,
    issues,
    summary: { noBib, noRank, noCategory, noGender, abnormalTime, rankGaps: gapCount },
  };
}

/**
 * 要確認結果のあるイベント一覧
 */
export function getResultQualityOverview({ limit = 50, offset = 0 } = {}) {
  const db = getDb();

  const eventIds = db.prepare(`
    SELECT DISTINCT event_id FROM event_results ORDER BY event_id
  `).all().map((r) => r.event_id);

  const flagged = [];
  for (const eid of eventIds) {
    const qr = checkEventResultsQuality(eid);
    const totalIssues = Object.values(qr.summary).reduce((a, b) => a + b, 0) + qr.issues.length;
    if (totalIssues > 0) {
      flagged.push({ ...qr, totalIssueCount: totalIssues });
    }
  }

  flagged.sort((a, b) => b.totalIssueCount - a.totalIssueCount);

  return {
    total: flagged.length,
    items: flagged.slice(offset, offset + limit),
  };
}

/**
 * 結果品質サマリ
 */
export function getResultQualityStats() {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM event_results`).get()?.cnt || 0;
  const noBib = db.prepare(`SELECT COUNT(*) as cnt FROM event_results WHERE bib_number IS NULL OR bib_number = ''`).get()?.cnt || 0;
  const noRank = db.prepare(`SELECT COUNT(*) as cnt FROM event_results WHERE overall_rank IS NULL AND (finish_status = 'finished' OR finish_status IS NULL)`).get()?.cnt || 0;
  const noTime = db.prepare(`SELECT COUNT(*) as cnt FROM event_results WHERE finish_time IS NULL OR finish_time = ''`).get()?.cnt || 0;
  const noCategory = db.prepare(`SELECT COUNT(*) as cnt FROM event_results WHERE category_name IS NULL OR category_name = ''`).get()?.cnt || 0;
  const eventCount = db.prepare(`SELECT COUNT(DISTINCT event_id) as cnt FROM event_results`).get()?.cnt || 0;

  return { total, noBib, noRank, noTime, noCategory, eventCount };
}
