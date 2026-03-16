"use client";

import { useEffect, useRef } from "react";

const SESSION_KEY = "taikainaviSessionId";
const LAST_VIEWED_KEY = "taikainaviLastViewedMarathonId";

/**
 * 大会詳細ページ閲覧トラッキング
 *
 * - ページ表示時に1回だけ閲覧イベントをAPIに送信
 * - session_id を localStorage で管理
 * - 前回閲覧大会IDを referrer_marathon_id として送信
 * - 開発モードの二重実行を防止
 *
 * @param {object} props
 * @param {number} props.marathonId - 現在表示中の大会ID
 */
export default function MarathonViewTracker({ marathonId }) {
  const sentRef = useRef(false);

  useEffect(() => {
    // Strict Modeの二重実行防止
    if (sentRef.current) return;
    sentRef.current = true;

    // session_id の取得 or 生成
    let sessionId = null;
    try {
      sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem(SESSION_KEY, sessionId);
      }
    } catch {
      // localStorage が使えない環境ではスキップ
      return;
    }

    // 前回閲覧大会IDを取得
    let referrerMarathonId = null;
    try {
      const lastViewed = localStorage.getItem(LAST_VIEWED_KEY);
      if (lastViewed) {
        const parsed = parseInt(lastViewed, 10);
        if (!isNaN(parsed) && parsed !== marathonId) {
          referrerMarathonId = parsed;
        }
      }
    } catch {}

    // API送信（fire-and-forget）
    fetch("/api/events/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marathon_id: marathonId,
        session_id: sessionId,
        referrer_marathon_id: referrerMarathonId,
      }),
    }).catch(() => {});

    // 今回の大会IDを前回閲覧として保存
    try {
      localStorage.setItem(LAST_VIEWED_KEY, String(marathonId));
    } catch {}
  }, [marathonId]);

  return null; // 見た目は何も出さない
}

/**
 * ランダムなセッションIDを生成
 * crypto.randomUUID が使えればそれを使い、なければ fallback
 */
function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return (
    "s_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10)
  );
}
