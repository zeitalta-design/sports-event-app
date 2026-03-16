"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getEventIdsByStatus } from "@/lib/my-events-manager";
import { getEventDetailPath } from "@/lib/sport-config";

/**
 * Phase103: エントリー済み大会カウントダウン
 *
 * ステータス=entered の大会を取得し、開催日までのカウントダウンを表示。
 */

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "日程未定";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${dow})`;
}

export default function EnteredEventsSection() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEnteredEvents();

    function onChange() {
      loadEnteredEvents();
    }
    window.addEventListener("my-events-status-change", onChange);
    return () => window.removeEventListener("my-events-status-change", onChange);
  }, []);

  async function loadEnteredEvents() {
    setLoading(true);
    try {
      const enteredIds = getEventIdsByStatus("entered");
      if (enteredIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/events/by-ids?ids=${enteredIds.join(",")}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const fetched = data.events || [];

      // 開催日順でソート
      fetched.sort((a, b) => {
        const da = a.event_date ? new Date(a.event_date).getTime() : Infinity;
        const db = b.event_date ? new Date(b.event_date).getTime() : Infinity;
        return da - db;
      });

      setEvents(fetched);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading || events.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-3">
        <span>✅</span> エントリー済み
        <span className="text-xs font-normal text-gray-400">
          ({events.length})
        </span>
      </h2>
      <div className="space-y-2">
        {events.map((ev) => {
          const days = daysUntil(ev.event_date);
          const href = ev.path || getEventDetailPath(ev) || `/marathon/${ev.id}`;

          return (
            <Link
              key={ev.id}
              href={href}
              className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              {/* カウントダウン */}
              <div className="flex-shrink-0 w-14 text-center">
                {days !== null && days >= 0 ? (
                  <>
                    <p className="text-lg font-bold text-green-700">{days}</p>
                    <p className="text-[10px] text-green-600">日後</p>
                  </>
                ) : days !== null && days < 0 ? (
                  <p className="text-xs font-bold text-gray-400">終了</p>
                ) : (
                  <p className="text-xs text-gray-400">—</p>
                )}
              </div>

              {/* 大会情報 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 line-clamp-1">
                  {ev.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{formatDate(ev.event_date)}</span>
                  {ev.prefecture && <span>{ev.prefecture}</span>}
                </div>
              </div>

              <span className="text-xs text-blue-600 flex-shrink-0">→</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
