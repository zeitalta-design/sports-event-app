"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getRecentViewIds } from "@/lib/recent-views-storage";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";

/**
 * Phase90: 最近見た大会セクション
 *
 * localStorage から閲覧履歴を取得し、横スクロールカードで表示。
 * 空なら非表示。
 *
 * @param {object} props
 * @param {number} [props.maxItems=8] - 表示件数上限
 * @param {string} [props.title="最近見た大会"] - セクションタイトル
 * @param {boolean} [props.showClearButton=false] - クリアボタン表示
 */
export default function RecentViewsSection({
  maxItems = 8,
  title = "最近見た大会",
  showClearButton = false,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentEvents();

    const handler = () => loadRecentEvents();
    window.addEventListener("recent-views-change", handler);
    return () => window.removeEventListener("recent-views-change", handler);
  }, []);

  async function loadRecentEvents() {
    const ids = getRecentViewIds();
    if (ids.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      const targetIds = ids.slice(0, maxItems);
      const res = await fetch(`/api/events/by-ids?ids=${targetIds.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // 閲覧順を維持
      const eventMap = new Map(data.events.map((e) => [e.id, e]));
      const ordered = targetIds
        .map((id) => eventMap.get(id))
        .filter(Boolean);

      setEvents(ordered);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    const { clearRecentViews } = require("@/lib/recent-views-storage");
    clearRecentViews();
    setEvents([]);
  }

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="text-xl">👀</span>
          {title}
        </h2>
        {showClearButton && (
          <button
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            履歴をクリア
          </button>
        )}
      </div>

      {/* 横スクロールカードリスト */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {events.map((event) => (
          <RecentViewCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function RecentViewCard({ event }) {
  const path = event.path || `/marathon/${event.id}`;

  return (
    <Link
      href={path}
      className="flex-shrink-0 w-56 card p-4 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug min-h-[2.5rem]">
        {event.title}
      </h3>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mb-2">
        {event.event_date && (
          <span className="font-medium text-gray-700">
            {formatShortDate(event.event_date)}
          </span>
        )}
        {event.prefecture && <span>{event.prefecture}</span>}
      </div>

      <OfficialStatusBadge event={event} variant="badge" />
    </Link>
  );
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dateStr;
  }
}
