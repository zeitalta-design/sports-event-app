/**
 * Phase59: 検討時のポイントカード
 *
 * 締切・開催時期・受付状態などの判断シグナルを
 * 視覚的にわかりやすく表示する。サーバーコンポーネント。
 */

const TYPE_STYLES = {
  urgent: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-500",
    text: "text-red-700",
    label: "text-red-600",
  },
  caution: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "text-amber-500",
    text: "text-amber-700",
    label: "text-amber-600",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-500",
    text: "text-blue-700",
    label: "text-blue-600",
  },
  positive: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "text-green-500",
    text: "text-green-700",
    label: "text-green-600",
  },
};

function SignalIcon({ type }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.info;

  if (type === "urgent") {
    return (
      <svg
        className={`w-4 h-4 flex-shrink-0 ${style.icon}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (type === "caution") {
    return (
      <svg
        className={`w-4 h-4 flex-shrink-0 ${style.icon}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (type === "positive") {
    return (
      <svg
        className={`w-4 h-4 flex-shrink-0 ${style.icon}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  // info (default)
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 ${style.icon}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function EventDecisionSignalsCard({ signals, summary }) {
  if (!signals || signals.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-gray-900 mb-3">
        検討時のポイント
      </h2>

      {/* まとめ文 */}
      {summary && (
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">{summary}</p>
      )}

      {/* シグナル一覧 */}
      <div className="space-y-2">
        {signals.map((signal) => {
          const style = TYPE_STYLES[signal.type] || TYPE_STYLES.info;
          return (
            <div
              key={signal.key}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}
            >
              <SignalIcon type={signal.type} />
              <div className="min-w-0">
                <span
                  className={`text-xs font-semibold ${style.label}`}
                >
                  {signal.label}
                </span>
                <p className={`text-xs mt-0.5 ${style.text}`}>
                  {signal.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
