"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  getCategoryLabel,
  getCategoryIcon,
  getBiddingMethodLabel,
  formatBudget,
  formatDeadline,
} from "@/lib/nyusatsu-config";

const nyusatsuDomain = getDomain("nyusatsu");

export default function NyusatsuDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/nyusatsu/${slug}`);
        if (!res.ok) { setItem(null); return; }
        const data = await res.json();
        setItem(data.item || null);
      } catch {
        setItem(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) return <DomainDetailPage loading />;

  if (!item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-gray-500 mb-4">案件が見つかりません</p>
            <Link href="/nyusatsu" className="btn-primary inline-block">入札ナビ一覧へ</Link>
          </div>
        }
      />
    );
  }

  return (
    <DomainDetailPage
      breadcrumb={<><Link href="/nyusatsu" className="hover:text-blue-600">入札ナビ</Link><span>/</span><span>{item.title}</span></>}
      icon={getCategoryIcon(item.category)}
      title={item.title}
      subtitle={item.issuer_name}
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className="text-sm text-gray-600">{formatBudget(item.budget_amount)}</span>
          <span className="text-xs text-gray-500">締切: {formatDeadline(item.deadline)}</span>
        </>
      }
      actions={
        <>
          {nyusatsuDomain && <DomainFavoriteButton itemId={item.id} domain={nyusatsuDomain} variant="button" />}
          <DomainCompareButton domainId="nyusatsu" itemId={item.id} variant="compact" />
        </>
      }
      footerSlot={<div className="flex gap-3 mt-2"><Link href="/nyusatsu" className="btn-secondary text-sm">← 一覧に戻る</Link></div>}
    >
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">案件概要</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
      </section>

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["発注機関", item.issuer_name],
              ["カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
              ["対象地域", item.target_area || "—"],
              ["予算規模", <span key="b" className="font-medium">{formatBudget(item.budget_amount)}</span>],
              ["入札方式", getBiddingMethodLabel(item.bidding_method)],
              ["締切日", formatDeadline(item.deadline)],
            ].map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DomainDetailPage>
  );
}
