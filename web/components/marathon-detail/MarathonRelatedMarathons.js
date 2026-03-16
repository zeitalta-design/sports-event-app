"use client";

import { useEffect, useRef } from "react";
import { trackEvent, EVENTS } from "@/lib/analytics";
import MarathonMiniCard from "./MarathonMiniCard";

/**
 * 関連大会セクション（Client Component）
 *
 * サーバー側で算出済みの関連大会データを受け取り、表示・計測する。
 * Phase26 の可読性を維持した大きめのカードで表示。
 *
 * @param {object} props
 * @param {number} props.currentEventId - 現在表示中の大会ID
 * @param {string} props.currentEventTitle - 現在表示中の大会名
 * @param {Array} props.events - 関連大会の配列
 */
export default function MarathonRelatedMarathons({
  currentEventId,
  currentEventTitle,
  events,
  recommendationSource = "attribute",
}) {
  const impressionSent = useRef(false);

  // 表示イベント計測（1度だけ）
  useEffect(() => {
    if (events.length > 0 && !impressionSent.current) {
      impressionSent.current = true;
      trackEvent(EVENTS.RELATED_MARATHONS_IMPRESSION, {
        current_marathon_id: currentEventId,
        current_marathon_name: currentEventTitle,
        section_name: "related",
        count: events.length,
        recommendation_source: recommendationSource,
      });
    }
  }, [events, currentEventId, currentEventTitle, recommendationSource]);

  if (!events || events.length === 0) return null;

  function handleClick(relatedEvent, position) {
    trackEvent(EVENTS.RELATED_MARATHON_CLICK, {
      current_marathon_id: currentEventId,
      current_marathon_name: currentEventTitle,
      target_marathon_id: relatedEvent.id,
      target_marathon_name: relatedEvent.title,
      position,
      section_name: "related",
      related_score: relatedEvent.related_score,
      reason_labels: relatedEvent.related_reason_labels?.join(","),
      recommendation_source: recommendationSource,
    });
  }

  return (
    <section className="mt-10 pt-8 border-t border-gray-100">
      <h2 className="text-lg font-bold text-gray-900 mb-1">
        {recommendationSource === "cooccurrence"
          ? "この大会を見た人は、こんな大会も見ています"
          : recommendationSource === "hybrid"
            ? "この大会を見た人は、こんな大会も見ています"
            : "あわせてチェックしたい大会"}
      </h2>
      <p className="text-sm text-gray-400 mb-5">
        {recommendationSource === "cooccurrence"
          ? "実際の閲覧データに基づくおすすめです"
          : recommendationSource === "hybrid"
            ? "閲覧データと属性の類似度に基づくおすすめです"
            : "同じエリア・距離・開催時期が近い大会を表示しています"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((ev, idx) => (
          <MarathonMiniCard
            key={ev.id}
            event={{
              ...ev,
              reasonChips: ev.related_reason_labels,
            }}
            onClick={(e) => handleClick(e, idx + 1)}
          />
        ))}
      </div>
    </section>
  );
}
