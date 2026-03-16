"use client";
import Link from "next/link";
import { getEventDetailPath, SPORT_CONFIGS } from "@/lib/sport-config";

function SportIcon({ sportType }) {
  if (!sportType || sportType === "marathon") return null;
  const sport = SPORT_CONFIGS.find((s) => s.sportTypeForDb === sportType);
  if (!sport) return null;
  return <span className="text-xs" title={sport.label}>{sport.icon}</span>;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "未定";
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

function DeadlineBadge({ days }) {
  if (days === null) return null;
  if (days <= 0) {
    return <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">本日締切</span>;
  }
  if (days <= 3) {
    return <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">あと{days}日</span>;
  }
  if (days <= 7) {
    return <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">あと{days}日</span>;
  }
  return <span className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">あと{days}日</span>;
}

export default function TopDeadlineEvents({ events = [] }) {
  if (events.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#323433" }}>締切間近の大会</h2>
          <p className="text-xs font-medium mt-0.5" style={{ color: "#323433" }}>エントリー締切が近い大会をチェック</p>
        </div>
        <Link href="/marathon?sort=entry_end_date" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          もっと見る →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => {
          const days = daysUntil(ev.entry_end_date);
          return (
            <Link
              key={ev.id}
              href={getEventDetailPath(ev)}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold group-hover:text-blue-700 transition-colors line-clamp-2 flex-1" style={{ color: "#323433" }}>
                  <SportIcon sportType={ev.sport_type} /> {ev.title}
                </h3>
                <DeadlineBadge days={days} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium" style={{ color: "#323433" }}>
                <span>開催 {formatDate(ev.event_date)}</span>
                <span>締切 {formatDate(ev.entry_end_date)}</span>
                {ev.prefecture && <span>{ev.prefecture}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
