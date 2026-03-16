/**
 * Phase62: ダッシュボードセクション共通ラッパー
 *
 * タイトル + カードグリッドをセクション単位で表示。
 * 「もっと見る」リンク付き。
 */

import Link from "next/link";
import DashboardEventCard from "./DashboardEventCard";

export default function DashboardSection({
  title,
  icon,
  events,
  moreHref,
  moreLabel = "もっと見る",
  emptyText = "該当する大会がありません",
  showDeadline = true,
  columns = 2,
}) {
  if (!events || events.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400">{emptyText}</p>
        </div>
      </section>
    );
  }

  const gridClass =
    columns === 3
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      : "grid grid-cols-1 sm:grid-cols-2 gap-4";

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        {moreHref && (
          <Link
            href={moreHref}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            {moreLabel} →
          </Link>
        )}
      </div>
      <div className={gridClass}>
        {events.map((event) => (
          <DashboardEventCard
            key={event.id}
            event={event}
            showDeadline={showDeadline}
          />
        ))}
      </div>
    </section>
  );
}
