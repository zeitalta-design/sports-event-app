import { notFound } from "next/navigation";
import { DISTANCE_SLUGS, DISTANCE_TO_API_KEY, PREFECTURE_SLUGS } from "@/lib/seo-mappings";
import { getEventsByDistance } from "@/lib/seo-queries";
import SeoEventList from "@/components/SeoEventList";

export async function generateMetadata({ params }) {
  const { distance } = await params;
  const info = DISTANCE_SLUGS[distance];
  if (!info) return {};

  return {
    title: `${info.label}大会`,
    description: info.description,
    openGraph: {
      title: `${info.label}大会 | 大会ナビ`,
      description: info.description,
      type: "website",
    },
  };
}

export default async function DistancePage({ params }) {
  const { distance } = await params;
  const info = DISTANCE_SLUGS[distance];
  if (!info) notFound();

  let events = [];
  try {
    events = getEventsByDistance(info.range[0], info.range[1]);
  } catch {}

  // 関連リンク: 他の距離 + 人気都道府県
  const relatedLinks = [];
  for (const [slug, d] of Object.entries(DISTANCE_SLUGS)) {
    if (slug !== distance) {
      relatedLinks.push({ label: d.label, href: `/marathon/distance/${slug}` });
    }
  }
  const popularPrefectures = ["tokyo", "osaka", "kanagawa", "chiba", "saitama", "fukuoka"];
  for (const slug of popularPrefectures) {
    relatedLinks.push({
      label: `${PREFECTURE_SLUGS[slug]}の大会`,
      href: `/marathon/prefecture/${slug}`,
    });
  }

  const apiKey = DISTANCE_TO_API_KEY[distance];

  return (
    <SeoEventList
      title={`${info.label}大会`}
      description={info.description}
      breadcrumbs={[
        { label: "トップ", href: "/" },
        { label: "マラソン", href: "/marathon" },
        { label: `${info.label}大会` },
      ]}
      events={events}
      total={events.length}
      ctaHref={`/marathon?distance=${apiKey}`}
      ctaLabel="条件を絞って探す →"
      relatedLinks={relatedLinks}
    />
  );
}
