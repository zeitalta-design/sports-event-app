import { notFound } from "next/navigation";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { getEventResultsSummary } from "@/lib/results-service";
import { siteConfig } from "@/lib/site-config";
import ResultsListPage from "@/components/ResultsListPage";

/**
 * Phase149+176: マラソン大会結果ページ
 * /marathon/[id]/results
 *
 * 匿名化済みの結果一覧。SEO強化済み。
 */

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const data = getMarathonDetailPageData(id);
    if (!data) return {};

    let summaryText = "";
    try {
      const summary = getEventResultsSummary(data.id);
      if (summary) {
        const parts = [];
        if (summary.total_finishers) parts.push(`完走者${summary.total_finishers}名`);
        if (summary.completion_rate) parts.push(`完走率${summary.completion_rate}%`);
        if (summary.fastest_time) parts.push(`最速タイム${summary.fastest_time}`);
        summaryText = parts.length > 0 ? `${parts.join("、")}。` : "";
      }
    } catch {}

    const title = `${data.title} の大会結果・完走記録`;
    const description = `${data.title}の大会結果一覧。${summaryText}カテゴリ別タイム、順位を確認できます。${data.prefecture ? `開催地: ${data.prefecture}` : ""}`;

    return {
      title: `${title} | ${siteConfig.siteName}`,
      description,
      robots: { index: true, follow: true },
      openGraph: {
        title,
        description,
        type: "website",
        ...(data.heroPhoto?.image_url ? { images: [{ url: data.heroPhoto.image_url }] } : {}),
      },
      alternates: {
        canonical: `${siteConfig.siteUrl}/marathon/${data.id}/results`,
      },
    };
  } catch {
    return {};
  }
}

export default async function MarathonResultsPage({ params }) {
  const { id } = await params;
  const data = getMarathonDetailPageData(id);
  if (!data) notFound();

  // Phase176: 結果サマリーをサーバーサイドで取得してSEO用に渡す
  let resultsSummary = null;
  try { resultsSummary = getEventResultsSummary(data.id); } catch {}

  // 利用可能な年度リストを生成
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
    <>
      {/* Phase176: JSON-LD構造化データ */}
      {resultsSummary && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SportsEvent",
              name: data.title,
              description: `${data.title}の大会結果・完走記録`,
              ...(data.event_date ? { startDate: data.event_date } : {}),
              ...(data.venue_name ? { location: { "@type": "Place", name: data.venue_name, address: { "@type": "PostalAddress", addressRegion: data.prefecture } } } : {}),
              url: `${siteConfig.siteUrl}/marathon/${data.id}/results`,
            }),
          }}
        />
      )}
      <ResultsListPage
        eventId={data.id}
        eventTitle={data.title}
        backPath={`/marathon/${data.id}`}
        heroPhotoUrl={data.heroPhoto?.image_url || data.hero_image_url}
        photosPath={`/marathon/${data.id}/photos`}
        availableYears={availableYears}
      />
    </>
  );
}
