"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getCategoryLabel, saasConfig } from "@/lib/saas-config";

export default function AdminSaasItemsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ keyword: "", category: "", isPublished: "" });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.category) params.set("category", filters.category);
    if (filters.isPublished !== "") params.set("is_published", filters.isPublished);
    try {
      const res = await fetch(`/api/admin/items?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function togglePublish(id, current) {
    await fetch(`/api/admin/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: { ...items.find((i) => i.id === id), is_published: !current },
      }),
    });
    fetchItems();
  }

  async function deleteItem(id, title) {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await fetch(`/api/admin/items/${id}`, { method: "DELETE" });
    fetchItems();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SaaS ツール管理</h1>
          <p className="text-sm text-gray-500">{total}件</p>
        </div>
        <Link href="/admin/saas-items/new" className="btn-primary">+ 新規登録</Link>
      </div>

      {/* フィルタ */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">キーワード</label>
          <input
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            className="border rounded px-3 py-1.5 text-sm w-48"
            placeholder="ツール名..."
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">カテゴリ</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {saasConfig.categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">公開状態</label>
          <select
            value={filters.isPublished}
            onChange={(e) => setFilters({ ...filters, isPublished: e.target.value })}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            <option value="1">公開</option>
            <option value="0">下書き</option>
          </select>
        </div>
      </div>

      {/* テーブル */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">ID</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">ツール名</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">ベンダー</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">カテゴリ</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">状態</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{item.id}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/saas-items/${item.id}/edit`} className="font-bold text-blue-600 hover:underline">
                    {item.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.provider_name || "—"}</td>
                <td className="px-4 py-3"><span className="badge badge-blue">{getCategoryLabel(item.category)}</span></td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => togglePublish(item.id, item.is_published)}
                    className={`badge cursor-pointer ${item.is_published ? "badge-green" : "badge-gray"}`}
                  >
                    {item.is_published ? "公開" : "下書き"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/admin/saas-items/${item.id}/edit`} className="text-xs text-blue-600 hover:underline">編集</Link>
                    <button onClick={() => deleteItem(item.id, item.title)} className="text-xs text-red-500 hover:underline">削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
