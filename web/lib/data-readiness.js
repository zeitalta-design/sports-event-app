import { getDb } from "@/lib/db";

/**
 * Phase230: データ充実度チェック
 *
 * 公開に必要な最低限のデータが揃っているかを確認し、
 * 各セクションの表示可否を判定する。
 */

/** 最低基準 */
const THRESHOLDS = {
  MIN_EVENTS: 20,           // 空サイトに見えない最低ライン
  MIN_POPULAR_EVENTS: 5,    // 人気大会セクション表示
  MIN_DEADLINE_EVENTS: 3,   // 締切セクション表示
  MIN_PREFECTURES: 10,      // 地域検索の意味がある最低ライン
  MIN_PHOTOS: 3,            // 写真ギャラリーが成立するライン
  MIN_REVIEWS: 3,           // 口コミが成立するライン
  MIN_RESULTS: 3,           // 結果が成立するライン
};

/**
 * データ充実度レポートを取得
 */
export function getDataReadinessReport() {
  try {
    const db = getDb();

    const totalEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1").get().cnt;
    const futureEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND event_date >= date('now')").get().cnt;
    const marathonEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND sport_type = 'marathon'").get().cnt;
    const trailEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND sport_type = 'trail'").get().cnt;

    const prefectures = db.prepare("SELECT COUNT(DISTINCT prefecture) as cnt FROM events WHERE is_active = 1 AND prefecture IS NOT NULL AND prefecture != ''").get().cnt;

    const openEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND entry_status = 'open'").get().cnt;
    const deadlineEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND entry_end_date IS NOT NULL AND entry_end_date >= date('now') AND entry_status = 'open'").get().cnt;

    let photosCount = 0;
    let reviewsCount = 0;
    let resultsCount = 0;
    let eventsWithPhotos = 0;
    let eventsWithReviews = 0;
    let eventsWithResults = 0;

    try {
      photosCount = db.prepare("SELECT COUNT(*) as cnt FROM event_photos").get().cnt;
      eventsWithPhotos = db.prepare("SELECT COUNT(DISTINCT event_id) as cnt FROM event_photos").get().cnt;
    } catch {}

    try {
      reviewsCount = db.prepare("SELECT COUNT(*) as cnt FROM reviews").get().cnt;
      eventsWithReviews = db.prepare("SELECT COUNT(DISTINCT event_id) as cnt FROM reviews").get().cnt;
    } catch {}

    try {
      resultsCount = db.prepare("SELECT COUNT(*) as cnt FROM event_results").get().cnt;
      eventsWithResults = db.prepare("SELECT COUNT(DISTINCT event_id) as cnt FROM event_results").get().cnt;
    } catch {}

    const items = [
      {
        label: "アクティブイベント",
        value: totalEvents,
        threshold: THRESHOLDS.MIN_EVENTS,
        status: totalEvents >= THRESHOLDS.MIN_EVENTS ? "ok" : "need",
      },
      {
        label: "今後開催予定",
        value: futureEvents,
        threshold: 10,
        status: futureEvents >= 10 ? "ok" : "need",
      },
      {
        label: "受付中イベント",
        value: openEvents,
        threshold: 5,
        status: openEvents >= 5 ? "ok" : "need",
      },
      {
        label: "締切間近イベント",
        value: deadlineEvents,
        threshold: THRESHOLDS.MIN_DEADLINE_EVENTS,
        status: deadlineEvents >= THRESHOLDS.MIN_DEADLINE_EVENTS ? "ok" : "need",
      },
      {
        label: "都道府県カバー",
        value: `${prefectures}/47`,
        threshold: THRESHOLDS.MIN_PREFECTURES,
        status: prefectures >= THRESHOLDS.MIN_PREFECTURES ? "ok" : "need",
      },
      {
        label: "マラソン大会",
        value: marathonEvents,
        threshold: 15,
        status: marathonEvents >= 15 ? "ok" : "need",
      },
      {
        label: "トレイル大会",
        value: trailEvents,
        threshold: 5,
        status: trailEvents >= 5 ? "ok" : "need",
      },
      {
        label: "写真付き大会",
        value: eventsWithPhotos,
        threshold: THRESHOLDS.MIN_PHOTOS,
        status: eventsWithPhotos >= THRESHOLDS.MIN_PHOTOS ? "ok" : "need",
        detail: `写真${photosCount}枚`,
      },
      {
        label: "口コミ付き大会",
        value: eventsWithReviews,
        threshold: THRESHOLDS.MIN_REVIEWS,
        status: eventsWithReviews >= THRESHOLDS.MIN_REVIEWS ? "ok" : "need",
        detail: `口コミ${reviewsCount}件`,
      },
      {
        label: "結果付き大会",
        value: eventsWithResults,
        threshold: THRESHOLDS.MIN_RESULTS,
        status: eventsWithResults >= THRESHOLDS.MIN_RESULTS ? "ok" : "need",
        detail: `結果${resultsCount}件`,
      },
    ];

    const okCount = items.filter((i) => i.status === "ok").length;
    const needCount = items.filter((i) => i.status === "need").length;

    return {
      items,
      summary: {
        ok: okCount,
        need: needCount,
        total: items.length,
        readyPercent: Math.round((okCount / items.length) * 100),
        isReady: needCount === 0,
      },
    };
  } catch (err) {
    return {
      items: [],
      summary: { ok: 0, need: 0, total: 0, readyPercent: 0, isReady: false },
      error: err.message,
    };
  }
}

/**
 * トップページ各セクションの表示フォールバックロジック
 * データが少ない場合の代替表示を判定
 */
export function getTopPageSectionVisibility() {
  try {
    const db = getDb();

    const totalEvents = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1").get().cnt;
    const deadlineCount = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE is_active = 1 AND entry_end_date IS NOT NULL AND entry_end_date >= date('now') AND entry_status = 'open'").get().cnt;

    return {
      showDeadlineSection: deadlineCount >= 2,
      showPopularSection: totalEvents >= 5,
      showNewEventsSection: totalEvents >= 3,
      showCalendarSection: totalEvents >= 10,
      showFeatureNavigation: totalEvents >= 20,
      totalEvents,
    };
  } catch {
    return {
      showDeadlineSection: false,
      showPopularSection: false,
      showNewEventsSection: false,
      showCalendarSection: false,
      showFeatureNavigation: false,
      totalEvents: 0,
    };
  }
}
