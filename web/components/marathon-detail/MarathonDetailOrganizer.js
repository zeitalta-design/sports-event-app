import Link from "next/link";
import { toSlug } from "@/lib/slug";

/**
 * 主催者情報セクション
 * Phase 26: タイポグラフィ階層・間隔改善
 * Phase 29: 主催者ページへの導線追加
 */
export default function MarathonDetailOrganizer({ organizer }) {
  if (!organizer) return null;

  const organizerSlug = toSlug(organizer.name);

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">主催者情報</h2>
      <div className="space-y-3 text-sm">
        <div>
          <Link
            href={`/organizer/${encodeURIComponent(organizerSlug)}`}
            className="text-base font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            {organizer.name}
          </Link>
        </div>

        {organizer.description && (
          <p className="text-gray-600 leading-relaxed">
            {organizer.description}
          </p>
        )}

        {organizer.contact_name && (
          <div className="flex gap-3">
            <span className="text-gray-600 font-bold shrink-0">担当</span>
            <span className="text-gray-900">{organizer.contact_name}</span>
          </div>
        )}

        {organizer.email && (
          <div className="flex gap-3">
            <span className="text-gray-600 font-bold shrink-0">メール</span>
            <span className="text-gray-900">{organizer.email}</span>
          </div>
        )}

        {organizer.phone && (
          <div className="flex gap-3">
            <span className="text-gray-600 font-bold shrink-0">電話</span>
            <span className="text-gray-900">{organizer.phone}</span>
          </div>
        )}

        {organizer.review_score && organizer.review_count > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-yellow-500 text-lg">★</span>
            <span className="font-semibold text-gray-900 text-base">
              {organizer.review_score.toFixed(1)}
            </span>
            <span className="text-gray-600 text-sm">
              ({organizer.review_count}件の評価)
            </span>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100">
          <Link
            href={`/organizer/${encodeURIComponent(organizerSlug)}`}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            この主催者の大会を見る
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
