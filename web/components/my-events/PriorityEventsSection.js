import Link from "next/link";
import AlertEventCard from "@/components/alerts/AlertEventCard";

/**
 * Phase61: 今見直したい大会セクション
 *
 * alerts の high/medium を優先表示する。
 */

export default function PriorityEventsSection({ events }) {
  if (!events || events.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700">
          今見直したい大会
        </h2>
        <Link
          href="/alerts"
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          見直しリストを見る
        </Link>
      </div>
      <div className="space-y-3">
        {events.map((item) => (
          <AlertEventCard key={item.eventId} item={item} />
        ))}
      </div>
    </section>
  );
}
