import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { DISTANCE_SLUGS } from "@/lib/seo-mappings";

export const metadata = {
  title: "距離別マラソン大会",
  description: "フルマラソン、ハーフマラソン、10km、5kmなど距離別にマラソン大会を探せます。",
  openGraph: {
    title: "距離別マラソン大会 | 大会ナビ",
    description: "距離で絞ってマラソン大会を探せます。フル、ハーフ、10km、5km、ウルトラ対応。",
    type: "website",
  },
};

export default function DistanceIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "トップ", href: "/" },
          { label: "マラソン", href: "/marathon" },
          { label: "距離別" },
        ]}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-1">距離別マラソン大会</h1>
      <p className="text-sm text-gray-500 mb-8">自分に合った距離のマラソン大会を探せます</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(DISTANCE_SLUGS).map(([slug, info]) => (
          <Link
            key={slug}
            href={`/marathon/distance/${slug}`}
            className="card p-6 hover:shadow-md transition-shadow block"
          >
            <h2 className="font-bold text-gray-900 text-lg mb-2">{info.label}</h2>
            <p className="text-xs text-gray-500 leading-relaxed">{info.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
