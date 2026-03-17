/**
 * Phase194: 大会エンゲージメントバー
 *
 * 大会詳細ページに表示する注目度インジケーター。
 * お気に入り数・口コミ数・結果数・写真数を可視化。
 */

const COLOR_MAP = {
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  gray: "bg-gray-50 border-gray-200 text-gray-600",
};

export default function EventEngagementBar({ engagement }) {
  if (!engagement || !engagement.level) return null;

  const { favoriteCount, reviewCount, resultCount, photoCount, level } = engagement;
  const colorClass = COLOR_MAP[level.color] || COLOR_MAP.gray;

  const stats = [
    favoriteCount > 0 && { label: "お気に入り", value: favoriteCount, icon: "❤️" },
    reviewCount > 0 && { label: "口コミ", value: reviewCount, icon: "💬" },
    resultCount > 0 && { label: "結果", value: resultCount, icon: "🏅" },
    photoCount > 0 && { label: "写真", value: photoCount, icon: "📷" },
  ].filter(Boolean);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${colorClass}`}
      data-track="engagement_bar_view"
    >
      <span className="text-sm flex-shrink-0">{level.icon}</span>
      <span className="text-xs font-bold flex-shrink-0">{level.label}</span>

      {stats.length > 0 && (
        <>
          <span className="text-gray-300">|</span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {stats.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-0.5 text-xs opacity-80">
                <span className="text-[10px]">{s.icon}</span>
                <span className="tabular-nums font-medium">{s.value}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
