"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackEvent, EVENTS } from "@/lib/analytics";
import { getEventDetailPath } from "@/lib/sport-config";

/**
 * 関連大会セクション（Client Component）
 *
 * サーバー側で算出済みの関連大会データを受け取り、表示・計測する。
 * データ取得ロジックには一切関与しない（将来の推薦方式変更に影響されない）。
 *
 * @param {object} props
 * @param {number} props.currentEventId - 現在表示中の大会ID
 * @param {string} props.currentEventTitle - 現在表示中の大会名
 * @param {Array} props.events - 関連大会の配列
 */
export default function RelatedMarathons({
  currentEventId,
  currentEventTitle,
  events,
}) {
  const impressionSent = useRef(false);

  // 表示イベント計測（1度だけ）
  useEffect(() => {
    if (events.length > 0 && !impressionSent.current) {
      impressionSent.current = true;
      trackEvent(EVENTS.RELATED_MARATHONS_IMPRESSION, {
        current_marathon_id: currentEventId,
        current_marathon_name: currentEventTitle,
        count: events.length,
      });
    }
  }, [events, currentEventId, currentEventTitle]);

  if (!events || events.length === 0) return null;

  function handleClick(relatedEvent, position) {
    trackEvent(EVENTS.RELATED_MARATHON_CLICK, {
      current_marathon_id: currentEventId,
      current_marathon_name: currentEventTitle,
      related_marathon_id: relatedEvent.id,
      related_marathon_name: relatedEvent.title,
      position,
      related_score: relatedEvent.related_score,
    });
  }

  return (
    <section className="mt-10 pt-8 border-t border-gray-100">
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        この大会に興味がある人は、こんな大会も見ています
      </h2>
      <p className="text-xs text-gray-400 mb-5">
        同じエリア・距離・開催時期が近い大会を表示しています
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((ev, idx) => (
          <RelatedCard
            key={ev.id}
            event={ev}
            position={idx + 1}
            onClick={handleClick}
          />
        ))}
      </div>
    </section>
  );
}

// ─── カード ──────────────────────────────────

function RelatedCard({ event, position, onClick }) {
  const entryBadge = getEntryBadge(event.entry_status);

  return (
    <Link
      href={getEventDetailPath(event)}
      className="block card p-4 hover:shadow-md hover:border-blue-200 transition-all group"
      onClick={() => onClick(event, position)}
    >
      {/* タイトル */}
      <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
        {event.title}
      </h3>

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
        {event.event_date && <span>{formatCardDate(event.event_date)}</span>}
        {event.prefecture && <span>{event.prefecture}</span>}
      </div>

      {/* バッジ行 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 距離バッジ */}
        {event.distance_labels &&
          event.distance_labels.map((label) => (
            <span
              key={label}
              className="inline-block px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
            >
              {label}
            </span>
          ))}

        {/* エントリー状態 */}
        {entryBadge && (
          <span className={`inline-block px-2 py-0.5 text-xs rounded ${entryBadge.className}`}>
            {entryBadge.label}
          </span>
        )}
      </div>

      {/* 理由チップ */}
      {event.related_reason_labels && event.related_reason_labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-50">
          {event.related_reason_labels.map((reason) => (
            <span
              key={reason}
              className="inline-block px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-50 rounded"
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

function getEntryBadge(status) {
  const badges = {
    open: { label: "受付中", className: "bg-green-50 text-green-700" },
    upcoming: { label: "受付予定", className: "bg-blue-50 text-blue-600" },
    closed: { label: "締切", className: "bg-gray-100 text-gray-500" },
    cancelled: { label: "中止", className: "bg-red-50 text-red-600" },
  };
  return badges[status] || null;
}
