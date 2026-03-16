/**
 * Phase69: ランキングカード
 * Phase76: OfficialStatusBadge 対応
 *
 * 順位 + 大会情報のコンパクトカード。
 */

import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import { formatEventDate, formatEventLocation, formatDistanceBadges } from "@/lib/event-list-formatters";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";

const RANK_STYLES = {
  1: "bg-yellow-400 text-white",
  2: "bg-gray-300 text-white",
  3: "bg-amber-600 text-white",
};

export default function RankingCard({ event, rank }) {
  const detailPath = getEventDetailPath(event);
  const date = formatEventDate(event.event_date);
  const location = formatEventLocation(event);
  const distances = formatDistanceBadges(event.distance_list);
  const rankStyle = RANK_STYLES[rank] || "bg-gray-100 text-gray-600";

  return (
    <Link
      href={detailPath}
      className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      {/* 順位 */}
      <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center text-sm font-bold rounded-lg ${rankStyle}`}>
        {rank}
      </span>

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-700 transition-colors">
          {event.title}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
          <span>{date}</span>
          <span>·</span>
          <span>{location}</span>
          {distances.slice(0, 2).map((d, i) => (
            <span key={i} className="px-1.5 py-0 text-blue-600 bg-blue-50 rounded">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* ステータス — Phase76: OfficialStatusBadge */}
      <div className="shrink-0">
        <OfficialStatusBadge event={event} variant="inline" />
      </div>
    </Link>
  );
}
