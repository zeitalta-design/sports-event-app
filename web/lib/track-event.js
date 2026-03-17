/**
 * Phase105: クライアントサイド計測ヘルパー
 *
 * POST /api/events/activity へ送信。
 * 失敗しても画面に影響しない（fire-and-forget）。
 */

export async function trackEvent(actionType, { eventId, sourcePage, metadata } = {}) {
  try {
    await fetch("/api/events/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId || 0,
        action_type: actionType,
        source_page: sourcePage || (typeof window !== "undefined" ? window.location.pathname : null),
        metadata: metadata || null,
      }),
    });
  } catch {
    // 計測失敗は無視
  }
}

/**
 * よく使うアクション名定数
 */
export const TRACK_ACTIONS = {
  SIGNUP_CTA_CLICK: "signup_cta_click",
  LOGIN_CTA_CLICK: "login_cta_click",
  BENEFITS_VIEW: "benefits_view",
  PRICING_VIEW: "pricing_view",
  STATUS_CHANGE: "status_change",
  MEMO_SAVE: "memo_save",
  ALERT_FILTER: "alert_filter",
  ALERT_PIN: "alert_pin",
  ALERT_ACTION_CLICK: "alert_action_click",
  UPGRADE_PROMPT_VIEW: "upgrade_prompt_view",
  UPGRADE_PROMPT_CLICK: "upgrade_prompt_click",
  // Phase175: 結果・振り返り系
  RECAP_VIEW: "recap_view",
  RECAP_WRITE_REVIEW: "recap_write_review",
  RECAP_VIEW_PHOTOS: "recap_view_photos",
  RECAP_FIND_SIMILAR: "recap_find_similar",
  RECAP_MEMO_OPEN: "recap_memo_open",
  RESULTS_LINK: "results_link",
  RESULTS_UNLINK: "results_unlink",
  RESULTS_VIEW_TAB: "results_view_tab",
  PB_VIEW: "pb_view",
  TIMELINE_VIEW: "timeline_view",
  GROWTH_VIEW: "growth_view",
  POST_EVENT_CTA: "post_event_cta",
  HISTORY_RECOMMENDATION: "history_recommendation",
  NEXT_RACE_VIEW: "next_race_view",
  // Phase185: カレンダー系
  CALENDAR_DATE_CLICK: "calendar_date_click",
  CALENDAR_EVENT_CLICK: "calendar_event_click",
  CALENDAR_SAVE_TOGGLE: "calendar_save_toggle",
  CALENDAR_PREV_MONTH: "calendar_prev_month",
  CALENDAR_NEXT_MONTH: "calendar_next_month",
  CALENDAR_GO_TODAY: "calendar_go_today",
  CALENDAR_MONTH_JUMP: "calendar_month_jump",
  CALENDAR_SEASON_JUMP: "calendar_season_jump",
  CALENDAR_SPORT_FILTER: "calendar_sport_filter",
  CALENDAR_STATUS_FILTER: "calendar_status_filter",
  CALENDAR_DISTANCE_FILTER: "calendar_distance_filter",
  CALENDAR_FILTER_RESET: "calendar_filter_reset",
  CALENDAR_TO_MY_EVENTS: "calendar_to_my_events",
  CALENDAR_SEO_LINK: "calendar_seo_link",
  TOP_CALENDAR_EVENT: "top_calendar_event",
  TOP_CALENDAR_MORE: "top_calendar_more",
  TOP_CALENDAR_CTA: "top_calendar_cta_main",
};

/**
 * Phase175: data-track属性の自動計測を初期化
 *
 * [data-track]属性付きの要素がクリックされたときに
 * 自動的にtrackEventを呼ぶ。
 */
export function initDataTrackListener() {
  if (typeof window === "undefined") return;
  if (window.__dataTrackListenerActive) return;
  window.__dataTrackListenerActive = true;

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (!el) return;
    const action = el.getAttribute("data-track");
    const eventId = el.getAttribute("data-event-id");
    if (action) {
      trackEvent(action, {
        eventId: eventId ? Number(eventId) : undefined,
        metadata: { element: el.tagName, text: el.textContent?.slice(0, 50) },
      });
    }
  });
}
