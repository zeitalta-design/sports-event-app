import { notFound } from "next/navigation";
import { TRAIL_THEME_SLUGS, buildThemeMetadata, buildThemeRelatedLinks } from "@/lib/seo-config";
import { getEventsByTheme } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";
import SeoCirculationSection from "@/components/seo/SeoCirculationSection";
import SportSwitcher from "@/components/seo/SportSwitcher";

export async function generateMetadata({ params }) {
  const { theme } = await params;
  return buildThemeMetadata(theme, "trail");
}

export default async function TrailThemePage({ params }) {
  const { theme } = await params;
  const info = TRAIL_THEME_SLUGS[theme];
  if (!info) notFound();

  let events = [];
  try {
    // "scenic" テーマはtrail専用 → seo-queriesで "sightseeing" 相当の検索
    const queryTheme = theme === "scenic" ? "sightseeing" : theme;
    events = getEventsByTheme(queryTheme, "trail");
  } catch {}

  const relatedLinks = buildThemeRelatedLinks(theme, "trail");

  const circulationLinks = [
    { label: "地方別で探す", href: "/trail/region" },
    { label: "季節別で探す", href: "/trail/season" },
    { label: "距離別で探す", href: "/trail/distance" },
  ];

  return (
    <SeoEventList
      title={info.label}
      description={info.filterDescription}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: "テーマ別", href: "/trail/theme" },
        { label: info.shortLabel },
      ]}
      events={events}
      total={events.length}
      ctaHref="/trail"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="theme"
      trackingSlug={theme}
      trackingSportType="trail"
    >
      <SeoCirculationSection categoryLinks={circulationLinks} sportType="trail" sportSlug="trail" />
      {["open", "deadline", "popular", "beginner"].includes(theme) && (
        <SportSwitcher currentSportSlug="trail" category="theme" slug={theme} />
      )}
    </SeoEventList>
  );
}
