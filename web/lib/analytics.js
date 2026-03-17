/**
 * アクセス解析ユーティリティ
 * GA4のMeasurement IDが設定されている場合のみ動作
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

/** GA4にイベントを送信 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === "undefined") return;
  if (!GA_ID) return;
  if (!window.gtag) return;

  window.gtag("event", eventName, params);
}

/** 主要イベント名の定数 */
export const EVENTS = {
  // トップページ
  TOP_SEARCH: "top_search",
  TOP_POPULAR_CHIP: "top_popular_chip",
  TOP_MARATHON_CTA: "top_marathon_cta",

  // 一覧ページ
  EVENT_DETAIL_CLICK: "event_detail_click",
  FILTER_CHANGE: "filter_change",

  // 詳細ページ
  EXTERNAL_RUNNET: "external_runnet_click",
  EXTERNAL_OFFICIAL: "external_official_click",
  EXTERNAL_MOSHICOM: "external_moshicom_click",

  // ユーザーアクション
  FAVORITE_ADD: "favorite_add",
  FAVORITE_REMOVE: "favorite_remove",
  SAVED_SEARCH_ADD: "saved_search_add",

  // SEOページ
  SEO_RELATED_LINK: "seo_related_link_click",

  // 関連大会
  RELATED_MARATHONS_IMPRESSION: "related_marathons_impression",
  RELATED_MARATHON_CLICK: "related_marathon_click",

  // 系列大会
  SERIES_MARATHON_IMPRESSION: "series_marathon_impression",
  SERIES_MARATHON_CLICK: "series_marathon_click",

  // 詳細ページ強化
  MARATHON_ENTRY_CLICK: "marathon_entry_click",
  MARATHON_MAP_CLICK: "marathon_map_click",
  MARATHON_OFFICIAL_CLICK: "marathon_official_click",

  // 主催者・シリーズ導線
  ORGANIZER_LINK_CLICK: "organizer_link_click",
  SERIES_LINK_CLICK: "series_link_click",

  // 比較機能
  COMPARE_ADD: "compare_add",
  COMPARE_REMOVE: "compare_remove",
  COMPARE_VIEW: "compare_view",
  COMPARE_CLEAR: "compare_clear",

  // Phase117: SEO拡張計測
  SEO_PAGE_VIEW: "seo_page_view",           // SEOページ流入（page_type, slug）
  SEO_LIST_DETAIL: "seo_list_detail",         // 一覧→詳細遷移
  SEO_LIST_SAVE: "seo_list_save",             // 一覧→保存
  SEO_LIST_COMPARE: "seo_list_compare",       // 一覧→比較
  SEO_LIST_NOTIFY: "seo_list_notify",         // 一覧→通知
  SEO_INTERNAL_LINK: "seo_internal_link",     // 内部リンククリック
  SEO_CIRCULATION: "seo_circulation",         // 回遊セクションクリック
  SEO_CATEGORY_CLICK: "seo_category_click",   // カテゴリ導線クリック

  // Phase126: マルチスポーツ計測
  SPORT_SWITCH: "sport_switch",               // スポーツ切替（from_sport, to_sport, context）
  SPORT_LIST_VIEW: "sport_list_view",         // スポーツ一覧ページビュー（sport_type）
  SPORT_FILTER_CHANGE: "sport_filter_change", // スポーツフィルタ変更（sport_type, page）
  RANKING_SPORT_FILTER: "ranking_sport_filter", // ランキングのスポーツフィルタ
  CALENDAR_SPORT_FILTER: "calendar_sport_filter", // カレンダーのスポーツフィルタ
};
