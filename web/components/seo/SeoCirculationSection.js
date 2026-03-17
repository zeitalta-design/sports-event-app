import Link from "next/link";
import { getPopularEvents, getDeadlineEvents } from "@/lib/seo-queries";
import { getEventDetailPath } from "@/lib/sport-config";

function formatDate(dateStr) {
  if (!dateStr) return "日程未定";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function MiniEventCard({ event }) {
  return (
    <Link
      href={getEventDetailPath(event)}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
        <p className="text-xs text-gray-500">
          {formatDate(event.event_date)} / {event.prefecture || "エリア未定"}
        </p>
      </div>
      {event.entry_status === "open" && (
        <span className="shrink-0 text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded">受付中</span>
      )}
    </Link>
  );
}

/**
 * Phase114: SEOページ内回遊強化セクション
 * Server Component — 人気大会・締切間近・カテゴリ導線を表示
 */
export default function SeoCirculationSection({
  categoryLinks = [],
  sportType = "marathon",
  sportSlug = "marathon",
}) {
  let popularEvents = [];
  let deadlineEvents = [];
  try {
    popularEvents = getPopularEvents(3, sportType);
    deadlineEvents = getDeadlineEvents(3, sportType);
  } catch {}

  const hasPopular = popularEvents.length > 0;
  const hasDeadline = deadlineEvents.length > 0;
  const hasCategory = categoryLinks.length > 0;

  if (!hasPopular && !hasDeadline && !hasCategory) return null;

  return (
    <div className="mt-10 pt-8 border-t border-gray-100 space-y-8">
      {/* 人気大会 */}
      {hasPopular && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">人気の大会</h2>
            <Link href={`/${sportSlug}/theme/popular`} className="text-xs text-blue-600 hover:underline">
              もっと見る →
            </Link>
          </div>
          <div className="card divide-y divide-gray-50">
            {popularEvents.map((event) => (
              <MiniEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* 締切間近 */}
      {hasDeadline && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">締切間近の大会</h2>
            <Link href={`/${sportSlug}/theme/deadline`} className="text-xs text-blue-600 hover:underline">
              もっと見る →
            </Link>
          </div>
          <div className="card divide-y divide-gray-50">
            {deadlineEvents.map((event) => (
              <MiniEventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* 関連カテゴリ */}
      {hasCategory && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">他の条件で探す</h2>
          <div className="flex flex-wrap gap-2">
            {categoryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                           rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 保存・比較導線 */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/saved-searches"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
        >
          <span>🔖</span> 保存した条件を見る
        </Link>
        <Link
          href="/compare"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
        >
          <span>📊</span> 比較リストを見る
        </Link>
        <Link
          href="/favorites"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
        >
          <span>❤️</span> お気に入りを見る
        </Link>
      </div>
    </div>
  );
}
