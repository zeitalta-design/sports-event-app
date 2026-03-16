import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";
import UrgencyBadge from "./UrgencyBadge";

/**
 * 主催者ページ / シリーズページ用の大会一覧カード
 * Phase26 の可読性改善を維持した見やすいカード
 */
export default function MarathonListCard({ event }) {
  return (
    <Link
      href={getEventDetailPath(event)}
      className="block card p-5 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* 左: メイン情報 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            {event.event_date && (
              <span className="font-medium text-gray-700">
                {formatDate(event.event_date)}
              </span>
            )}
            {event.prefecture && <span>{event.prefecture}</span>}
            {event.city && (
              <span className="text-gray-400">{event.city}</span>
            )}
          </div>
        </div>

        {/* 右: バッジ — Phase84: OfficialStatusBadge 統一 */}
        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
          {event.distance_labels &&
            event.distance_labels.map((label) => (
              <span
                key={label}
                className="inline-block px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded"
              >
                {label}
              </span>
            ))}
          <OfficialStatusBadge event={event} variant="badge" showDeadline />
          <UrgencyBadge event={event} />
        </div>
      </div>
    </Link>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
  } catch {
    return dateStr;
  }
}

