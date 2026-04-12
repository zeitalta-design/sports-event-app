import { notFound } from "next/navigation";
import { getSportBySlug } from "@/lib/sport-config";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { siteConfig } from "@/lib/site-config";
import ReviewListPage from "@/components/ReviewListPage";

/**
 * Phase141: スポーツ別口コミ一覧ページ
 * /[sportSlug]/[id]/reviews
 */

export async function generateMetadata({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) return {};
  try {
    const data = getMarathonDetailPageData(id);
    if (!data) return {};
    return {
      title: `${data.title} の口コミ・レビュー | ${siteConfig.siteName}`,
      description: `${data.title}の参加者による口コミ・レビュー。コース、アクセス、会場運営、初心者向け度などの評価を確認できます。`,
    };
  } catch {
    return {};
  }
}

export default async function SportReviewsPage({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) notFound();

  const data = getMarathonDetailPageData(id);
  if (!data) notFound();

  const writeReviewPath = `/reviews/new?event_id=${data.id}&event_title=${encodeURIComponent(data.title)}&sport_type=${data.sport_type || sport.sportTypeForDb}`;

  return (
    <ReviewListPage
      eventId={data.id}
      eventTitle={data.title}
      backPath={`/${sport.slug}/${data.id}`}
      writeReviewPath={writeReviewPath}
    />
  );
}
