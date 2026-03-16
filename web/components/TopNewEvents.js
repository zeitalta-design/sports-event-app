"use client";
import Link from "next/link";
import { getStatusLabel, getStatusBadgeClassSimple } from "@/lib/entry-status";
import { getEventDetailPath, SPORT_CONFIGS } from "@/lib/sport-config";

function SportIcon({ sportType }) {
  if (!sportType || sportType === "marathon") return null;
  const sport = SPORT_CONFIGS.find((s) => s.sportTypeForDb === sportType);
  if (!sport) return null;
  return <span className="text-xs" title={sport.label}>{sport.icon}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return "未定";
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
}

export default function TopNewEvents({ events = [] }) {
  if (events.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#323433" }}>注目の大会</h2>
          <p className="text-xs font-medium mt-0.5" style={{ color: "#323433" }}>最近更新された大会情報</p>
        </div>
        <Link href="/marathon" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          すべて見る →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((ev) => (
          <Link
            key={ev.id}
            href={getEventDetailPath(ev)}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <h3 className="text-sm font-bold group-hover:text-blue-700 transition-colors line-clamp-2 mb-2" style={{ color: "#323433" }}>
              <SportIcon sportType={ev.sport_type} /> {ev.title}
            </h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium" style={{ color: "#323433" }}>
              <span>{formatDate(ev.event_date)}</span>
              {ev.prefecture && <span>{ev.prefecture}</span>}
              {ev.entry_status && ev.entry_status !== "unknown" && (
                <span className={`font-medium px-1.5 py-0.5 rounded ${getStatusBadgeClassSimple(ev.entry_status)}`}>
                  {getStatusLabel(ev.entry_status)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
