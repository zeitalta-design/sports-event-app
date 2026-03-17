import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { CURATED_ARTICLES } from "@/lib/curated-articles";
import Breadcrumbs from "@/components/Breadcrumbs";

/**
 * Phase204: まとめ記事一覧ページ
 */

export const metadata = {
  title: `大会まとめ記事 | ${siteConfig.siteName}`,
  description: "初心者向け大会、口コミ高評価大会、フラットコースなど、テーマ別にマラソン・トレイルラン大会をまとめて紹介。",
};

export default function ArticlesIndexPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: "ホーム", href: "/" },
        { label: "まとめ記事" },
      ]} />

      <h1 className="text-2xl font-bold text-gray-900 mb-2">大会まとめ記事</h1>
      <p className="text-sm text-gray-500 mb-8">
        テーマ別に厳選した大会をランキング形式で紹介しています。
      </p>

      <div className="space-y-4">
        {CURATED_ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="block card p-5 hover:border-blue-200 transition-colors"
          >
            <div className="flex flex-wrap gap-2 mb-2">
              {article.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="text-sm font-bold text-gray-900 mb-1">{article.title}</h2>
            <p className="text-xs text-gray-500 line-clamp-2">{article.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/rankings" className="text-blue-600 hover:text-blue-800">ランキング一覧</Link>
        <Link href="/marathon" className="text-blue-600 hover:text-blue-800">大会を探す</Link>
      </div>
    </div>
  );
}
