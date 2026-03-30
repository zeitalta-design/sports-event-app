"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const ACTION_LABELS = {
  license_revocation: "免許取消",
  business_suspension: "営業停止",
  improvement_order: "改善命令",
  warning: "指示・警告",
  guidance: "指導・勧告",
  other: "その他",
};
const ACTION_COLORS = {
  license_revocation: "text-red-700 bg-red-50",
  business_suspension: "text-orange-700 bg-orange-50",
  improvement_order: "text-amber-700 bg-amber-50",
  warning: "text-blue-700 bg-blue-50",
  guidance: "text-gray-700 bg-gray-50",
};

export default function GyoseiShobunAdminListPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [watchedKeys, setWatchedKeys] = useState(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      const [listRes, watchRes] = await Promise.all([
        fetch(`/api/admin/gyosei-shobun?${params}`),
        fetch("/api/admin/watchlist?mode=set"),
      ]);
      const listData = await listRes.json();
      const watchData = await watchRes.json();
      setItems(listData.items || []);
      setTotal(listData.total || 0);
      setWatchedKeys(new Set(watchData.watchedKeys || []));
    } catch (err) {
      console.error("Admin fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function isItemWatched(item) {
    return watchedKeys.has(`${item.organization_name_raw}::${item.industry || ""}`);
  }

  async function toggleWatch(item) {
    const key = `${item.organization_name_raw}::${item.industry || ""}`;
    const watched = watchedKeys.has(key);
    try {
      await fetch("/api/admin/watchlist", {
        method: watched ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: item.organization_name_raw,
          industry: item.industry || "",
        }),
      });
      setWatchedKeys((prev) => {
        const next = new Set(prev);
        if (watched) next.delete(key); else next.add(key);
        return next;
      });
    } catch (err) {
      console.error("Toggle watch error:", err);
    }
  }

  async function togglePublish(id, current) {
    try {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      await fetch(`/api/admin/gyosei-shobun/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, is_published: current ? 0 : 1 }),
      });
      fetchItems();
    } catch (err) {
      console.error("Toggle publish error:", err);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">行政処分DB 管理</h1>
          <p className="text-sm text-gray-500 mt-1">{total}件</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/watchlist" className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50">
            👁 ウォッチリスト
          </Link>
          <Link href="/admin/gyosei-shobun/new" className="btn-primary text-sm">
            + 新規作成
          </Link>
        </div>
      </div>

      {/* 検索 */}
      <div className="mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="検索..."
          className="border rounded-lg px-4 py-2 text-sm w-full max-w-md"
        />
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="card p-8 animate-pulse"><div className="h-32 bg-gray-100 rounded" /></div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">データがありません</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left text-xs font-bold text-gray-500">ID</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">事業者名</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">処分種別</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">行政機関</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">都道府県</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">処分日</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">更新日</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">公開</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const watched = isItemWatched(item);
                return (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{item.id}</td>
                    <td className="p-3 text-gray-900">{item.organization_name_raw ?? "—"}</td>
                    <td className="p-3">
                      {item.action_type ? (
                        <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${ACTION_COLORS[item.action_type] || ""}`}>
                          {ACTION_LABELS[item.action_type] || item.action_type}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-gray-900">{item.authority_name ?? "—"}</td>
                    <td className="p-3 text-gray-900">{item.prefecture ?? "—"}</td>
                    <td className="p-3 text-gray-900">{item.action_date?.substring(0, 10) || "—"}</td>
                    <td className="p-3 text-gray-900">{item.updated_at?.substring(0, 10) || "—"}</td>
                    <td className="p-3">
                      <button
                        onClick={() => togglePublish(item.id, item.is_published)}
                        className={`text-xs px-2 py-1 rounded ${item.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {item.is_published ? "公開中" : "非公開"}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => toggleWatch(item)}
                          className={`text-xs px-2 py-1 rounded border ${watched ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-400 border-gray-200 hover:text-amber-600 hover:border-amber-200"}`}
                          title={watched ? "ウォッチ解除" : "ウォッチする"}
                        >
                          {watched ? "👁 解除" : "👁 ウォッチ"}
                        </button>
                        <Link href={`/admin/gyosei-shobun/${item.id}/edit`} className="text-xs text-blue-600 hover:underline">
                          編集
                        </Link>
                        {item.slug && (
                          <Link href={`/gyosei-shobun/${item.slug}`} target="_blank" className="text-xs text-gray-400 hover:underline">
                            公開側
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">← 管理トップ</Link>
      </div>
    </div>
  );
}
