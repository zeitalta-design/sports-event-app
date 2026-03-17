/**
 * Phase142: 口コミ要約UI
 *
 * 口コミの全件を読まなくても大会の雰囲気が伝わるカード。
 * ルールベースで生成した insights を表示。
 */

const INSIGHT_STYLES = {
  positive: "bg-green-50 border-green-200 text-green-800",
  caution: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

export default function ReviewInsightsCard({ insights = [] }) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-800 mb-3">参加者の声から</h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info}`}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{insight.text}</p>
              {insight.detail && (
                <p className="text-xs opacity-70 mt-0.5">{insight.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
