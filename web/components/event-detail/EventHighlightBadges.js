/**
 * Phase57: この大会の特徴バッジ
 *
 * 「フルあり」「初心者向け」「参加賞あり」「計測あり」など
 * 大会の魅力ポイントをchip/badge形式で一覧表示する。
 * DBの生データではなく、解釈済みの特徴ラベルとして見せる。
 */

/**
 * バッジのカテゴリ別スタイル定義
 * key の先頭パターンで判定する
 */
const BADGE_STYLES = {
  // 距離系: blue
  full: "bg-blue-50 text-blue-700 border-blue-200",
  half: "bg-blue-50 text-blue-700 border-blue-200",
  ultra: "bg-blue-50 text-blue-700 border-blue-200",
  // 競技系: indigo
  certified: "bg-indigo-50 text-indigo-700 border-indigo-200",
  pacer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
  // ユーザー系: green
  beginner: "bg-green-50 text-green-700 border-green-200",
  family: "bg-green-50 text-green-700 border-green-200",
  // サービス系: amber
  souvenir: "bg-amber-50 text-amber-700 border-amber-200",
  record: "bg-amber-50 text-amber-700 border-amber-200",
  changing_room: "bg-amber-50 text-amber-700 border-amber-200",
  baggage: "bg-amber-50 text-amber-700 border-amber-200",
  shower: "bg-amber-50 text-amber-700 border-amber-200",
  parking: "bg-amber-50 text-amber-700 border-amber-200",
  // 時期系: red/orange
  near_deadline: "bg-red-50 text-red-700 border-red-200",
  soon: "bg-orange-50 text-orange-700 border-orange-200",
  // その他
  access: "bg-teal-50 text-teal-700 border-teal-200",
  trail: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const DEFAULT_STYLE = "bg-gray-50 text-gray-700 border-gray-200";

export default function EventHighlightBadges({ highlights }) {
  if (!highlights?.badges || highlights.badges.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-gray-900 mb-3">
        この大会の特徴
      </h2>
      <div className="flex flex-wrap gap-2">
        {highlights.badges.map((badge) => {
          const style = BADGE_STYLES[badge.key] || DEFAULT_STYLE;
          return (
            <span
              key={badge.key}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border ${style}`}
            >
              {badge.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
