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
};
