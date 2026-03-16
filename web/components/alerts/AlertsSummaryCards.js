/**
 * Phase102: 通知サマリーカード（強化版）
 *
 * 通知候補の件数を重要度別に表示 + 未読/ピン件数。
 */

export default function AlertsSummaryCards({ counts, unreadCount = 0, pinnedCount = 0 }) {
  if (!counts || counts.total === 0) return null;

  const items = [
    {
      key: "high",
      label: "要確認",
      count: counts.high,
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      key: "medium",
      label: "注意",
      count: counts.medium,
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      key: "low",
      label: "確認推奨",
      count: counts.low,
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ];

  // 件数が0のカテゴリは非表示
  const visible = items.filter((item) => item.count > 0);

  // 未読・ピンカード追加
  const extraCards = [];
  if (unreadCount > 0) {
    extraCards.push({
      key: "unread",
      label: "未読",
      count: unreadCount,
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-600",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      ),
    });
  }
  if (pinnedCount > 0) {
    extraCards.push({
      key: "pinned",
      label: "ピン留め",
      count: pinnedCount,
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-600",
      icon: <span className="text-sm">⭐</span>,
    });
  }

  const allCards = [...visible, ...extraCards];
  if (allCards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {allCards.map((item) => (
        <div
          key={item.key}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border ${item.bg} ${item.border}`}
        >
          <span className={item.text}>{item.icon}</span>
          <div>
            <p className={`text-lg font-bold ${item.text}`}>{item.count}</p>
            <p className="text-xs text-gray-500">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
