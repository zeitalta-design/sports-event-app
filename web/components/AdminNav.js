"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Phase216: 管理ナビゲーション最適化
 *
 * グループ化 + スクロール対応 + 品質管理統合タブ追加
 */

const TAB_GROUPS = [
  {
    label: "データ管理",
    tabs: [
      { href: "/admin/events", label: "大会" },
      { href: "/admin/marathon-details/import", label: "取込" },
      { href: "/admin/marathon-details", label: "詳細" },
      { href: "/admin/reviews", label: "口コミ" },
      { href: "/admin/photos", label: "写真" },
      { href: "/admin/results", label: "結果" },
      { href: "/admin/source-merge", label: "ソース統合" },
    ],
  },
  {
    label: "品質・分析",
    tabs: [
      { href: "/admin/quality", label: "品質管理" },
      { href: "/admin/data-growth", label: "成長KPI" },
      { href: "/admin/event-metrics", label: "指標" },
      { href: "/admin/verification-conflicts", label: "相互検証" },
      { href: "/admin/merge-verification", label: "統合検証" },
      { href: "/admin/analytics", label: "分析" },
    ],
  },
  {
    label: "運用",
    tabs: [
      { href: "/admin/organizer-requests", label: "運営依頼" },
      { href: "/admin/event-notifications", label: "通知" },
      { href: "/admin/jobs", label: "ジョブ" },
      { href: "/admin/emails", label: "メール" },
      { href: "/admin/hero-images", label: "ヒーロー画像" },
      { href: "/admin/launch-check", label: "公開チェック" },
      { href: "/admin/post-launch", label: "公開後" },
      { href: "/admin/ops-guide", label: "運用ガイド" },
    ],
  },
];

// フラットなタブ配列（マッチング用）
const ALL_TABS = TAB_GROUPS.flatMap((g) => g.tabs);

export default function AdminNav() {
  const pathname = usePathname();

  const sortedTabs = [...ALL_TABS].sort(
    (a, b) => b.href.length - a.href.length
  );

  function getIsActive(tab) {
    const matched = sortedTabs.find(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/")
    );
    return matched?.href === tab.href;
  }

  return (
    <div className="border-b mb-6 overflow-x-auto">
      <nav className="flex gap-0 min-w-max">
        {TAB_GROUPS.map((group, gi) => (
          <div key={gi} className="flex items-center">
            {gi > 0 && <div className="w-px h-5 bg-gray-200 mx-1" />}
            {group.tabs.map((tab) => {
              const isActive = getIsActive(tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
