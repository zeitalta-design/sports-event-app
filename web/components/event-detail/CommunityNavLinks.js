import Link from "next/link";

/**
 * Phase197: コミュニティ導線リンク
 *
 * 大会詳細ページ下部に表示するコミュニティ関連の回遊リンク。
 * 口コミ・写真・結果・レポートへの導線をまとめて提供。
 */

export default function CommunityNavLinks({
  eventId,
  eventTitle,
  sportSlug = "marathon",
  reviewCount = 0,
  photoCount = 0,
  hasResults = false,
}) {
  const basePath = `/${sportSlug}/${eventId}`;

  const links = [
    reviewCount > 0 && {
      href: `${basePath}/reviews`,
      icon: "💬",
      label: `口コミ (${reviewCount})`,
      track: "community_nav_reviews",
    },
    photoCount > 0 && {
      href: `${basePath}/photos`,
      icon: "📸",
      label: `写真 (${photoCount})`,
      track: "community_nav_photos",
    },
    hasResults && {
      href: `${basePath}/results`,
      icon: "🏅",
      label: "大会結果",
      track: "community_nav_results",
    },
    {
      href: `/reviews/new?event_id=${eventId}&event_title=${encodeURIComponent(eventTitle || "")}`,
      icon: "✍️",
      label: "口コミを書く",
      track: "community_nav_write_review",
      accent: true,
    },
  ].filter(Boolean);

  if (links.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4" data-track="community_nav_view">
      {links.map((link) => (
        <Link
          key={link.track}
          href={link.href}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            link.accent
              ? "text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100"
              : "text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100"
          }`}
          data-track={link.track}
        >
          <span>{link.icon}</span>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
