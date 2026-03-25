"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DomainListPage from "@/components/core/DomainListPage";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  nyusatsuConfig,
  getCategoryLabel,
  getCategoryIcon,
  formatBudget,
  formatDeadline,
  getBiddingMethodLabel,
  getStatusBadge,
  getDeadlineRemaining,
} from "@/lib/nyusatsu-config";

const nyusatsuDomain = getDomain("nyusatsu");

function CardBadges({ item }) {
  const sb = getStatusBadge(item.status);
  const dr = getDeadlineRemaining(item.deadline);
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
      <span className={`badge ${sb.color}`}>{sb.label}</span>
      {item.bidding_method && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{getBiddingMethodLabel(item.bidding_method)}</span>}
      <span className="text-xs text-gray-600">{formatBudget(item.budget_amount)}</span>
      {dr && !dr.expired && <span className={`text-xs ${dr.urgent ? "text-red-600 font-bold" : "text-gray-500"}`}>{dr.text}</span>}
    </div>
  );
}

export default function NyusatsuAreaPage() {
  const { area } = useParams();
  const areaLabel = decodeURIComponent(area);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nyusatsu?area=${encodeURIComponent(areaLabel)}`);
      const data = await res.json();
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [areaLabel]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return (
    <DomainListPage
      title={`${areaLabel}の入札案件`}
      subtitle={loading ? "読み込み中..." : `${total}件`}
      items={items} loading={loading} page={1} totalPages={1} onPageChange={() => {}}
      renderItem={(item) => (
        <div key={item.id} className="card p-4 hover:shadow-md transition-shadow flex gap-4">
          <Link href={`/nyusatsu/${item.slug}`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">{getCategoryIcon(item.category)}</Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/nyusatsu/${item.slug}`} className="block min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.title}</h3>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {nyusatsuDomain && <DomainFavoriteButton itemId={item.id} domain={nyusatsuDomain} />}
                <DomainCompareButton domainId="nyusatsu" itemId={item.id} variant="compact" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{item.issuer_name}</p>
            <CardBadges item={item} />
          </div>
        </div>
      )}
      footerSlot={
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">地域から探す</h2>
          <div className="flex flex-wrap gap-2">
            {nyusatsuConfig.areas.map((a) => (
              <Link key={a.value} href={`/nyusatsu/area/${encodeURIComponent(a.value)}`} className={`inline-block px-3 py-1.5 text-xs border rounded-full transition-all ${a.value === areaLabel ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"}`}>
              {a.label}
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/nyusatsu" className="text-xs text-blue-600 hover:underline">← すべての入札案件を見る</Link>
          </div>
        </div>
      }
      bottomBar={<DomainCompareBar domainId="nyusatsu" comparePath="/nyusatsu/compare" label="案件" />}
    />
  );
}
