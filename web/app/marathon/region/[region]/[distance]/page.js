import { notFound } from "next/navigation";
import { REGION_SLUGS, buildRegionDistanceMetadata } from "@/lib/seo-config";
import { DISTANCE_SLUGS } from "@/lib/seo-mappings";
import { getEventsByRegionAndDistance } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";

export async function generateMetadata({ params }) {
  const { region, distance } = await params;
  return buildRegionDistanceMetadata(region, distance);
}

export default async function RegionDistancePage({ params }) {
  const { region, distance } = await params;
  const regionInfo = REGION_SLUGS[region];
  const distanceInfo = DISTANCE_SLUGS[distance];
  if (!regionInfo || !distanceInfo) notFound();

  let events = [];
  try {
    events = getEventsByRegionAndDistance(region, distance);
  } catch {}

  // 関連リンク
  const relatedLinks = [];

  // 同地方の他距離
  for (const [dSlug, dInfo] of Object.entries(DISTANCE_SLUGS)) {
    if (dSlug !== distance) {
      relatedLinks.push({ label: `${regionInfo.label}の${dInfo.label}`, href: `/marathon/region/${region}/${dSlug}` });
    }
  }

  // 他地方の同距離
  for (const [rSlug, rInfo] of Object.entries(REGION_SLUGS)) {
    if (rSlug !== region) {
      relatedLinks.push({ label: `${rInfo.label}の${distanceInfo.label}`, href: `/marathon/region/${rSlug}/${distance}` });
    }
  }

  // 地方トップ・距離トップ
  relatedLinks.push({ label: `${regionInfo.label}の全大会`, href: `/marathon/region/${region}` });
  relatedLinks.push({ label: `全国の${distanceInfo.label}`, href: `/marathon/distance/${distance}` });

  return (
    <SeoEventList
      title={`${regionInfo.label}の${distanceInfo.label}大会`}
      description={`${regionInfo.label}で開催される${distanceInfo.label}大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: "地方別", href: "/marathon/region" },
        { label: regionInfo.label, href: `/marathon/region/${region}` },
        { label: `${distanceInfo.label}大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref="/marathon"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
    />
  );
}
