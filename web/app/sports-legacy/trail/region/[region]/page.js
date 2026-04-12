import { notFound } from "next/navigation";
import { REGION_SLUGS, buildRegionMetadata, getPrefecturesByRegion, TRAIL_THEME_SLUGS } from "@/lib/seo-config";
import { TRAIL_DISTANCE_SLUGS, PREFECTURE_NAME_TO_SLUG } from "@/lib/seo-mappings";
import { getEventsByRegion } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";
import SeoCirculationSection from "@/components/seo/SeoCirculationSection";
import SportSwitcher from "@/components/seo/SportSwitcher";

export async function generateMetadata({ params }) {
  const { region } = await params;
  return buildRegionMetadata(region, "trail");
}

export default async function TrailRegionPage({ params }) {
  const { region } = await params;
  const info = REGION_SLUGS[region];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsByRegion(region, "trail");
  } catch {}

  const relatedLinks = [];

  // 該当地方の県別ページ
  const prefNames = getPrefecturesByRegion(region);
  for (const name of prefNames) {
    const slug = PREFECTURE_NAME_TO_SLUG[name];
    if (slug) {
      relatedLinks.push({ label: `${name}の大会`, href: `/trail/prefecture/${slug}` });
    }
  }

  // 地方×距離クロスページ
  for (const [dSlug, dInfo] of Object.entries(TRAIL_DISTANCE_SLUGS)) {
    relatedLinks.push({ label: `${info.label}の${dInfo.shortLabel}`, href: `/trail/region/${region}/${dSlug}` });
  }

  // 他地方
  for (const [slug, rInfo] of Object.entries(REGION_SLUGS)) {
    if (slug !== region) {
      relatedLinks.push({ label: `${rInfo.label}の大会`, href: `/trail/region/${slug}` });
    }
  }

  const circulationLinks = [
    { label: "季節別で探す", href: "/trail/season" },
    { label: "テーマ別で探す", href: "/trail/theme" },
    { label: "距離別で探す", href: "/trail/distance" },
  ];

  return (
    <SeoEventList
      title={`${info.label}のトレイルラン大会`}
      description={`${info.label}で開催されるトレイルラン大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: "地方別", href: "/trail/region" },
        { label: `${info.label}のトレイルラン大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref="/trail"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="region"
      trackingSlug={region}
      trackingSportType="trail"
    >
      <SeoCirculationSection categoryLinks={circulationLinks} sportType="trail" sportSlug="trail" />
      <SportSwitcher currentSportSlug="trail" category="region" slug={region} />
    </SeoEventList>
  );
}
