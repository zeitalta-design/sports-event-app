"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getCompareIdsFromUrlOrStore, clearCompareIds, removeCompareId } from "@/lib/core/compare-store";
import { minpakuConfig, getCategoryLabel, getPropertyTypeLabel, formatPrice } from "@/lib/minpaku-config";

const DOMAIN_ID = "minpaku";

export default function Wrapper() { return <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>}><MinpakuComparePage /></Suspense>; }

function MinpakuComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const resolved = getCompareIdsFromUrlOrStore(DOMAIN_ID, searchParams);
  const [ids, setIds] = useState(resolved.ids);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const urlSyncDone = useRef(false);

  useEffect(() => { if (urlSyncDone.current) return; if (resolved.source === "store" && resolved.ids.length > 0) { const p = new URLSearchParams(searchParams.toString()); p.set("ids", resolved.ids.join(",")); router.replace(`/minpaku/compare?${p.toString()}`, { scroll: false }); } urlSyncDone.current = true; }, []);
  useEffect(() => { function h(e) { if (e.detail && e.detail.domainId !== DOMAIN_ID) return; const f = getCompareIdsFromUrlOrStore(DOMAIN_ID, null); setIds(f.ids); if (f.ids.length === 0) { setItems([]); setLoading(false); } } window.addEventListener("compare-change", h); return () => window.removeEventListener("compare-change", h); }, []);

  const fetchCompare = useCallback(async () => {
    if (ids.length === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try { const res = await fetch(`/api/minpaku?ids=${ids.join(",")}`); setItems((await res.json()).items || []); }
    catch { setItems([]); } finally { setLoading(false); }
  }, [ids.join(",")]);
  useEffect(() => { fetchCompare(); }, [fetchCompare]);

  function remove(id) { removeCompareId(DOMAIN_ID, id); const next = ids.filter((i) => i !== id); setIds(next); router.replace(next.length > 0 ? `/minpaku/compare?ids=${next.join(",")}` : "/minpaku/compare", { scroll: false }); }
  function handleClear() { clearCompareIds(DOMAIN_ID); setIds([]); setItems([]); router.replace("/minpaku/compare", { scroll: false }); }

  function cell(item, field) {
    switch (field.key) {
      case "area": return item.area || "—";
      case "property_type_label": return getPropertyTypeLabel(item.property_type);
      case "capacity": return item.capacity ? `${item.capacity}名` : "—";
      case "price_per_night": return formatPrice(item.price_per_night);
      case "min_nights": return item.min_nights ? `${item.min_nights}泊` : "—";
      case "host_name": return item.host_name || "—";
      case "rating": return item.rating ? `★${item.rating}` : "—";
      case "review_count": return item.review_count ? `${item.review_count}件` : "—";
      default: return item[field.key] || "—";
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">民泊 比較</h1>
      <p className="text-sm text-gray-500 mb-6">最大3物件を並べて比較できます</p>
      {loading ? <div className="card p-8 animate-pulse"><div className="h-48 bg-gray-100 rounded" /></div>
      : items.length === 0 ? <div className="card p-12 text-center"><p className="text-gray-600 font-bold mb-1">比較中の物件はありません</p><p className="text-sm text-gray-400 mb-6">一覧で「比較」ボタンを押すと比較できます</p><Link href="/minpaku" className="btn-primary inline-block">民泊一覧へ</Link></div>
      : <>
        <div className="flex justify-end mb-3"><button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-500">すべてクリア</button></div>
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="p-4 text-left text-gray-500 font-medium w-40">比較項目</th>
          {items.map((item) => (<th key={item.id} className="p-4 text-center min-w-[200px]"><Link href={`/minpaku/${item.slug}`} className="font-bold text-gray-900 hover:text-blue-600">{item.title}</Link><div className="text-xs text-gray-500">{item.area}</div><button onClick={() => remove(item.id)} className="text-xs text-red-500 hover:text-red-700 mt-1">削除</button></th>))}
        </tr></thead><tbody>
          {minpakuConfig.compareFields.map((f) => (<tr key={f.key} className="border-b last:border-b-0"><td className="p-4 text-gray-500 font-medium">{f.label}</td>{items.map((item) => (<td key={item.id} className="p-4 text-center text-gray-900">{cell(item, f)}</td>))}</tr>))}
        </tbody></table></div>
      </>}
    </div>
  );
}
