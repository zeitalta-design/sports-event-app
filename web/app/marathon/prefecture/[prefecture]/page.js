import { notFound } from "next/navigation";
import { PREFECTURE_SLUGS, DISTANCE_SLUGS, REGION_GROUPS } from "@/lib/seo-mappings";
import { getEventsByPrefecture } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";

export async function generateMetadata({ params }) {
  const { prefecture } = await params;
  const name = PREFECTURE_SLUGS[prefecture];
  if (!name) return {};

  return {
    title: `${name}のマラソン大会`,
    description: `${name}で開催されるマラソン大会を探せます。開催日、締切、距離を比較して大会を見つけられます。`,
    openGraph: {
      title: `${name}のマラソン大会 | 大会ナビ`,
      description: `${name}で開催されるマラソン大会一覧。日程・距離・締切で比較できます。`,
      type: "website",
    },
  };
}

export default async function PrefecturePage({ params }) {
  const { prefecture } = await params;
  const name = PREFECTURE_SLUGS[prefecture];
  if (!name) notFound();

  let events = [];
  try {
    events = getEventsByPrefecture(name);
  } catch {}

  // 関連リンク: 同地方の他県 + 距離別
  const relatedLinks = [];
  const sameRegion = REGION_GROUPS.find((r) => r.slugs.includes(prefecture));
  if (sameRegion) {
    for (const slug of sameRegion.slugs) {
      if (slug !== prefecture) {
        relatedLinks.push({ label: PREFECTURE_SLUGS[slug], href: `/marathon/prefecture/${slug}` });
      }
    }
  }
  for (const [slug, info] of Object.entries(DISTANCE_SLUGS)) {
    relatedLinks.push({ label: info.label, href: `/marathon/distance/${slug}` });
  }

  return (
    <SeoEventList
      title={`${name}のマラソン大会`}
      description={`${name}で開催されるマラソン大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: `${name}のマラソン大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref={`/marathon?prefecture=${encodeURIComponent(name)}`}
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
    />
  );
}
