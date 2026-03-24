"use client";
import { useEffect, useRef } from "react";

// インプレッション送信フック（インラインfetch実装）
export function useImpressionTracker(events, placement) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    if (!events || events.length === 0 || !placement) return;

    sentRef.current = true;
    const items = events.map((e) => ({
      eventId: e.id,
      placement,
    }));

    try {
      fetch("/api/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [events, placement]);
}
