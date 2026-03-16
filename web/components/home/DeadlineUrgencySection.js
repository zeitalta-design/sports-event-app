"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSavedIds } from "@/lib/saved-events-storage";
import { getEventDetailPath } from "@/lib/sport-config";

/**
 * Phase107: 締切間近セクション（保存大会）
 *
 * 保存大会のうち締切7日以内のものを最大3件表示。
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

export default function DeadlineUrgencySection() {
  const [urgentEvents, setUrgentEvents] = useState([]);

  useEffect(() => {
    loadUrgent();

    function onChange() {
      loadUrgent();
    }
    window.addEventListener("saved-change", onChange);
    return () => window.removeEventListener("saved-change", onChange);
  }, []);

  async function loadUrgent() {
    try {
      const savedIds = getSavedIds();
      if (savedIds.length === 0) {
        setUrgentEvents([]);
        return;
      }

      const res = await fetch(`/api/events/by-ids?ids=${savedIds.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      const events = data.events || [];

      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const urgent = events
        .filter((ev) => {
          if (!ev.entry_end_date) return false;
          const deadline = new Date(ev.entry_end_date);
          return deadline >= now && deadline <= sevenDays;
        })
        .sort((a, b) => new Date(a.entry_end_date) - new Date(b.entry_end_date))
        .slice(0, 3);

      setUrgentEvents(urgent);
    } catch {
      setUrgentEvents([]);
    }
  }

  if (urgentEvents.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <h2 className="text-sm font-bold text-red-700 flex items-center gap-1.5 mb-3">
          <span>⏰</span> 保存中の大会 — 締切間近
        </h2>
        <div className="space-y-2">
          {urgentEvents.map((ev) => {
            const days = daysUntil(ev.entry_end_date);
            const href = ev.path || getEventDetailPath(ev) || `/marathon/${ev.id}`;
            return (
              <Link
                key={ev.id}
                href={href}
                className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex-shrink-0 w-12 text-center">
                  <p className="text-lg font-bold text-red-600">
                    {days !== null ? days : "—"}
                  </p>
                  <p className="text-[10px] text-red-500">日後</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">
                    {ev.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ev.prefecture && `${ev.prefecture} · `}
                    締切: {ev.entry_end_date}
                  </p>
                </div>
                <span className="text-xs text-blue-600 flex-shrink-0">確認 →</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
