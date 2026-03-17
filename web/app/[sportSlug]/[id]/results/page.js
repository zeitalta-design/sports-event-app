import { notFound } from "next/navigation";
import { getSportBySlug } from "@/lib/sport-config";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { getEventResultsSummary } from "@/lib/results-service";
import { siteConfig } from "@/lib/site-config";
import ResultsListPage from "@/components/ResultsListPage";

/**
 * Phase149+176: スポーツ別大会結果ページ
 * /[sportSlug]/[id]/results
 *
 * 匿名化済みの結果一覧。SEO強化済み。
 */

export async function generateMetadata({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) return {};
  try {
    const data = getMarathonDetailPageData(id);
    if (!data) return {};

    let summaryText = "";
    try {
      const summary = getEventResultsSummary(data.id);
      if (summary?.total_finishers) {
        summaryText = `完走者${summary.total_finishers}名。`;
      }
    } catch {}

    const title = `${data.title} の大会結果・完走記録`;
    const description = `${data.title}の大会結果一覧。${summaryText}カテゴリ別タイム、順位を確認できます。`;

    return {
      title: `${title} | ${siteConfig.siteName}`,
      description,
      robots: { index: true, follow: true },
      alternates: {
        canonical: `${siteConfig.siteUrl}/${sport.slug}/${data.id}/results`,
      },
    };
  } catch {
    return {};
  }
}

export default async function SportResultsPage({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport) notFound();

  const data = getMarathonDetailPageData(id);
  if (!data) notFound();

  let availableYears = [];
  try {
    const { getDb } = require("@/lib/db");
    const db = getDb();
    const years = db.prepare(`
      SELECT DISTINCT result_year FROM event_results
      WHERE event_id = ? AND is_public = 1 AND result_year IS NOT NULL
      ORDER BY result_year DESC
    `).all(data.id);
    availableYears = years.map((r) => r.result_year);
  } catch {}

  return (
    <ResultsListPage
      eventId={data.id}
      eventTitle={data.title}
      backPath={`/${sport.slug}/${data.id}`}
      heroPhotoUrl={data.heroPhoto?.image_url || data.hero_image_url}
      photosPath={`/${sport.slug}/${data.id}/photos`}
      availableYears={availableYears}
    />
  );
}
