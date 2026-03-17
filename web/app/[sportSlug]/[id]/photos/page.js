import { notFound } from "next/navigation";
import { getSportBySlug } from "@/lib/sport-config";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { siteConfig } from "@/lib/site-config";
import PhotoListPage from "@/components/PhotoListPage";

/**
 * Phase161: スポーツ別大会写真一覧ページ
 * /[sportSlug]/[id]/photos
 */

export async function generateMetadata({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) return {};
  try {
    const data = getMarathonDetailPageData(id);
    if (!data) return {};
    return {
      title: `${data.title} の写真・ギャラリー | ${siteConfig.siteName}`,
      description: `${data.title}の大会写真。コース、会場、スタート、ゴール、景色など大会の雰囲気を写真で確認できます。`,
    };
  } catch {
    return {};
  }
}

export default async function SportPhotosPage({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) notFound();

  const data = getMarathonDetailPageData(id);
  if (!data) notFound();

  return (
    <PhotoListPage
      eventId={data.id}
      eventTitle={data.title}
      backPath={`/${sport.slug}/${data.id}`}
    />
  );
}
