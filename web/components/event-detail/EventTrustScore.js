/**
 * Phase188: 大会信頼スコア表示コンポーネント
 *
 * 大会詳細ページで信頼スコアを視覚化。
 * Server Component — サーバーサイドでスコア算出済みデータを受け取る。
 */

const BREAKDOWN_LABELS = {
  reviewCount: { label: "口コミ件数", icon: "💬" },
  reviewRating: { label: "口コミ評価", icon: "⭐" },
  photoCount: { label: "写真", icon: "📸" },
  hasResults: { label: "結果掲載", icon: "📊" },
  organizerVerified: { label: "運営確認", icon: "✅" },
  eventHistory: { label: "開催実績", icon: "📅" },
};

export default function EventTrustScore({ trustScore }) {
  if (!trustScore || trustScore.score === undefined) return null;

  const { score, label, color, breakdown } = trustScore;
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="card p-5" data-track="trust_score_view">
      <h3 className="text-sm font-bold text-gray-700 mb-3">大会の信頼度</h3>

      <div className="flex items-center gap-5">
        {/* 円形スコアゲージ */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#9ca3af"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-gray-900">{score}</span>
            <span className="text-[9px] text-gray-400">/100</span>
          </div>
        </div>

        {/* 内訳 */}
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border mb-2 ${color}`}>
            {label}
          </span>
          <div className="space-y-1">
            {Object.entries(BREAKDOWN_LABELS).map(([key, meta]) => {
              const item = breakdown[key];
              if (!item) return null;
              const pct = item.max > 0 ? (item.points / item.max) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-[10px] w-4 text-center">{meta.icon}</span>
                  <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">{meta.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 w-6 text-right tabular-nums">
                    {item.points}/{item.max}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * コンパクト版（カード・ランキング用）
 */
export function TrustScoreBadge({ score, label, color }) {
  if (score === undefined || score === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${color || "text-gray-500 bg-gray-50 border-gray-200"}`}
      title={`信頼スコア: ${score}/100`}
    >
      <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3.003 3.003 0 00-3.75-3.751 3 3 0 00-5.305 0 3.003 3.003 0 00-3.751 3.75 3 3 0 000 5.305 3.003 3.003 0 003.75 3.751 3 3 0 005.305 0 3.003 3.003 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      {score}
    </span>
  );
}
