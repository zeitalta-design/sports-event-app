import Link from "next/link";

/**
 * トップページ: 比較軸ページへの導線セクション
 * featureSummaries: [{ slug, shortTitle, description, icon, eventCount }]
 */
export default function TopFeatureNavigation({ features = [] }) {
  if (features.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold" style={{ color: "#323433" }}>
          条件で大会を探す
        </h2>
        <p className="text-xs font-medium mt-1" style={{ color: "#323433" }}>
          あなたに合った大会の探し方をお選びください
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {features.map((feat) => (
          <Link
            key={feat.slug}
            href={`/features/${feat.slug}`}
            className="block p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group text-center"
          >
            <span className="text-2xl block mb-2">{feat.icon}</span>
            <span className="font-bold text-sm group-hover:text-blue-600 transition-colors block mb-1" style={{ color: "#323433" }}>
              {feat.shortTitle}
            </span>
            {feat.eventCount > 0 && (
              <span className="text-xs font-medium" style={{ color: "#323433" }}>
                {feat.eventCount}件
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
