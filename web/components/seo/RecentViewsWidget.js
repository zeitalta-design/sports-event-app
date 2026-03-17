"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getRecentViews } from "@/lib/recent-views-storage";

/**
 * Phase114: 最近見た大会ウィジェット（クライアントコンポーネント）
 * localStorage の最近見た大会を表示
 */
export default function RecentViewsWidget({ maxItems = 3 }) {
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    try {
      const views = getRecentViews();
      setRecentEvents(views.slice(0, maxItems));
    } catch {}
  }, [maxItems]);

  if (recentEvents.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-gray-700 mb-3">最近見た大会</h3>
      <div className="card divide-y divide-gray-50">
        {recentEvents.map((event) => (
          <Link
            key={event.id}
            href={event.path || `/marathon/${event.id}`}
            className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
              {event.date && (
                <p className="text-xs text-gray-500">{event.date}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
