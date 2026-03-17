"use client";

import Link from "next/link";
import { trackEvent, EVENTS } from "@/lib/analytics";

const searches = [
  { label: "フルマラソン", href: "/marathon/distance/full" },
  { label: "ハーフマラソン", href: "/marathon/distance/half" },
  { label: "10km", href: "/marathon/distance/10km" },
  { label: "5km以下", href: "/marathon/distance/5km" },
  { label: "東京都", href: "/marathon/prefecture/tokyo" },
  { label: "神奈川県", href: "/marathon/prefecture/kanagawa" },
  { label: "大阪府", href: "/marathon/prefecture/osaka" },
  { label: "千葉県", href: "/marathon/prefecture/chiba" },
  { label: "埼玉県", href: "/marathon/prefecture/saitama" },
  { label: "4月開催", href: "/marathon/month/4" },
  { label: "5月開催", href: "/marathon/month/5" },
  { label: "6月開催", href: "/marathon/month/6" },
  { label: "秋開催（10月）", href: "/marathon/month/10" },
  { label: "秋開催（11月）", href: "/marathon/month/11" },
];

export default function TopPopularSearches() {
  function handleChipClick(label, href) {
    trackEvent(EVENTS.TOP_POPULAR_CHIP, { label, href });
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-lg font-bold mb-2" style={{ color: "#1a1a1a" }}>人気の条件から探す</h2>
      <p className="text-xs font-medium mb-5" style={{ color: "#1a1a1a" }}>よく検索される条件でマラソン大会を探せます</p>
      <div className="flex flex-wrap gap-2">
        {searches.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            onClick={() => handleChipClick(s.label, s.href)}
            className="inline-block px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-full
                       hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* カテゴリ別リンク */}
      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        <Link href="/marathon/prefecture" className="text-blue-600 hover:text-blue-800 hover:underline">
          都道府県別一覧 →
        </Link>
        <Link href="/marathon/distance" className="text-blue-600 hover:text-blue-800 hover:underline">
          距離別一覧 →
        </Link>
        <Link href="/marathon/month" className="text-blue-600 hover:text-blue-800 hover:underline">
          月別一覧 →
        </Link>
      </div>
    </section>
  );
}
