import { notFound } from "next/navigation";
import { SEASON_SLUGS, buildSeasonMetadata, buildSeasonRelatedLinks } from "@/lib/seo-config";
import { getEventsBySeason } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";
import SportSwitcher from "@/components/seo/SportSwitcher";

export async function generateMetadata({ params }) {
  const { season } = await params;
  return buildSeasonMetadata(season, "trail");
}

export default async function TrailSeasonPage({ params }) {
  const { season } = await params;
  const info = SEASON_SLUGS[season];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsBySeason(info.months, "trail");
  } catch {}

  const relatedLinks = buildSeasonRelatedLinks(season, "trail");
  const monthRange = info.months.map((m) => `${m}月`).join("・");

  return (
    <SeoEventList
      title={`${info.label}開催のトレイルラン大会`}
      description={`${info.label}（${monthRange}）に開催されるトレイルラン大会の一覧です。${info.description}`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: "季節別", href: "/trail/season" },
        { label: `${info.label}の大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref="/trail"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      trackingPageType="season"
      trackingSlug={season}
      trackingSportType="trail"
    >
      <SportSwitcher currentSportSlug="trail" category="season" slug={season} />
    </SeoEventList>
  );
}
