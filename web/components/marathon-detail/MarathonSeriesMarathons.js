"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { trackEvent, EVENTS } from "@/lib/analytics";
import MarathonMiniCard from "./MarathonMiniCard";

/**
 * 系列大会 / 同じ主催者の大会セクション（Client Component）
 * Phase 29: シリーズ/主催者ページへの導線追加
 *
 * @param {object} props
 * @param {number} props.currentEventId - 現在表示中の大会ID
 * @param {string} props.currentEventTitle - 現在表示中の大会名
 * @param {Array} props.events - 系列大会の配列
 * @param {string} [props.seriesSlug] - シリーズページslug
 * @param {string} [props.seriesName] - シリーズ名
 * @param {string} [props.organizerSlug] - 主催者ページslug
 * @param {string} [props.organizerName] - 主催者名
 */
export default function MarathonSeriesMarathons({
  currentEventId,
  currentEventTitle,
  events,
  seriesSlug,
  seriesName,
  organizerSlug,
  organizerName,
}) {
  const impressionSent = useRef(false);

  // 表示イベント計測（1度だけ）
  useEffect(() => {
    if (events.length > 0 && !impressionSent.current) {
      impressionSent.current = true;
      trackEvent(EVENTS.SERIES_MARATHON_IMPRESSION, {
        current_marathon_id: currentEventId,
        current_marathon_name: currentEventTitle,
        section_name: "series",
        count: events.length,
      });
    }
  }, [events, currentEventId, currentEventTitle]);

  if (!events || events.length === 0) return null;

  function handleClick(seriesEvent, position) {
    trackEvent(EVENTS.SERIES_MARATHON_CLICK, {
      current_marathon_id: currentEventId,
      current_marathon_name: currentEventTitle,
      target_marathon_id: seriesEvent.id,
      target_marathon_name: seriesEvent.title,
      position,
      section_name: "series",
    });
  }

  return (
    <section className="mt-10 pt-8 border-t border-gray-100">
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        同じ主催者・シリーズの大会
      </h2>
      <p className="text-sm text-gray-400 mb-5">
        同じ主催者が開催する大会や、同シリーズの大会です
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((ev, idx) => (
          <MarathonMiniCard
            key={ev.id}
            event={{
              ...ev,
              reasonChips: ev.series_reason ? [ev.series_reason] : [],
            }}
            onClick={(e) => handleClick(e, idx + 1)}
          />
        ))}
      </div>

      {/* 導線リンク */}
      {(seriesSlug || organizerSlug) && (
        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-50">
          {seriesSlug && (
            <Link
              href={`/series/${encodeURIComponent(seriesSlug)}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              onClick={() =>
                trackEvent(EVENTS.SERIES_LINK_CLICK, {
                  current_marathon_id: currentEventId,
                  series_slug: seriesSlug,
                  series_name: seriesName,
                })
              }
            >
              {seriesName || "シリーズ"}一覧を見る
              <span aria-hidden="true">→</span>
            </Link>
          )}
          {organizerSlug && (
            <Link
              href={`/organizer/${encodeURIComponent(organizerSlug)}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              onClick={() =>
                trackEvent(EVENTS.ORGANIZER_LINK_CLICK, {
                  current_marathon_id: currentEventId,
                  organizer_slug: organizerSlug,
                  organizer_name: organizerName,
                })
              }
            >
              {organizerName || "主催者"}の大会を見る
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
