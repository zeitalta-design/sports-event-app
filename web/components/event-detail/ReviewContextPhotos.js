/**
 * Phase162: 口コミ＋写真の接続コンポーネント
 *
 * 口コミセクション近くに、口コミ内容に関連する写真を表示。
 * - 「景色が良い」→ scenery写真
 * - 「コースが走りやすい」→ course写真
 * - 「会場がきれい」→ venue写真
 *
 * 軽量な接続: reviewInsightsから推定して関連写真を選ぶ。
 */

const INSIGHT_PHOTO_MAP = {
  beginner_friendly: ["venue", "start", "crowd"],
  course_quality: ["course", "scenery"],
  access_note: ["venue"],
  venue_quality: ["venue"],
  high_satisfaction: ["scenery", "finish", "crowd"],
  repeater_rate: ["course", "scenery"],
};

export default function ReviewContextPhotos({ reviewInsights, galleryGrouped }) {
  if (!reviewInsights?.length || !galleryGrouped) return null;

  // insightに基づいて関連写真を抽出
  const relevantTypes = new Set();
  for (const insight of reviewInsights) {
    const types = INSIGHT_PHOTO_MAP[insight.type] || [];
    types.forEach((t) => relevantTypes.add(t));
  }

  const contextPhotos = [];
  for (const type of relevantTypes) {
    if (galleryGrouped[type]) {
      contextPhotos.push(...galleryGrouped[type].slice(0, 1));
    }
    if (contextPhotos.length >= 3) break;
  }

  if (contextPhotos.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
        <span>📸</span> 口コミに関連する写真
      </p>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {contextPhotos.map((photo) => (
          <div
            key={photo.id}
            className="flex-shrink-0 w-24 h-18 rounded-lg overflow-hidden bg-gray-100"
            style={{ aspectRatio: "4/3", width: "96px" }}
          >
            <img
              src={photo.thumbnail_url || photo.image_url}
              alt={photo.alt_text || photo.caption || "関連写真"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
