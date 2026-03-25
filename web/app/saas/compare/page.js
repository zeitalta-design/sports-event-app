"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getCategoryLabel, getSupportLabel, saasConfig } from "@/lib/saas-config";
import {
  getCompareIdsFromUrlOrStore,
  clearCompareIds,
  removeCompareId,
} from "@/lib/core/compare-store";

const DOMAIN_ID = "saas";

function BoolCell({ value }) {
  return value ? (
    <span className="text-green-600 font-bold">○</span>
  ) : (
    <span className="text-gray-300">×</span>
  );
}

export default function SaasComparePageWrapper() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>}>
      <SaasComparePage />
    </Suspense>
  );
}

function SaasComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // URL 優先 / store フォールバックで IDs を解決
  const resolved = getCompareIdsFromUrlOrStore(DOMAIN_ID, searchParams);
  const [ids, setIds] = useState(resolved.ids);
  const urlSyncDone = useRef(false);

  // store から復元した場合、URL にも同期（1回のみ）
  useEffect(() => {
    if (urlSyncDone.current) return;
    if (resolved.source === "store" && resolved.ids.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("ids", resolved.ids.join(","));
      router.replace(`/saas/compare?${params.toString()}`, { scroll: false });
    }
    urlSyncDone.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // compare-change イベント監視（clear 同期用）
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

  // データ取得
  const fetchCompare = useCallback(async () => {
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/items/compare?ids=${ids.join(",")}`);
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

  // ツール検索
  async function searchTools(q) {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/items?keyword=${encodeURIComponent(q)}&page_size=5`);
      const data = await res.json();
      setSearchResults((data.items || []).filter((i) => !ids.includes(i.id)));
    } catch {
      setSearchResults([]);
    }
  }

  function addTool(id) {
    if (ids.length >= 3) return;
    const newIds = [...ids, id];
    setIds(newIds);
    setSearchKeyword("");
    setSearchResults([]);
    // URL 更新
    const params = new URLSearchParams(searchParams.toString());
    params.set("ids", newIds.join(","));
    router.replace(`/saas/compare?${params.toString()}`, { scroll: false });
  }

  function removeTool(id) {
    removeCompareId(DOMAIN_ID, id);
    const newIds = ids.filter((i) => i !== id);
    setIds(newIds);
    if (newIds.length > 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("ids", newIds.join(","));
      router.replace(`/saas/compare?${params.toString()}`, { scroll: false });
    } else {
      router.replace("/saas/compare", { scroll: false });
    }
  }

  function handleClear() {
    clearCompareIds(DOMAIN_ID);
    setIds([]);
    setItems([]);
    router.replace("/saas/compare", { scroll: false });
  }

  const compareRows = saasConfig.compareFields;

  function getCellValue(item, field) {
    switch (field.key) {
      case "category":
        return getCategoryLabel(item.category);
      case "price_display":
        return item.price_display || "—";
      case "has_free_plan":
        return <BoolCell value={item.has_free_plan} />;
      case "has_free_trial":
        if (!item.has_free_trial) return <BoolCell value={false} />;
        return (
          <span className="text-green-600 font-bold">
            {item.trial_days ? `${item.trial_days}日` : "○"}
          </span>
        );
      case "company_size_label":
        return item.company_size_label || "—";
      case "api_available":
        return <BoolCell value={item.api_available} />;
      case "mobile_app":
        return <BoolCell value={item.mobile_app} />;
      case "support_type":
        return getSupportLabel(item.support_type);
      default:
        return "—";
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">SaaSツール比較</h1>
      <p className="text-sm text-gray-500 mb-6">最大3件のツールを並べて比較できます</p>

      {/* ツール追加検索 */}
      {ids.length < 3 && !loading && (
        <div className="card p-4 mb-6">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              searchTools(e.target.value);
            }}
            placeholder="比較するツールを検索..."
            className="w-full border rounded-lg px-4 py-2.5 text-sm"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg divide-y">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addTool(r.id)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors"
                >
                  <span className="font-bold text-gray-900">{r.title}</span>
                  <span className="text-gray-500 ml-2">{r.provider_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ローディング */}
      {loading ? (
        <div className="card p-8 animate-pulse">
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-bold mb-1">比較中のツールはありません</p>
          <p className="text-sm text-gray-400 mb-6">
            一覧ページで「比較」ボタンを押すと、ここで比較できます
          </p>
          <Link href="/saas" className="btn-primary inline-block">
            SaaSツール一覧へ
          </Link>
        </div>
      ) : (
        /* 比較表 */
        <>
          {/* クリアボタン */}
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
                          href={`/saas/${item.slug}`}
                          className="font-bold text-gray-900 hover:text-blue-600"
                        >
                          {item.title}
                        </Link>
                        <span className="text-xs text-gray-500">{item.provider_name}</span>
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
                {compareRows.map((field) => (
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
