"use client";

/**
 * Phase62: 保存大会プレビューセクション
 *
 * ダッシュボードに保存中の大会をコンパクトに表示。
 * 件数0ならCTAを表示。
 */

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import { buildEventAlertCandidates } from "@/lib/event-alert-candidates";
import DashboardEventCard from "./DashboardEventCard";

export default function SavedEventsPreview() {
  const [events, setEvents] = useState([]);
  const [alertMap, setAlertMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);

  const loadData = useCallback(async () => {
    const savedIds = getSavedIds();
    setSavedCount(savedIds.length);

    if (savedIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/events/by-ids?ids=${savedIds.slice(0, 4).join(",")}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const evts = data.events || [];
      setEvents(evts);

      // アラート生成
      const aMap = new Map();
      for (const ev of evts) {
        const candidate = buildEventAlertCandidates(ev);
        if (candidate.alerts.length > 0) {
          aMap.set(ev.id, candidate.alerts[0]);
        }
      }
      setAlertMap(aMap);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    function onSync() { loadData(); }
    window.addEventListener("saved-change", onSync);
    return () => window.removeEventListener("saved-change", onSync);
  }, [loadData]);

  if (loading) return null;

  // 保存なし → CTA
  if (savedCount === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span>📌</span>
          保存中の大会
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-800 mb-3">
            気になる大会を「あとで見る」に保存して、ここで管理しましょう
          </p>
          <Link
            href="/marathon"
            className="inline-block px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            大会を探す
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span>📌</span>
          保存中の大会
          <span className="text-xs font-normal text-gray-400 ml-1">{savedCount}件</span>
        </h2>
        <Link
          href="/saved"
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          すべて見る →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((event) => (
          <DashboardEventCard key={event.id} event={event} />
        ))}
      </div>
      {savedCount > 4 && (
        <div className="text-center mt-3">
          <Link
            href="/saved"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            残り{savedCount - 4}件を見る
          </Link>
        </div>
      )}
    </section>
  );
}
