"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getCompareIdsFromUrlOrStore,
  clearCompareIds,
  removeCompareId,
} from "@/lib/core/compare-store";
import {
  yutaiConfig,
  getCategoryLabel,
  formatCurrency,
  formatMonths,
} from "@/lib/yutai-config";

const DOMAIN_ID = "yutai";

export default function YutaiComparePageWrapper() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>}>
      <YutaiComparePage />
    </Suspense>
  );
}

function YutaiComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const resolved = getCompareIdsFromUrlOrStore(DOMAIN_ID, searchParams);
  const [ids, setIds] = useState(resolved.ids);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const urlSyncDone = useRef(false);

  // store から復元した場合、URL に同期（1回のみ）
  useEffect(() => {
    if (urlSyncDone.current) return;
    if (resolved.source === "store" && resolved.ids.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("ids", resolved.ids.join(","));
      router.replace(`/yutai/compare?${params.toString()}`, { scroll: false });
    }
    urlSyncDone.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // compare-change イベント監視
  useEffect(() => {
    function onCompareChange(e) {
      if (e.detail && e.detail.domainId !== DOMAIN_ID) return;
      const fresh = getCompareIdsFromUrlOrStore(DOMAIN_ID, null);
      setIds(fresh.ids);
      if (fresh.ids.length === 0) {
        setItems([]);
        setLoading(false);
      }
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, []);

  // DB から取得
  const fetchCompare = useCallback(async () => {
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/yutai?ids=${ids.join(",")}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCompare();
  }, [fetchCompare]);

  function removeTool(id) {
    removeCompareId(DOMAIN_ID, id);
    const newIds = ids.filter((i) => i !== id);
    setIds(newIds);
    if (newIds.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("ids", newIds.join(","));
      router.replace(`/yutai/compare?${params.toString()}`, { scroll: false });
    } else {
      router.replace("/yutai/compare", { scroll: false });
    }
  }

  function handleClear() {
    clearCompareIds(DOMAIN_ID);
    setIds([]);
    setItems([]);
    router.replace("/yutai/compare", { scroll: false });
  }

  function getCellValue(item, field) {
    switch (field.key) {
      case "category_label":
        return getCategoryLabel(item.category);
      case "confirm_month":
        return formatMonths(item.confirm_months);
      case "min_investment":
        return formatCurrency(item.min_investment);
      case "benefit_summary":
        return <span className="text-xs">{item.benefit_summary}</span>;
      case "dividend_yield":
        return item.dividend_yield ? `${item.dividend_yield}%` : "—";
      case "yutai_yield":
        return item.benefit_yield ? `${item.benefit_yield}%` : "—";
      default:
        return "—";
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">株主優待 比較</h1>
      <p className="text-sm text-gray-500 mb-6">最大3銘柄を並べて比較できます</p>

      {loading ? (
        <div className="card p-8 animate-pulse">
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-600 font-bold mb-1">比較中の銘柄はありません</p>
          <p className="text-sm text-gray-400 mb-6">
            一覧ページで「比較」ボタンを押すと、ここで比較できます
          </p>
          <Link href="/yutai" className="btn-primary inline-block">
            株主優待一覧へ
          </Link>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-500 transition-colors">
              すべてクリア
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left text-gray-500 font-medium w-40">比較項目</th>
                  {items.map((item) => (
                    <th key={item.id} className="p-4 text-center min-w-[200px]">
                      <div className="flex flex-col items-center gap-1">
                        <Link
                          href={`/yutai/${item.slug}`}
                          className="font-bold text-gray-900 hover:text-blue-600"
                        >
                          {item.title}
                        </Link>
                        <span className="text-xs text-gray-500">{item.code}</span>
                        <button
                          onClick={() => removeTool(item.id)}
                          className="text-xs text-red-500 hover:text-red-700 mt-1"
                        >
                          削除
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yutaiConfig.compareFields.map((field) => (
                  <tr key={field.key} className="border-b last:border-b-0">
                    <td className="p-4 text-gray-500 font-medium">{field.label}</td>
                    {items.map((item) => (
                      <td key={item.id} className="p-4 text-center text-gray-900">
                        {getCellValue(item, field)}
                      </td>
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
