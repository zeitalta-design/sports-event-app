import Link from "next/link";
import { getEventDetailPath } from "@/lib/sport-config";
import OfficialStatusBadge from "@/components/OfficialStatusBadge";

/**
 * 関連大会 / 系列大会 共通のミニカードUI
 *
 * Phase26 の可読性改善を維持。
 * 文字が小さすぎない、押しやすい、モバイルでも読みやすい。
 *
 * @param {object} props
 * @param {object} props.event - 大会データ
 * @param {function} [props.onClick] - クリック時のコールバック
 */
export default function MarathonMiniCard({ event, onClick }) {
  return (
    <Link
      href={getEventDetailPath(event)}
      className="block card p-5 hover:shadow-md hover:border-blue-200 transition-all group"
      onClick={() => onClick?.(event)}
    >
      {/* タイトル */}
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2.5 leading-snug">
        {event.title}
      </h3>

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mb-3">
        {event.event_date && (
          <span className="font-medium text-gray-700">
            {formatCardDate(event.event_date)}
          </span>
        )}
        {event.prefecture && <span>{event.prefecture}</span>}
      </div>

      {/* バッジ行 — Phase84: OfficialStatusBadge 統一 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {event.distance_labels &&
          event.distance_labels.map((label) => (
            <span
              key={label}
              className="inline-block px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded"
            >
              {label}
            </span>
          ))}
        <OfficialStatusBadge event={event} variant="badge" />
      </div>

      {/* 理由チップ */}
      {event.reasonChips && event.reasonChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
          {event.reasonChips.map((reason) => (
            <span
              key={reason}
              className="inline-block px-2 py-0.5 text-xs text-gray-400 bg-gray-50 rounded"
            >
              {reason}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ─── ヘルパー ────────────────────────────────

function formatCardDate(dateStr) {
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

