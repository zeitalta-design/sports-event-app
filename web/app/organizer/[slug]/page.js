import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import {
  getOrganizerBySlug,
  getOrganizerMarathons,
} from "@/lib/organizer-series-service";
import Breadcrumbs from "@/components/Breadcrumbs";
import MarathonListCard from "@/components/MarathonListCard";

// --- Metadata ---

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const organizer = getOrganizerBySlug(slug);
  if (!organizer) return {};

  const title = `${organizer.name}の大会一覧`;
  const description = `${organizer.name}が主催するスポーツ大会の一覧です。開催日・場所・種目・エントリー情報を確認できます。`;

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

export default async function OrganizerPage({ params }) {
  const { slug } = await params;

  const organizer = getOrganizerBySlug(slug);
  if (!organizer) notFound();

  const marathons = getOrganizerMarathons(organizer.name);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "マラソン", href: "/marathon" },
    { label: organizer.name },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* ヘッダー */}
      <div className="mb-8 pb-6 border-b border-gray-100">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
          {organizer.name}
        </h1>

        {organizer.description && (
          <p className="text-base text-gray-600 leading-relaxed mb-4">
            {organizer.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span className="font-medium text-gray-700">
            {organizer.event_count}件の大会
          </span>
          {organizer.review_score && organizer.review_count > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-yellow-500">★</span>
              <span className="font-medium text-gray-700">
                {organizer.review_score.toFixed(1)}
              </span>
              <span className="text-gray-400">
                ({organizer.review_count}件の評価)
              </span>
            </span>
          )}
        </div>
      </div>

      {/* 大会一覧 */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          この主催者の大会
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          {organizer.name} が主催する大会の一覧です
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
