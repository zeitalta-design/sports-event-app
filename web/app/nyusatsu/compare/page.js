"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getCompareIdsFromUrlOrStore, clearCompareIds, removeCompareId } from "@/lib/core/compare-store";
import { nyusatsuConfig, getCategoryLabel, getBiddingMethodLabel, formatBudget, formatDeadline } from "@/lib/nyusatsu-config";

const DOMAIN_ID = "nyusatsu";

export default function NyusatsuCompareWrapper() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>}>
      <NyusatsuComparePage />
    </Suspense>
  );
}

function NyusatsuComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const resolved = getCompareIdsFromUrlOrStore(DOMAIN_ID, searchParams);
  const [ids, setIds] = useState(resolved.ids);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const urlSyncDone = useRef(false);

  useEffect(() => {
    if (urlSyncDone.current) return;
    if (resolved.source === "store" && resolved.ids.length > 0) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("ids", resolved.ids.join(","));
      router.replace(`/nyusatsu/compare?${p.toString()}`, { scroll: false });
    }
    urlSyncDone.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onCompareChange(e) {
      if (e.detail && e.detail.domainId !== DOMAIN_ID) return;
      const fresh = getCompareIdsFromUrlOrStore(DOMAIN_ID, null);
      setIds(fresh.ids);
      if (fresh.ids.length === 0) { setItems([]); setLoading(false); }
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, []);

  const fetchCompare = useCallback(async () => {
    if (ids.length === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/nyusatsu?ids=${ids.join(",")}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCompare(); }, [fetchCompare]);

  function remove(id) {
    removeCompareId(DOMAIN_ID, id);
    const next = ids.filter((i) => i !== id);
    setIds(next);
    router.replace(next.length > 0 ? `/nyusatsu/compare?ids=${next.join(",")}` : "/nyusatsu/compare", { scroll: false });
  }

  function handleClear() {
    clearCompareIds(DOMAIN_ID); setIds([]); setItems([]);
    router.replace("/nyusatsu/compare", { scroll: false });
  }

  function cell(item, field) {
    switch (field.key) {
      case "category_label": return getCategoryLabel(item.category);
      case "issuer_name": return item.issuer_name || "—";
      case "target_area": return item.target_area || "—";
      case "budget_amount": return formatBudget(item.budget_amount);
      case "bidding_method": return getBiddingMethodLabel(item.bidding_method);
      case "deadline": return formatDeadline(item.deadline);
      default: return item[field.key] || "—";
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">入札ナビ 比較</h1>
      <p className="text-sm text-gray-500 mb-6">最大3件を並べて比較できます</p>

      {loading ? (
        <div className="card p-8 animate-pulse"><div className="h-48 bg-gray-100 rounded" /></div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-600 font-bold mb-1">比較中の案件はありません</p>
          <p className="text-sm text-gray-400 mb-6">一覧ページで「比較」ボタンを押すと、ここで比較できます</p>
          <Link href="/nyusatsu" className="btn-primary inline-block">入札ナビ一覧へ</Link>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-500">すべてクリア</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left text-gray-500 font-medium w-40">比較項目</th>
                  {items.map((item) => (
                    <th key={item.id} className="p-4 text-center min-w-[200px]">
                      <Link href={`/nyusatsu/${item.slug}`} className="font-bold text-gray-900 hover:text-blue-600">{item.title}</Link>
                      <div className="text-xs text-gray-500">{item.issuer_name}</div>
                      <button onClick={() => remove(item.id)} className="text-xs text-red-500 hover:text-red-700 mt-1">削除</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nyusatsuConfig.compareFields.map((f) => (
                  <tr key={f.key} className="border-b last:border-b-0">
                    <td className="p-4 text-gray-500 font-medium">{f.label}</td>
                    {items.map((item) => (
                      <td key={item.id} className="p-4 text-center text-gray-900">{cell(item, f)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
