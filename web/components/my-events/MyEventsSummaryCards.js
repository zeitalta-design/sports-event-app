import Link from "next/link";

/**
 * Phase61+100: マイ大会サマリーカード
 *
 * 保存中/比較中/見直し推奨 + ステータス別の件数を一目で把握。
 */

export default function MyEventsSummaryCards({ counts, statusCounts = {} }) {
  if (!counts) return null;

  const enteredCount = statusCounts.entered || 0;
  const consideringCount = statusCounts.considering || 0;
  const plannedCount = statusCounts.planned || 0;

  const items = [
    {
      key: "saved",
      label: "保存中",
      count: counts.saved,
      href: "/saved",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
        </svg>
      ),
    },
    {
      key: "entered",
      label: "エントリー済み",
      count: enteredCount,
      href: null,
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      icon: <span className="text-sm">✅</span>,
    },
    {
      key: "alert",
      label: "見直し推奨",
      count: (counts.alertHigh || 0) + (counts.alertMedium || 0),
      href: "/alerts",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => {
        const Wrapper = item.href ? Link : "div";
        const wrapperProps = item.href
          ? { href: item.href }
          : {};
        return (
          <Wrapper
            key={item.key}
            {...wrapperProps}
            className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border ${item.bg} ${item.border} hover:shadow-sm transition-shadow`}
          >
            <span className={item.text}>{item.icon}</span>
            <div>
              <p className={`text-lg font-bold leading-none ${item.text}`}>
                {item.count}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">{item.label}</p>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
