/**
 * 大会概要セクション
 * tagline + summary + description を表示
 * Phase 26: テキストサイズ・行間・段落分割を改善
 */
export default function MarathonDetailOverview({ data }) {
  const hasSummary = data.summary || data.description;
  if (!hasSummary) return null;

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">大会概要</h2>
      {data.summary && (
        <div className="space-y-4">
          {data.summary.split("\n\n").map((paragraph, i) => (
            <p
              key={i}
              className="text-base text-gray-700 leading-[1.9] whitespace-pre-wrap"
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {data.description && !data.summary && (
        <div className="space-y-4">
          {data.description.split("\n\n").map((paragraph, i) => (
            <p
              key={i}
              className="text-base text-gray-800 leading-[1.9] whitespace-pre-wrap"
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {data.description && data.summary && (
        <details className="mt-4">
          <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 font-medium">
            掲載元の説明を見る
          </summary>
          <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
            {data.description.split("\n\n").map((paragraph, i) => (
              <p
                key={i}
                className="text-sm text-gray-600 leading-[1.8] whitespace-pre-wrap"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
