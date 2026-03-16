/**
 * 大会詳細ページ用データ取得サービス
 *
 * 既存の events / event_races テーブルと
 * 新規の marathon_details テーブルを統合し、
 * ページが必要とするすべての情報を1つのオブジェクトで返す。
 *
 * ページ側はこの関数の戻り値だけで描画する。
 */

import { getDb } from "@/lib/db";
import { getDisplayEntryStatus } from "@/lib/entry-status";
import { getEntryHistorySummary } from "@/lib/entry-history";
import { getEntryUrgencyMeta } from "@/lib/entry-urgency";
import { getFreshnessInfo } from "@/lib/freshness";

// ─── JSON安全パース ──────────────────────────

function safeParseJson(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ─── メインAPI ───────────────────────────────

/**
 * 大会詳細ページに必要な全情報を取得する
 *
 * @param {number|string} id - 大会ID
 * @returns {object|null} - 統合された大会情報、見つからなければ null
 */
export function getMarathonDetailPageData(id) {
  const db = getDb();

  // 基本情報
  const event = db
    .prepare("SELECT * FROM events WHERE id = ? AND is_active = 1")
    .get(id);
  if (!event) return null;

  // レース情報
  const races = db
    .prepare(
      "SELECT * FROM event_races WHERE event_id = ? ORDER BY sort_order, distance_km DESC"
    )
    .all(id);

  // 詳細情報（存在しない場合もある）
  const detail = db
    .prepare("SELECT * FROM marathon_details WHERE marathon_id = ?")
    .get(id);

  // レビュー取得（Phase55）
  let reviews = [];
  try {
    reviews = db
      .prepare("SELECT * FROM event_reviews WHERE event_id = ? ORDER BY created_at DESC LIMIT 20")
      .all(id);
  } catch {}

  // 締切履歴・緊急度
  let historySummary = null;
  let urgencyMeta = null;
  try {
    historySummary = getEntryHistorySummary(id);
    urgencyMeta = getEntryUrgencyMeta(event, historySummary);
  } catch {}

  // 統合オブジェクトを構築
  return buildPageData(event, races, detail, historySummary, urgencyMeta, reviews);
}

// ─── データ統合 ──────────────────────────────

function buildPageData(event, races, detail, historySummary, urgencyMeta, reviews) {
  const d = detail || {};

  return {
    // === 基本情報（eventsテーブル由来） ===
    id: event.id,
    title: event.title,
    event_date: event.event_date,
    event_month: event.event_month,
    prefecture: event.prefecture,
    city: event.city,
    venue_name: d.venue_name || event.venue_name,
    entry_status_raw: event.entry_status,
    entry_start_date: d.application_start_at || event.entry_start_date,
    entry_end_date: d.application_end_at || event.entry_end_date,
    // 表示用ステータス（日付ロジックで再計算）
    ...(() => {
      const ds = getDisplayEntryStatus({
        entry_status: event.entry_status,
        event_date: event.event_date,
        entry_end_date: d.application_end_at || event.entry_end_date,
        entry_start_date: d.application_start_at || event.entry_start_date,
      });
      return {
        entry_status: ds.status,
        entry_status_label: ds.label,
        entry_status_source: ds.source,
        entry_status_reason: ds.reason,
      };
    })(),
    source_url: event.source_url,
    official_url: d.official_url || event.official_url,
    description: event.description,
    hero_image_url: event.hero_image_url,
    scraped_at: event.scraped_at,
    source_site: event.source_site,
    sport_type: event.sport_type,
    latitude: event.latitude || null,
    longitude: event.longitude || null,

    // === 公式エントリー状況（Phase72/79） ===
    official_entry_status: event.official_entry_status || null,
    official_entry_status_label: event.official_entry_status_label || null,
    official_checked_at: event.official_checked_at || null,
    official_deadline_text: event.official_deadline_text || null,
    official_capacity_text: event.official_capacity_text || null,
    official_status_source_url: event.official_status_source_url || null,
    official_status_confidence: event.official_status_confidence || null,
    official_status_note: event.official_status_note || null,
    official_status_source_type: event.official_status_source_type || null,
    official_unknown_reason: event.official_unknown_reason || null,

    // === レース ===
    races,

    // === 詳細情報（marathon_details由来） ===
    hasDetail: !!detail,

    // Hero / キャッチ
    tagline: d.tagline || null,
    summary: d.summary || null,

    // 会場 / アクセス
    venue_address: d.venue_address || null,
    access_info: d.access_info || null,
    map_url: d.map_url || null,

    // エントリー
    registration_start_time: d.registration_start_time || null,
    entry_url: d.entry_url || null,
    cancellation_policy: d.cancellation_policy || null,

    // 支払い / 申込
    payment_methods: safeParseJson(d.payment_methods_json, []),
    agent_entry_allowed: d.agent_entry_allowed ?? null,

    // 規模 / レベル / 特徴
    event_scale_label: d.event_scale_label || null,
    level_labels: safeParseJson(d.level_labels_json, []),
    features: safeParseJson(d.features_json, []),
    sports_category: d.sports_category || null,
    event_type_label: d.event_type_label || null,
    measurement_method: d.measurement_method || null,

    // 注意事項
    notes: d.notes || null,
    cancellation_policy: d.cancellation_policy || null,

    // 構造化データ（JSON）
    faq: safeParseJson(d.faq_json, []),
    schedule: safeParseJson(d.schedule_json, []),
    pricing: safeParseJson(d.pricing_json, []),
    time_limits: safeParseJson(d.time_limits_json, []),
    distances: safeParseJson(d.distances_json, []),
    services: safeParseJson(d.services_json, []),

    // 駐車場
    parking_info: d.parking_info || null,

    // 主催者
    organizer: buildOrganizer(d),

    // コース情報
    course_info: d.course_info || null,

    // === Phase55: 詳細ページ情報拡充 ===
    reviews: reviews || [],
    registration_requirements_text: d.registration_requirements_text || null,
    health_management_text: d.health_management_text || null,
    terms_text: d.terms_text || null,
    pledge_text: d.pledge_text || null,
    refund_policy_text: d.refund_policy_text || null,
    reception_place: d.reception_place || null,
    reception_time_text: d.reception_time_text || null,
    transit_text: d.transit_text || null,
    race_method_text: d.race_method_text || null,
    cutoff_text: d.cutoff_text || null,
    timetable_text: d.timetable_text || null,

    // 系列大会
    series_events: safeParseJson(d.series_events_json, []),

    // === 締切傾向・緊急度（Phase36） ===
    urgency: urgencyMeta
      ? {
          label: urgencyMeta.urgencyLabel,
          level: urgencyMeta.urgencyLevel,
          reasonText: urgencyMeta.reasonText,
          confidence: urgencyMeta.confidence,
          signals: urgencyMeta.signals,
          historicalDaysToClose: urgencyMeta.historicalDaysToClose,
          daysBeforeEventClosed: urgencyMeta.daysBeforeEventClosed,
          labelDef: urgencyMeta.labelDef,
        }
      : null,
    entryHistory: historySummary?.hasHistory
      ? {
          totalRecords: historySummary.totalRecords,
          daysOpenToClose: historySummary.daysOpenToClose,
          daysBeforeEventClosed: historySummary.daysBeforeEventClosed,
          closeReason: historySummary.closeReason,
          isCapacityBased: historySummary.isCapacityBased,
          allSignals: historySummary.allSignals,
        }
      : null,

    // === データ鮮度（Phase37） ===
    freshness: getFreshnessInfo({
      lastVerifiedAt: event.last_verified_at,
      scrapedAt: event.scraped_at,
    }),

    // === 相互検証（Phase39） ===
    verification_conflict: event.verification_conflict || 0,
    verification_conflict_level: event.verification_conflict_level || 0,
    verification_conflict_summary: event.verification_conflict_summary || null,
    verification_status: event.verification_status || "unverified",
  };
}

function buildOrganizer(d) {
  if (!d.organizer_name) return null;
  return {
    name: d.organizer_name,
    contact_name: d.organizer_contact_name || null,
    email: d.organizer_email || null,
    phone: d.organizer_phone || null,
    description: d.organizer_description || null,
    review_score: d.organizer_review_score || null,
    review_count: d.organizer_review_count || null,
  };
}
