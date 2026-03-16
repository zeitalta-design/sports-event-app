"use client";

import { useState, useEffect, useCallback } from "react";
import { isSaved, toggleSavedId, getSavedCount, getMaxSaved } from "@/lib/saved-events-storage";

/**
 * Phase59: あとで見る状態を管理するカスタムフック
 *
 * @param {number} eventId - 大会ID
 * @returns {{ saved: boolean, toggle: () => { added: boolean, removed: boolean, full: boolean }, count: number, max: number }}
 */
export function useSavedEvents(eventId) {
  const [saved, setSaved] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setSaved(isSaved(eventId));
    setCount(getSavedCount());

    function onSavedChange() {
      setSaved(isSaved(eventId));
      setCount(getSavedCount());
    }
    window.addEventListener("saved-change", onSavedChange);
    return () => window.removeEventListener("saved-change", onSavedChange);
  }, [eventId]);

  const toggle = useCallback(() => {
    return toggleSavedId(eventId);
  }, [eventId]);

  return {
    saved,
    toggle,
    count,
    max: getMaxSaved(),
  };
}
