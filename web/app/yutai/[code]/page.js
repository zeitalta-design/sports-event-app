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
  formatCurrency,
  formatMonths,
} from "@/lib/yutai-config";

const yutaiDomain = getDomain("yutai");

export default function YutaiDetailPage() {
  const params = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/yutai/${params.code}`);
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
  }, [params.code]);

  if (loading) {
    return <DomainDetailPage loading />;
  }

  if (!item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-gray-500 mb-4">銘柄が見つかりません</p>
            <Link href="/yutai" className="btn-primary inline-block">
              株主優待一覧へ
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <DomainDetailPage
      breadcrumb={
        <>
          <Link href="/yutai" className="hover:text-blue-600">株主優待ナビ</Link>
          <span>/</span>
          <span>{item.title}</span>
        </>
      }
      icon={getCategoryIcon(item.category)}
      title={
        <>
          {item.title}
          <span className="text-sm text-gray-400 ml-2">({item.code})</span>
        </>
      }
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
          <span className="text-sm text-gray-600">権利確定月: {formatMonths(item.confirm_months)}</span>
        </>
      }
      actions={
        <>
          {yutaiDomain && <DomainFavoriteButton itemId={item.id} domain={yutaiDomain} variant="button" />}
          <DomainCompareButton domainId="yutai" itemId={item.id} variant="compact" />
        </>
      }
      footerSlot={
        <div className="flex gap-3 mt-2">
          <Link href="/yutai" className="btn-secondary text-sm">
            ← 一覧に戻る
          </Link>
        </div>
      }
    >
      {/* 優待内容 */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">優待内容</h2>
        <p className="text-sm text-gray-700">{item.benefit_summary}</p>
      </section>

      {/* 基本情報テーブル */}
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["証券コード", <span key="code" className="font-medium">{item.code}</span>],
              ["優待カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
              ["権利確定月", formatMonths(item.confirm_months)],
              ["最低投資金額", <span key="inv" className="font-medium">{formatCurrency(item.min_investment)}</span>],
              ["配当利回り", item.dividend_yield ? `${item.dividend_yield}%` : "—"],
              ["優待利回り", item.benefit_yield ? `${item.benefit_yield}%` : "—"],
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
