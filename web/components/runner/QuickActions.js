/**
 * Phase62: クイックアクション
 *
 * ダッシュボードからの主要アクション導線。
 */

import Link from "next/link";

const ACTIONS = [
  {
    href: "/marathon",
    icon: "🏃",
    label: "マラソン大会を探す",
    color: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    href: "/trail",
    icon: "⛰️",
    label: "トレイル大会を探す",
    color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200",
  },
  {
    href: "/compare",
    icon: "⚖️",
    label: "比較表を見る",
    color: "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200",
  },
  {
    href: "/calendar",
    icon: "📅",
    label: "カレンダーで探す",
    color: "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex items-center gap-2 px-3 py-3 border rounded-xl text-sm font-medium transition-colors ${action.color}`}
        >
          <span className="text-lg">{action.icon}</span>
          <span className="text-xs sm:text-sm leading-tight">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
