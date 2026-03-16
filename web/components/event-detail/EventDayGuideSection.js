"use client";

import { trackEvent, EVENTS } from "@/lib/analytics";

/**
 * Phase55: 当日ガイドセクション
 *
 * 受付・アクセス・駐車場・交通機関を統合表示。
 * MarathonDetailAccess を拡張した形。
 * 全データが空なら非表示。
 */
export default function EventDayGuideSection({
  receptionPlace,
  receptionTimeText,
  transitText,
  parkingInfo,
  accessInfo,
  venueName,
  venueAddress,
  mapUrl,
  eventId,
  eventTitle,
}) {
  const hasAnyData =
    receptionPlace ||
    receptionTimeText ||
    transitText ||
    parkingInfo ||
    accessInfo ||
    venueName ||
    venueAddress;

  if (!hasAnyData) return null;

  function handleMapClick() {
    trackEvent(EVENTS.MARATHON_MAP_CLICK, {
      event_id: eventId,
      event_name: eventTitle,
    });
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">当日ガイド</h2>
      <div className="space-y-4">
        {/* 会場 */}
        {(venueName || venueAddress) && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              📍 会場
            </h3>
            {venueName && (
              <p className="text-base text-gray-900 font-medium">{venueName}</p>
            )}
            {venueAddress && (
              <p className="text-sm text-gray-600 mt-0.5">{venueAddress}</p>
            )}
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMapClick}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
              >
                📍 地図で見る（外部サイト）
                <span className="text-xs">↗</span>
              </a>
            )}
          </div>
        )}

        {/* 受付 */}
        {(receptionPlace || receptionTimeText) && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              🎫 受付
            </h3>
            {receptionPlace && (
              <div className="text-sm">
                <span className="text-gray-500">受付場所: </span>
                <span className="text-gray-900">{receptionPlace}</span>
              </div>
            )}
            {receptionTimeText && (
              <div className="text-sm mt-1">
                <span className="text-gray-500">受付時間: </span>
                <span className="text-gray-900">{receptionTimeText}</span>
              </div>
            )}
          </div>
        )}

        {/* アクセス */}
        {accessInfo && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              🚗 アクセス
            </h3>
            <p className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {accessInfo}
            </p>
          </div>
        )}

        {/* 電車・バス */}
        {transitText && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              🚃 電車・バス
            </h3>
            <p className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {transitText}
            </p>
          </div>
        )}

        {/* 駐車場 */}
        {parkingInfo && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              🅿️ 駐車場
            </h3>
            <p className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap">
              {parkingInfo}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
