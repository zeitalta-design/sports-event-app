"use client";

/**
 * Phase98: 大会開催場所マップ
 *
 * Google Maps Embed (Places) を利用して大会の開催場所を表示。
 * latitude/longitude がない場合は住所ベースで表示。
 * どちらもない場合は非表示。
 */
export default function EventLocationMap({
  venueName,
  venueAddress,
  accessInfo,
  prefecture,
  city,
  mapUrl,
  latitude,
  longitude,
  eventId,
  eventTitle,
}) {
  // マップ表示に使う検索クエリ
  const mapQuery = buildMapQuery({
    venueName,
    venueAddress,
    prefecture,
    city,
    latitude,
    longitude,
  });

  if (!mapQuery && !venueName && !venueAddress && !accessInfo) return null;

  // Google Maps embed URL (Free Embed, no API key needed)
  const embedUrl = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&hl=ja&z=15`
    : null;

  return (
    <section id="section-access" className="scroll-mt-20">
      <div className="card overflow-hidden">
        {/* セクションヘッダー */}
        <div className="p-6 pb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-xl">📍</span>
            会場・アクセス
          </h2>
        </div>

        {/* 会場情報 */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 左: 会場詳細 */}
            <div className="space-y-3">
              {venueName && (
                <div>
                  <dt className="text-xs text-gray-700 font-bold mb-0.5">会場名</dt>
                  <dd className="text-base font-semibold text-gray-900">
                    {venueName}
                  </dd>
                </div>
              )}
              {venueAddress && (
                <div>
                  <dt className="text-xs text-gray-700 font-bold mb-0.5">住所</dt>
                  <dd className="text-sm text-gray-700">{venueAddress}</dd>
                </div>
              )}
              {accessInfo && (
                <div>
                  <dt className="text-xs text-gray-700 font-bold mb-0.5">アクセス</dt>
                  <dd className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {accessInfo}
                  </dd>
                </div>
              )}
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
                >
                  🗺️ 詳細な地図を見る（外部サイト）
                  <span className="text-xs">↗</span>
                </a>
              )}
            </div>

            {/* 右: 都道府県・市区町村 */}
            <div className="space-y-3">
              {prefecture && (
                <div>
                  <dt className="text-xs text-gray-700 font-bold mb-0.5">都道府県</dt>
                  <dd className="text-sm font-medium text-gray-800">
                    {prefecture}
                  </dd>
                </div>
              )}
              {city && (
                <div>
                  <dt className="text-xs text-gray-700 font-bold mb-0.5">市区町村</dt>
                  <dd className="text-sm text-gray-700">{city}</dd>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* マップ */}
        {embedUrl && (
          <div className="relative w-full h-[300px] md:h-[400px] bg-gray-100 border-t border-gray-200">
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${eventTitle || "大会"}の開催場所`}
            />
          </div>
        )}
        {/* 地図非表示の場合の案内 */}
        {!embedUrl && (prefecture || city) && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              正確な開催場所が特定できないため、地図は表示していません。
              詳細は公式サイトをご確認ください。
            </p>
          </div>
        )}

        {/* フッター: Google Mapsで開くリンク */}
        {mapQuery && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Google Mapsで開く
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function buildMapQuery({ venueName, venueAddress, prefecture, city, latitude, longitude }) {
  // lat/lng がある場合はそれを使う（最も正確）
  if (latitude && longitude) {
    return `${latitude},${longitude}`;
  }
  // 住所がある場合（正確）
  if (venueAddress) {
    return venueName ? `${venueName} ${venueAddress}` : venueAddress;
  }
  // 会場名 + 都道府県 + 市区町村（それなりに正確）
  if (venueName && prefecture) {
    return `${prefecture}${city || ""} ${venueName}`;
  }
  // 会場名のみ（施設名で検索）
  if (venueName) {
    return venueName;
  }
  // 都道府県 + 市区町村のみでは正確な場所が特定できないため地図は非表示
  return null;
}
