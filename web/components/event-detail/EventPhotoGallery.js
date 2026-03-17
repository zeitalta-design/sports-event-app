import Link from "next/link";

/**
 * Phase160: 大会写真ギャラリーセクション
 *
 * 詳細ページ内にカテゴリ別の写真グリッドを表示。
 * 最大8枚 + 「もっと見る」導線。
 */

const TYPE_LABELS = {
  hero: "メイン",
  course: "コース",
  venue: "会場",
  start: "スタート",
  finish: "フィニッシュ",
  crowd: "盛り上がり",
  scenery: "景色",
  other: "その他",
};

const TYPE_DISPLAY_ORDER = ["course", "venue", "scenery", "start", "finish", "crowd", "hero", "other"];

export default function EventPhotoGallery({ photos, grouped, photoCount, photosPath }) {
  if (!photos || photos.length === 0) return null;

  // 表示する写真（最大8枚）
  const displayPhotos = photos.slice(0, 8);
  const hasMore = photoCount > 8;

  // カテゴリタグ（存在するもののみ）
  const categoryTags = TYPE_DISPLAY_ORDER
    .filter((type) => grouped[type]?.length > 0)
    .map((type) => ({ type, label: TYPE_LABELS[type] || type, count: grouped[type].length }));

  return (
    <section id="section-photos" className="scroll-mt-20">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>📸</span> 大会の雰囲気
          </h2>
          {hasMore && photosPath && (
            <Link
              href={photosPath}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {photoCount}枚すべて見る →
            </Link>
          )}
        </div>

        {/* カテゴリタグ */}
        {categoryTags.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {categoryTags.map((tag) => (
              <span
                key={tag.type}
                className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-100"
              >
                {tag.label} {tag.count}
              </span>
            ))}
          </div>
        )}

        {/* 写真グリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {displayPhotos.map((photo, idx) => (
            <div
              key={photo.id}
              className={`relative rounded-lg overflow-hidden bg-gray-100 ${
                idx === 0 ? "col-span-2 row-span-2" : ""
              }`}
              style={{ aspectRatio: idx === 0 ? "4/3" : "1/1" }}
            >
              <img
                src={photo.thumbnail_url || photo.image_url}
                alt={photo.alt_text || photo.caption || "大会写真"}
                className="w-full h-full object-cover transition-transform hover:scale-105"
                loading="lazy"
              />
              {/* キャプション（1枚目のみ表示） */}
              {idx === 0 && photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2.5">
                  <p className="text-white text-xs leading-snug line-clamp-2">{photo.caption}</p>
                </div>
              )}
              {/* カテゴリバッジ */}
              {idx > 0 && photo.image_type && TYPE_LABELS[photo.image_type] && (
                <div className="absolute top-1 left-1">
                  <span className="text-[9px] bg-black/40 text-white px-1.5 py-0.5 rounded">
                    {TYPE_LABELS[photo.image_type]}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* もっと見るタイル */}
          {hasMore && photosPath && (
            <Link
              href={photosPath}
              className="rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center hover:bg-gray-100 transition-colors"
              style={{ aspectRatio: "1/1" }}
            >
              <span className="text-lg text-gray-400 mb-1">📷</span>
              <span className="text-xs text-gray-500 font-medium">+{photoCount - 8}枚</span>
              <span className="text-[10px] text-blue-500 mt-0.5">もっと見る</span>
            </Link>
          )}
        </div>

        {/* ソース表記 */}
        {displayPhotos.some((p) => p.source_type) && (
          <p className="text-[10px] text-gray-400 mt-3">
            写真提供: {[...new Set(displayPhotos.map((p) => {
              switch (p.source_type) {
                case "official": return "公式";
                case "organizer": return "大会運営";
                case "user": return "参加者";
                case "editorial": return "編集部";
                default: return null;
              }
            }).filter(Boolean))].join("・")}
          </p>
        )}
      </div>
    </section>
  );
}
