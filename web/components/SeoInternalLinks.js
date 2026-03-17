import Link from "next/link";

/**
 * Phase233: SEO内部リンクセクション
 *
 * 重点ページに配置する内部リンク集。
 * 検索エンジンのクロール効率と内部PageRank配分を最適化。
 */

const LINK_GROUPS = {
  marathon: {
    title: "マラソン大会を探す",
    links: [
      { label: "マラソン大会一覧", href: "/marathon" },
      { label: "フルマラソン", href: "/marathon/distance/full" },
      { label: "ハーフマラソン", href: "/marathon/distance/half" },
      { label: "10km大会", href: "/marathon/distance/10km" },
      { label: "初心者向け", href: "/marathon/theme/beginner" },
      { label: "募集中", href: "/marathon/theme/open" },
      { label: "人気の大会", href: "/marathon/theme/popular" },
      { label: "締切間近", href: "/marathon/theme/deadline" },
    ],
  },
  region: {
    title: "地方で探す",
    links: [
      { label: "関東", href: "/marathon/region/kanto" },
      { label: "近畿", href: "/marathon/region/kinki" },
      { label: "中部", href: "/marathon/region/chubu" },
      { label: "九州・沖縄", href: "/marathon/region/kyushu" },
      { label: "東北", href: "/marathon/region/tohoku" },
      { label: "北海道", href: "/marathon/region/hokkaido" },
      { label: "中国", href: "/marathon/region/chugoku" },
      { label: "四国", href: "/marathon/region/shikoku" },
    ],
  },
  season: {
    title: "季節・月で探す",
    links: [
      { label: "春の大会", href: "/marathon/season/spring" },
      { label: "秋の大会", href: "/marathon/season/autumn" },
      { label: "冬の大会", href: "/marathon/season/winter" },
      { label: "夏の大会", href: "/marathon/season/summer" },
      { label: "大会カレンダー", href: "/calendar" },
      { label: "月別一覧", href: "/marathon/month" },
    ],
  },
  features: {
    title: "便利な機能",
    links: [
      { label: "大会ランキング", href: "/rankings" },
      { label: "人気大会", href: "/popular" },
      { label: "エントリー締切", href: "/entry-deadlines" },
      { label: "次の大会を探す", href: "/next-race" },
      { label: "大会カレンダー", href: "/calendar" },
    ],
  },
};

/**
 * @param {string[]} groups - 表示するグループキー配列 (例: ["marathon", "region"])
 * @param {string} [exclude] - 除外するhrefパス
 */
export default function SeoInternalLinks({ groups = ["marathon", "region", "season"], exclude }) {
  const selectedGroups = groups
    .map((key) => LINK_GROUPS[key])
    .filter(Boolean);

  if (selectedGroups.length === 0) return null;

  return (
    <nav className="mt-10 pt-8 border-t border-gray-100" aria-label="関連リンク">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {selectedGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.links
                .filter((link) => link.href !== exclude)
                .map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
