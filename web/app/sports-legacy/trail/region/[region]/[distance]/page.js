import { notFound } from "next/navigation";
import { REGION_SLUGS, buildRegionDistanceMetadata } from "@/lib/seo-config";
import { TRAIL_DISTANCE_SLUGS } from "@/lib/seo-mappings";
import { getEventsByRegionAndDistance } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";

export async function generateMetadata({ params }) {
  const { region, distance } = await params;
  return buildRegionDistanceMetadata(region, distance, "trail");
}

export default async function TrailRegionDistancePage({ params }) {
  const { region, distance } = await params;
  const regionInfo = REGION_SLUGS[region];
  const distanceInfo = TRAIL_DISTANCE_SLUGS[distance];
  if (!regionInfo || !distanceInfo) notFound();

  let events = [];
  try {
    events = getEventsByRegionAndDistance(region, distance, "trail");
  } catch {}

  const relatedLinks = [];

  // 同地方の他距離
  for (const [dSlug, dInfo] of Object.entries(TRAIL_DISTANCE_SLUGS)) {
    if (dSlug !== distance) {
      relatedLinks.push({ label: `${regionInfo.label}の${dInfo.shortLabel}`, href: `/trail/region/${region}/${dSlug}` });
    }
  }

  // 他地方の同距離
  for (const [rSlug, rInfo] of Object.entries(REGION_SLUGS)) {
    if (rSlug !== region) {
      relatedLinks.push({ label: `${rInfo.label}の${distanceInfo.shortLabel}`, href: `/trail/region/${rSlug}/${distance}` });
    }
  }

  // テーマ・季節
  relatedLinks.push({ label: "初心者向け", href: "/trail/theme/beginner" });
  relatedLinks.push({ label: "募集中", href: "/trail/theme/open" });

  return (
    <SeoEventList
      title={`${regionInfo.label}の${distanceInfo.shortLabel}トレイルラン大会`}
      description={`${regionInfo.label}で開催される${distanceInfo.shortLabel}トレイルラン大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: "地方別", href: "/trail/region" },
        { label: regionInfo.label, href: `/trail/region/${region}` },
        { label: `${distanceInfo.shortLabel}大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref="/trail"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="region_distance"
      trackingSlug={`${region}_${distance}`}
      trackingSportType="trail"
    />
  );
}
