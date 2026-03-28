"use client";
import EventShowcaseCard from "./EventShowcaseCard";
import EventCarouselSection from "./EventCarouselSection";
import { useImpressionTracker } from "@/hooks/useImpressionTracker";

export default function PopularEventsSection({ events = [] }) {
  useImpressionTracker(events, "popular");
  if (events.length === 0) return null;

  return (
    <EventCarouselSection
      title="今人気の大会"
      subtitle="多くのランナーが注目中"
      accentColor="#2563eb"
      moreHref="/marathon?sort=popularity"
      moreLabel="もっと見る"
    >
      {events.map((event, i) => (
        <EventShowcaseCard key={event.id} event={event} rank={i + 1} variant="popular" />
      ))}
    </EventCarouselSection>
  );
}
