"use client";

import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * 会場・アクセスセクション
 * Phase 26: ラベル・テキストサイズ・構造改善
 */
export default function MarathonDetailAccess({
  venueName,
  venueAddress,
  accessInfo,
  mapUrl,
  eventId,
  eventTitle,
}) {
  if (!venueName && !venueAddress && !accessInfo) return null;

  function handleMapClick() {
    trackEvent(EVENTS.MARATHON_MAP_CLICK, {
      event_id: eventId,
      event_name: eventTitle,
    });
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        会場・アクセス
      </h2>
      <div className="space-y-4 text-sm">
        {venueName && (
          <div>
            <dt className="text-gray-500 text-sm mb-1">会場</dt>
            <dd className="text-base text-gray-900 font-medium">{venueName}</dd>
          </div>
        )}
        {venueAddress && (
          <div>
            <dt className="text-gray-500 text-sm mb-1">住所</dt>
            <dd className="text-base text-gray-900">{venueAddress}</dd>
          </div>
        )}
        {accessInfo && (
          <div>
            <dt className="text-gray-500 text-sm mb-1">アクセス</dt>
            <dd className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
              {accessInfo}
            </dd>
          </div>
        )}
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleMapClick}
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium mt-1"
          >
            📍 地図で見る（外部サイト）
            <span className="text-xs">↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
