"use client";
import Link from "next/link";
import EventShowcaseCard from "./home/EventShowcaseCard";

export default function TopDeadlineEvents({ events = [] }) {
  if (events.length === 0) return null;

  // 最大5件に絞る
  const display = events.slice(0, 5);

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 bg-red-500 rounded-full" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#1a1a1a" }}>締切間近の大会</h2>
            <p className="text-xs text-gray-500 mt-0.5">エントリー締切が近い大会をチェック</p>
          </div>
        </div>
        <Link href="/marathon?sort=entry_end_date" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          もっと見る →
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-5 scrollbar-hide">
        {display.map((event) => (
          <EventShowcaseCard key={event.id} event={event} variant="deadline" />
        ))}
      </div>
    </section>
  );
}
