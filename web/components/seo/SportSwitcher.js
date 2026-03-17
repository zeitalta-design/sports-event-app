import Link from "next/link";
import { getEnabledSports } from "@/lib/sport-config";

/**
 * Phase121: クロススポーツナビゲーション
 * SEOページ内で同じカテゴリの他スポーツページへ導線を表示
 *
 * 例: /marathon/region/kanto → 「トレイルランの関東大会を見る」
 */
export default function SportSwitcher({ currentSportSlug, category, slug }) {
  const enabledSports = getEnabledSports();
  const otherSports = enabledSports.filter((s) => s.slug !== currentSportSlug);

  if (otherSports.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2">他のスポーツで同じ条件を見る</p>
      <div className="flex flex-wrap gap-2">
        {otherSports.map((sport) => {
          const href = slug
            ? `/${sport.slug}/${category}/${slug}`
            : `/${sport.slug}/${category}`;
          return (
            <Link
              key={sport.key}
              href={href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200
                         rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
            >
              <span>{sport.icon}</span>
              <span>{sport.shortLabel || sport.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
