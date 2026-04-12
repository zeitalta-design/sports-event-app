import { notFound } from "next/navigation";
import { REGION_SLUGS, buildRegionMetadata, buildRegionRelatedLinks, getPrefecturesByRegion } from "@/lib/seo-config";
import { DISTANCE_SLUGS, PREFECTURE_SLUGS, PREFECTURE_NAME_TO_SLUG } from "@/lib/seo-mappings";
import { getEventsByRegion } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";
import SeoCirculationSection from "@/components/seo/SeoCirculationSection";
import SportSwitcher from "@/components/seo/SportSwitcher";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { region } = await params;
  return buildRegionMetadata(region);
}

export default async function RegionPage({ params }) {
  const { region } = await params;
  const info = REGION_SLUGS[region];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsByRegion(region);
  } catch {}

  // 関連リンク: 県別ページ + 距離別 + 地方×距離クロス
  const relatedLinks = [];

  // 該当地方の県別ページ
  const prefNames = getPrefecturesByRegion(region);
  for (const name of prefNames) {
    const slug = PREFECTURE_NAME_TO_SLUG[name];
    if (slug) {
      relatedLinks.push({ label: `${name}の大会`, href: `/marathon/prefecture/${slug}` });
    }
  }

  // 地方×距離クロスページ
  for (const [dSlug, dInfo] of Object.entries(DISTANCE_SLUGS)) {
    relatedLinks.push({ label: `${info.label}の${dInfo.label}`, href: `/marathon/region/${region}/${dSlug}` });
  }

  // 他地方
  for (const [slug, rInfo] of Object.entries(REGION_SLUGS)) {
    if (slug !== region) {
      relatedLinks.push({ label: `${rInfo.label}の大会`, href: `/marathon/region/${slug}` });
    }
  }

  // 回遊用カテゴリリンク
  const circulationLinks = [
    { label: "季節別で探す", href: "/marathon/season" },
    { label: "テーマ別で探す", href: "/marathon/theme" },
    { label: "距離別で探す", href: "/marathon/distance" },
  ];

  return (
    <SeoEventList
      title={`${info.label}のマラソン大会`}
      description={`${info.label}で開催されるマラソン大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: "地方別", href: "/marathon/region" },
        { label: `${info.label}のマラソン大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref="/marathon"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="region"
      trackingSlug={region}
    >
      <SeoCirculationSection categoryLinks={circulationLinks} />
      <SportSwitcher currentSportSlug="marathon" category="region" slug={region} />
    </SeoEventList>
  );
}
