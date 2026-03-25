"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import { getCategoryLabel, getCategoryIcon, getPropertyTypeLabel, formatPrice } from "@/lib/minpaku-config";

const minpakuDomain = getDomain("minpaku");

export default function MinpakuDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const res = await fetch(`/api/minpaku/${slug}`); if (!res.ok) { setItem(null); return; } setItem((await res.json()).item || null); }
      catch { setItem(null); } finally { setLoading(false); }
    })();
  }, [slug]);

  if (loading) return <DomainDetailPage loading />;
  if (!item) return <DomainDetailPage notFound={<div className="max-w-4xl mx-auto px-4 py-8 text-center"><p className="text-gray-500 mb-4">物件が見つかりません</p><Link href="/minpaku" className="btn-primary inline-block">民泊一覧へ</Link></div>} />;

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/minpaku" className="hover:text-blue-600">民泊ナビ</Link><span>/</span><span>{item.title}</span></>}
      icon={getCategoryIcon(item.category)}
      title={item.title}
      subtitle={`${item.area} · ${item.host_name}`}
      meta={<>
        <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
        <span className="text-sm text-gray-700 font-bold">{formatPrice(item.price_per_night)}/泊</span>
        {item.rating > 0 && <span className="badge badge-green">★{item.rating} ({item.review_count}件)</span>}
      </>}
      actions={<>
        {minpakuDomain && <DomainFavoriteButton itemId={item.id} domain={minpakuDomain} variant="button" />}
        <DomainCompareButton domainId="minpaku" itemId={item.id} variant="compact" />
      </>}
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/minpaku" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">物件概要</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
      </section>
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm"><tbody>
          {[
            ["エリア", item.area],
            ["物件タイプ", getPropertyTypeLabel(item.property_type)],
            ["定員", `${item.capacity}名`],
            ["1泊料金", <span key="p" className="font-medium">{formatPrice(item.price_per_night)}</span>],
            ["最低宿泊日数", `${item.min_nights}泊`],
            ["ホスト", item.host_name],
            ["評価", item.rating ? `★${item.rating} (${item.review_count}件)` : "—"],
          ].map(([label, value], i, arr) => (
            <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
              <td className="py-3 text-gray-500 w-40">{label}</td>
              <td className="py-3 text-gray-900">{value}</td>
            </tr>
          ))}
        </tbody></table>
      </section>
    </DomainDetailPage>
  );
}
