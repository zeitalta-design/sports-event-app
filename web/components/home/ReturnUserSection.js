"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getCompareIds } from "@/lib/compare-utils";
import { getRecentViewIds } from "@/lib/recent-views-storage";
import { getEventDetailPath } from "@/lib/sport-config";

/**
 * Phase107: 再訪ユーザー向けセクション
 *
 * 最近見た大会4件 + 保存/比較サマリー。
 * 初回ユーザー（データ0）なら非表示。
 */

export default function ReturnUserSection() {
  const [recentEvents, setRecentEvents] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [compareCount, setCompareCount] = useState(0);

  useEffect(() => {
    const recentIds = getRecentViewIds();
    setSavedCount(getSavedIds().length);
    setCompareCount(getCompareIds().length);

    if (recentIds.length === 0) return;

    // 最新4件の大会情報を取得
    const ids = recentIds.slice(0, 4);
    fetch(`/api/events/by-ids?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        const events = data.events || [];
        // recent order維持
        const ordered = ids
          .map((id) => events.find((e) => e.id === id))
          .filter(Boolean);
        setRecentEvents(ordered);
      })
      .catch(() => {});
  }, []);

  const hasActivity = recentEvents.length > 0 || savedCount > 0 || compareCount > 0;
  if (!hasActivity) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-blue-800 flex items-center gap-1.5">
            <span>👋</span> おかえりなさい
          </h2>
          <div className="flex items-center gap-3 text-xs text-blue-600">
            {savedCount > 0 && (
              <Link href="/saved" className="hover:underline">
                保存 {savedCount}件
              </Link>
            )}
            {compareCount > 0 && (
              <Link href="/compare" className="hover:underline">
                比較 {compareCount}件
              </Link>
            )}
          </div>
        </div>

        {recentEvents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentEvents.map((ev) => {
              const href = ev.path || getEventDetailPath(ev) || `/marathon/${ev.id}`;
              return (
                <Link
                  key={ev.id}
                  href={href}
                  className="flex items-center gap-3 p-2.5 bg-white rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {ev.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ev.prefecture || ""}
                      {ev.event_date ? ` · ${ev.event_date}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-blue-600 flex-shrink-0">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
