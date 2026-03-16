"use client";
import { useState, useEffect } from "react";
import { trackEvent, EVENTS } from "@/lib/analytics";

export default function FavoriteButton({ eventId }) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    fetch(`/api/favorites?check=${eventId}`)
      .then((r) => r.json())
      .then((data) => setIsFavorite(data.isFavorite))
      .catch(() => {});
  }, [eventId]);

  async function toggle() {
    try {
      if (isFavorite) {
        await fetch(`/api/favorites/${eventId}`, { method: "DELETE" });
        setIsFavorite(false);
        trackEvent(EVENTS.FAVORITE_REMOVE, { event_id: eventId });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: Number(eventId) }),
        });
        setIsFavorite(true);
        trackEvent(EVENTS.FAVORITE_ADD, { event_id: eventId });
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <button
      onClick={toggle}
      className={`text-xl p-1 rounded hover:bg-gray-100 ${
        isFavorite ? "text-red-500" : "text-gray-300 hover:text-red-400"
      }`}
      title={isFavorite ? "お気に入り解除" : "お気に入り追加"}
    >
      {isFavorite ? "♥" : "♡"}
    </button>
  );
}
