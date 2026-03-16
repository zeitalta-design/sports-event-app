import Link from "next/link";

/**
 * Phase61: ページ間相互導線
 *
 * saved / compare / alerts / my-events の相互リンクを提供する。
 * currentPage で現在ページを指定し、それ以外へのリンクを表示。
 */

const ALL_LINKS = [
  { key: "my-events", href: "/my-events", label: "検討中の大会" },
  { key: "saved", href: "/saved", label: "あとで見る" },
  { key: "compare", href: "/compare", label: "比較表" },
  { key: "alerts", href: "/alerts", label: "見直しリスト" },
];

export default function CrossNavLinks({ currentPage }) {
  const links = ALL_LINKS.filter((l) => l.key !== currentPage);

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {link.label}
        </Link>
      ))}
      <Link
        href="/marathon"
        className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
      >
        大会を探す
      </Link>
    </div>
  );
}
