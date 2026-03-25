"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCategoryLabel, getCategoryIcon, getSupportLabel, saasConfig } from "@/lib/saas-config";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";

function BoolBadge({ value, yesLabel = "対応", noLabel = "非対応" }) {
  return value ? (
    <span className="badge badge-green">{yesLabel}</span>
  ) : (
    <span className="badge badge-gray">{noLabel}</span>
  );
}

function StarRating({ value }) {
  if (!value) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <span className="text-amber-500 font-bold text-sm">
      {"★".repeat(Math.round(value))}{"☆".repeat(5 - Math.round(value))}
      <span className="text-gray-600 ml-1">{value}</span>
    </span>
  );
}

export default function SaasDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saasDomain = getDomain("saas");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/items/${slug}`);
        if (!res.ok) { setData(null); return; }
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // ─── ローディング ─────
  if (loading) {
    return <DomainDetailPage loading />;
  }

  // ─── Not Found ─────
  if (!data || !data.item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-16 text-center">
            <h1 className="text-xl font-bold text-gray-900">ツールが見つかりません</h1>
            <Link href="/saas" className="btn-primary mt-4 inline-block">一覧に戻る</Link>
          </div>
        }
      />
    );
  }

  const { item, alternatives } = data;
  const variants = item.variants || [];
  const tags = item.tags || [];

  return (
    <DomainDetailPage
      breadcrumb={
        <>
          <Link href="/saas" className="hover:text-blue-600">SaaSナビ</Link>
          <span>/</span>
          {item.category && (
            <>
              <Link href={`/saas?category=${item.category}`} className="hover:text-blue-600">
                {getCategoryLabel(item.category)}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-800">{item.title}</span>
        </>
      }
      icon={
        item.hero_image_url ? (
          <img src={item.hero_image_url} alt="" className="w-14 h-14 object-contain rounded" />
        ) : (
          getCategoryIcon(item.category)
        )
      }
      title={item.title}
      subtitle={item.provider_name}
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          {item.price_display && <span className="text-sm text-gray-700">{item.price_display}</span>}
          {item.has_free_plan === 1 && <span className="badge badge-green">無料プランあり</span>}
          {item.has_free_trial === 1 && <span className="badge badge-amber">トライアル{item.trial_days ? `${item.trial_days}日` : "あり"}</span>}
        </>
      }
      actions={
        <>
          <DomainFavoriteButton itemId={item.id} domain={saasDomain} variant="button" />
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-center text-sm">
              公式サイト →
            </a>
          )}
        </>
      }
    >
      {/* 概要 */}
      {item.description && (
        <section className="card p-6 mb-6">
          <h2 className="section-title mb-3">概要</h2>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.description}</div>
        </section>
      )}

      {/* 料金プラン */}
      {variants.length > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="section-title mb-4">料金プラン</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {variants.map((v) => {
              let attrs = {};
              try { attrs = JSON.parse(v.attributes_json || "{}"); } catch {}
              return (
                <div key={v.id} className={`border rounded-lg p-4 ${attrs.is_recommended ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}>
                  {attrs.is_recommended && <span className="text-xs font-bold text-blue-600 mb-1 block">おすすめ</span>}
                  <h3 className="font-bold text-gray-900">{v.name}</h3>
                  {attrs.price_display && <p className="text-lg font-bold text-blue-600 mt-1">{attrs.price_display}</p>}
                  {attrs.key_features && (
                    <ul className="mt-3 space-y-1">
                      {attrs.key_features.map((f, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-green-500 mt-0.5">✓</span>{f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* スペック */}
      <section className="card p-6 mb-6">
        <h2 className="section-title mb-4">スペック</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["対象企業規模", item.company_size_label || "—"],
              ["API連携", <BoolBadge key="api" value={item.api_available} />],
              ["モバイルアプリ", <BoolBadge key="mobile" value={item.mobile_app} />],
              ["サポート体制", getSupportLabel(item.support_type)],
              ["デプロイ方式", item.deployment_type === "cloud" ? "クラウド" : item.deployment_type === "on-premise" ? "オンプレミス" : item.deployment_type || "—"],
            ].map(([label, value]) => (
              <tr key={label} className="border-b last:border-b-0">
                <th className="py-2.5 text-left text-gray-500 font-medium w-40">{label}</th>
                <td className="py-2.5 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* タグ */}
      {tags.length > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="section-title mb-3">特徴・機能</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className="badge badge-gray">{t.tag}</span>
            ))}
          </div>
        </section>
      )}

      {/* レビュー */}
      {item.review_count > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="section-title mb-3">
            レビュー
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({item.review_count}件 / 平均 <StarRating value={item.review_avg} />)
            </span>
          </h2>
          <div className="space-y-4">
            {item.reviews.map((r) => (
              <div key={r.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating value={r.rating_overall} />
                  {r.company_size && <span className="text-xs text-gray-400">{r.company_size}</span>}
                  {r.usage_period && <span className="text-xs text-gray-400">{r.usage_period}</span>}
                </div>
                {r.review_title && <h4 className="text-sm font-bold text-gray-900">{r.review_title}</h4>}
                <p className="text-sm text-gray-600 mt-1">{r.review_body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 代替ツール */}
      {alternatives && alternatives.length > 0 && (
        <section className="card p-6 mb-6">
          <h2 className="section-title mb-4">代替・類似ツール</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alternatives.map((alt) => (
              <Link key={alt.id} href={`/saas/${alt.slug}`} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                  {getCategoryIcon(alt.category)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{alt.title}</p>
                  <p className="text-xs text-gray-500">{alt.provider_name} {alt.price_display ? `• ${alt.price_display}` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ベンダー情報 */}
      {item.provider_name && (
        <section className="card p-6">
          <h2 className="section-title mb-3">ベンダー情報</h2>
          <p className="text-sm font-bold text-gray-900">{item.provider_name}</p>
          {item.provider_description && <p className="text-sm text-gray-600 mt-1">{item.provider_description}</p>}
          {item.provider_url && (
            <a href={item.provider_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              企業サイト →
            </a>
          )}
        </section>
      )}
    </DomainDetailPage>
  );
}
