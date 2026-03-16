/**
 * Phase57: 比較メモカード
 *
 * 距離バリエーション・サービス充実度・情報充実度・開催時期を
 * ルールベースで「多い/標準/少ない」等の相対評価として表示する。
 *
 * 誇張せず、控えめな文言で「この大会の相対的な特徴」を伝える。
 */

const TONE_STYLES = {
  good: {
    valueBg: "bg-green-50",
    valueText: "text-green-700",
    valueBorder: "border-green-200",
  },
  neutral: {
    valueBg: "bg-gray-50",
    valueText: "text-gray-700",
    valueBorder: "border-gray-200",
  },
  low: {
    valueBg: "bg-amber-50",
    valueText: "text-amber-600",
    valueBorder: "border-amber-200",
  },
};

export default function EventComparisonCard({ comparison }) {
  if (!comparison?.items || comparison.items.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-gray-900 mb-4">
        この大会の特徴まとめ
      </h2>
      <div className="space-y-3">
        {comparison.items.map((item, i) => {
          const style = TONE_STYLES[item.tone] || TONE_STYLES.neutral;
          return (
            <div
              key={i}
              className="flex items-center gap-3"
            >
              {/* ラベル */}
              <span className="text-xs text-gray-500 whitespace-nowrap min-w-[6.5rem] flex-shrink-0">
                {item.label}
              </span>
              {/* 値バッジ */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 text-sm font-semibold rounded-md border ${style.valueBg} ${style.valueText} ${style.valueBorder}`}
              >
                {item.value}
              </span>
              {/* 補足 */}
              <span className="text-xs text-gray-400 hidden sm:inline">
                {item.note}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-300 mt-3 leading-relaxed">
        ※ 掲載情報から算出した参考値です
      </p>
    </section>
  );
}
