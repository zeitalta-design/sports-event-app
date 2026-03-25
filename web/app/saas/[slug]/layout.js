import { getItemBySlug } from "@/lib/items-service";
import { getCategoryLabel } from "@/lib/saas-config";
import { siteConfig } from "@/lib/site-config";

/**
 * SaaS詳細ページのSEOメタデータ（動的生成）
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getItemBySlug(slug);

  if (!item) {
    return { title: "ツールが見つかりません" };
  }

  const catLabel = getCategoryLabel(item.category);
  const title = `${item.title} - 料金・機能・評判`;
  const description = item.summary
    ? `${item.title}の料金プラン・機能・ユーザー評価を比較。${catLabel}のSaaSツール選びならSaaSナビ。`
    : `${item.title}の詳細情報。${catLabel}カテゴリのSaaSツール。`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | SaaSナビ`,
      description,
      type: "website",
    },
    alternates: {
      canonical: `/saas/${slug}`,
    },
  };
}

/**
 * SaaS詳細ページ レイアウト — JSON-LD 構造化データを Server Component で出力
 */
export default async function SaasDetailLayout({ children, params }) {
  const { slug } = await params;
  let jsonLd = null;

  try {
    const item = getItemBySlug(slug);
    if (item) {
      const baseUrl = siteConfig.siteUrl;

      // Schema.org SoftwareApplication
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: item.title,
        description: item.summary || item.description || "",
        url: `${baseUrl}/saas/${slug}`,
        applicationCategory: getCategoryLabel(item.category),
        operatingSystem: "Web",
      };

      // 料金情報
      if (item.price_min != null || item.price_display) {
        jsonLd.offers = {
          "@type": "Offer",
          priceCurrency: "JPY",
        };
        if (item.price_min != null) {
          jsonLd.offers.price = item.price_min;
        }
        if (item.price_display) {
          jsonLd.offers.description = item.price_display;
        }
        if (item.has_free_plan) {
          jsonLd.offers.price = 0;
          jsonLd.offers.description = "無料プランあり";
        }
      }

      // レビュー集計
      if (item.review_count > 0 && item.review_avg) {
        jsonLd.aggregateRating = {
          "@type": "AggregateRating",
          ratingValue: item.review_avg,
          ratingCount: item.review_count,
          bestRating: 5,
          worstRating: 1,
        };
      }

      // ベンダー情報
      if (item.provider_name) {
        jsonLd.author = {
          "@type": "Organization",
          name: item.provider_name,
        };
        if (item.provider_url) {
          jsonLd.author.url = item.provider_url;
        }
      }

      // 画像
      if (item.hero_image_url) {
        jsonLd.image = item.hero_image_url;
      }

      // パンくずリスト
      const breadcrumbLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "SaaSナビ", item: `${baseUrl}/saas` },
          { "@type": "ListItem", position: 2, name: getCategoryLabel(item.category), item: `${baseUrl}/saas?category=${item.category}` },
          { "@type": "ListItem", position: 3, name: item.title },
        ],
      };

      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
          />
          {children}
        </>
      );
    }
  } catch {
    // item not found — render without JSON-LD
  }

  return children;
}
