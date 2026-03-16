import { notFound } from "next/navigation";
import { PREFECTURE_SLUGS, REGION_GROUPS } from "@/lib/seo-mappings";
import { getEventsByPrefecture } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";

/**
 * Phase53: トレイルラン — 都道府県別SEOページ
 * /trail/prefecture/[prefecture]
 */

export async function generateMetadata({ params }) {
  const { prefecture } = await params;
  const name = PREFECTURE_SLUGS[prefecture];
  if (!name) return {};

  return {
    title: `${name}のトレイルラン大会`,
    description: `${name}で開催されるトレイルランニング大会を探せます。開催日、距離、コース情報を比較して大会を見つけられます。`,
    openGraph: {
      title: `${name}のトレイルラン大会 | 大会ナビ`,
      description: `${name}で開催されるトレイルラン大会一覧。日程・距離で比較できます。`,
      type: "website",
    },
  };
}

export default async function TrailPrefecturePage({ params }) {
  const { prefecture } = await params;
  const name = PREFECTURE_SLUGS[prefecture];
  if (!name) notFound();

  let events = [];
  try {
    events = getEventsByPrefecture(name, "trail");
  } catch {}

  // 関連リンク: 同地方の他県(trail) + 月別 + マラソン同県
  const relatedLinks = [];
  const sameRegion = REGION_GROUPS.find((r) => r.slugs.includes(prefecture));
  if (sameRegion) {
    for (const slug of sameRegion.slugs) {
      if (slug !== prefecture) {
        relatedLinks.push({ label: `${PREFECTURE_SLUGS[slug]}のトレイル`, href: `/trail/prefecture/${slug}` });
      }
    }
  }
  // 月別リンク
  for (let m = 1; m <= 12; m += 3) {
    relatedLinks.push({ label: `${m}月開催のトレイル`, href: `/trail/month/${m}` });
  }
  // Phase54: ランキング導線
  relatedLinks.push({ label: "🔥 トレイル人気ランキング", href: "/trail/ranking" });
  // マラソン同県へのクロスリンク
  relatedLinks.push({ label: `${name}のマラソン大会`, href: `/marathon/prefecture/${prefecture}` });

  return (
    <SeoEventList
      title={`${name}のトレイルラン大会`}
      description={`${name}で開催されるトレイルランニング大会の一覧です`}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "トレイルラン", href: "/trail" },
        { label: `${name}のトレイルラン大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref={`/trail?prefecture=${encodeURIComponent(name)}`}
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
      emptyHref="/trail"
      emptyLabel="トレイルラン大会一覧で探す →"
    />
  );
}
