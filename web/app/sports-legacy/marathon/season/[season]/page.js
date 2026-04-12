import { notFound } from "next/navigation";
import { SEASON_SLUGS, buildSeasonMetadata, buildSeasonRelatedLinks } from "@/lib/seo-config";
import { getEventsBySeason } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";
import SportSwitcher from "@/components/seo/SportSwitcher";

export async function generateMetadata({ params }) {
  const { season } = await params;
  return buildSeasonMetadata(season);
}

export default async function SeasonPage({ params }) {
  const { season } = await params;
  const info = SEASON_SLUGS[season];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsBySeason(info.months);
  } catch {}

  const relatedLinks = buildSeasonRelatedLinks(season);
  const monthRange = info.months.map((m) => `${m}月`).join("・");

  return (
    <SeoEventList
      title={`${info.label}開催のマラソン大会`}
      description={`${info.label}（${monthRange}）に開催されるマラソン大会の一覧です。${info.description}`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: "季節別", href: "/marathon/season" },
        { label: `${info.label}の大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref="/marathon"
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
    >
      <SportSwitcher currentSportSlug="marathon" category="season" slug={season} />
    </SeoEventList>
  );
}
