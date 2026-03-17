import { notFound } from "next/navigation";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { siteConfig } from "@/lib/site-config";
import { getEventPhotos, getEventHeroPhoto } from "@/lib/photo-service";
import PhotoListPage from "@/components/PhotoListPage";

/**
 * Phase161+202: マラソン大会写真一覧ページ（SEO強化版）
 * /marathon/[id]/photos
 *
 * 追加: OGP画像, JSON-LD ImageGallery, 画像ALT強化
 */

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const data = getMarathonDetailPageData(id);
    if (!data) return {};

    const hero = getEventHeroPhoto(data.id);
    const photoCount = data.photoCount || 0;
    const title = `${data.title} の写真・ギャラリー（${photoCount}枚）`;
    const description = `${data.title}の大会写真${photoCount}枚。コース風景、会場の雰囲気、スタート・ゴール地点など、実際の大会の様子を写真で確認できます。${data.prefecture ? `開催地: ${data.prefecture}` : ""}`;

    const metadata = {
      title: `${title} | ${siteConfig.siteName}`,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${siteConfig.baseUrl}/marathon/${data.id}/photos`,
      },
      alternates: {
        canonical: `${siteConfig.baseUrl}/marathon/${data.id}/photos`,
      },
    };

    // OGP画像
    if (hero?.image_url) {
      const imageUrl = hero.image_url.startsWith("http") ? hero.image_url : `${siteConfig.baseUrl}${hero.image_url}`;
      metadata.openGraph.images = [{
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: `${data.title}の写真`,
      }];
    }

    return metadata;
  } catch {
    return {};
  }
}

export default async function MarathonPhotosPage({ params }) {
  const { id } = await params;
  const data = getMarathonDetailPageData(id);
  if (!data) notFound();

  // JSON-LD for image gallery
  const photos = (() => {
    try { return getEventPhotos(data.id, { limit: 50 }); } catch { return []; }
  })();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${data.title} の写真`,
    description: `${data.title}の大会写真ギャラリー`,
    url: `${siteConfig.baseUrl}/marathon/${data.id}/photos`,
    about: {
      "@type": "SportsEvent",
      name: data.title,
      location: data.prefecture ? { "@type": "Place", name: data.prefecture } : undefined,
    },
    image: photos.slice(0, 10).map((p) => ({
      "@type": "ImageObject",
      url: p.image_url?.startsWith("http") ? p.image_url : `${siteConfig.baseUrl}${p.image_url}`,
      caption: p.caption || p.alt_text || `${data.title}の${getImageTypeLabel(p.image_type)}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PhotoListPage
        eventId={data.id}
        eventTitle={data.title}
        backPath={`/marathon/${data.id}`}
      />
    </>
  );
}

function getImageTypeLabel(type) {
  const labels = {
    course: "コース写真",
    start: "スタート写真",
    finish: "ゴール写真",
    scenery: "景色",
    venue: "会場写真",
    crowd: "応援風景",
    hero: "メイン写真",
  };
  return labels[type] || "写真";
}
