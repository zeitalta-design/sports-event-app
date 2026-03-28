"use client";
import EventShowcaseCard from "./home/EventShowcaseCard";
import EventCarouselSection from "./home/EventCarouselSection";
import { useImpressionTracker } from "@/hooks/useImpressionTracker";

export default function TopNewEvents({ events = [] }) {
  const display = events.slice(0, 8);
  useImpressionTracker(display, "standard");
  if (events.length === 0) return null;

  return (
    <EventCarouselSection
      title="注目の大会"
      subtitle="最近更新された大会情報"
      accentColor="#10b981"
      moreHref="/marathon?sort=newest"
      moreLabel="すべて見る"
    >
      {display.map((event) => (
        <EventShowcaseCard key={event.id} event={event} variant="featured" />
      ))}
    </EventCarouselSection>
  );
}
