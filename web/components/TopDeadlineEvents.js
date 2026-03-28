"use client";
import EventShowcaseCard from "./home/EventShowcaseCard";
import EventCarouselSection from "./home/EventCarouselSection";
import { useImpressionTracker } from "@/hooks/useImpressionTracker";

export default function TopDeadlineEvents({ events = [] }) {
  const display = events.slice(0, 8);
  useImpressionTracker(display, "deadline");
  if (events.length === 0) return null;

  return (
    <EventCarouselSection
      title="締切間近の大会"
      subtitle="エントリー締切が近い大会をチェック"
      accentColor="#ef4444"
      moreHref="/marathon?sort=entry_end_date"
      moreLabel="もっと見る"
    >
      {display.map((event) => (
        <EventShowcaseCard key={event.id} event={event} variant="deadline" />
      ))}
    </EventCarouselSection>
  );
}
