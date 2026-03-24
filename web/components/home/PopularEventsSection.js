"use client";
import Link from "next/link";
import EventShowcaseCard from "./EventShowcaseCard";
import { useImpressionTracker } from "@/hooks/useImpressionTracker";

export default function PopularEventsSection({ events = [] }) {
  useImpressionTracker(events, "popular");
  if (events.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 bg-blue-600 rounded-full" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#1a1a1a" }}>今人気の大会</h2>
            <p className="text-xs text-gray-500 mt-0.5">多くのランナーが注目中</p>
          </div>
        </div>
        <Link href="/marathon?sort=popularity" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          もっと見る →
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-5 scrollbar-hide">
        {events.map((event, i) => (
          <EventShowcaseCard key={event.id} event={event} rank={i + 1} variant="popular" />
        ))}
      </div>
    </section>
  );
}
