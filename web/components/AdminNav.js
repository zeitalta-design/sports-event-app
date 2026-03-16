"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/jobs", label: "日次ジョブ" },
  { href: "/admin/emails", label: "メールキュー" },
  { href: "/admin/events", label: "大会管理" },
  { href: "/admin/marathon-details/import", label: "取込" },
  { href: "/admin/marathon-details", label: "詳細情報" },
  { href: "/admin/event-notifications", label: "通知管理" },
  { href: "/admin/verification-conflicts", label: "相互検証" },
];

export default function AdminNav() {
  const pathname = usePathname();

  // 長いパスから順にマッチさせるため降順ソート
  const sortedTabs = [...TABS].sort(
    (a, b) => b.href.length - a.href.length
  );

  function getIsActive(tab) {
    // 最も長くマッチするタブを探す
    const matched = sortedTabs.find(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/")
    );
    return matched?.href === tab.href;
  }

  return (
    <div className="border-b mb-6">
      <nav className="flex gap-0">
        {TABS.map((tab) => {
          const isActive = getIsActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
