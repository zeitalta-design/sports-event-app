import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import {
  getSeriesBySlug,
  getSeriesMarathonsList,
} from "@/lib/organizer-series-service";
import Breadcrumbs from "@/components/Breadcrumbs";
import MarathonListCard from "@/components/MarathonListCard";

// --- Metadata ---

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);
  if (!series) return {};

  const title = `${series.name}シリーズの大会一覧`;
  const description = `${series.name}シリーズの大会一覧です。開催日・場所・種目・エントリー情報を確認できます。`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | ${siteConfig.siteName}`,
      description,
      type: "website",
    },
  };
}

// --- Page ---

export default async function SeriesPage({ params }) {
  const { slug } = await params;

  const series = getSeriesBySlug(slug);
  if (!series) notFound();

  const marathons = getSeriesMarathonsList(series.name);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "マラソン", href: "/marathon" },
    { label: `${series.name}シリーズ` },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-8 pb-6 border-b border-gray-100">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
          {series.name}シリーズ
        </h1>

        <p className="text-base text-gray-600 leading-relaxed mb-4">
          {series.name} シリーズの大会一覧です。
          {series.organizer_name && (
            <>
              主催:{" "}
              <Link
                href={`/organizer/${encodeURIComponent(series.slug)}`}
                className="text-blue-600 hover:text-blue-800"
              >
                {series.organizer_name}
              </Link>
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="font-medium text-gray-700">
            {series.event_count}件の大会
          </span>
        </div>
      </div>

      {/* 大会一覧 */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          シリーズの大会
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          {series.name} に属する大会の一覧です
        </p>
      </div>

      {marathons.length === 0 ? (
        <p className="text-center py-12 text-gray-400">
          現在表示できる大会はありません
        </p>
      ) : (
        <div className="space-y-4">
          {marathons.map((ev) => (
            <MarathonListCard key={ev.id} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
