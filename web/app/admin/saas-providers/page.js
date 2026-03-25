"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

export default function AdminSaasProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers || []))
      .finally(() => setLoading(false));
  }, []);

  async function deleteProvider(id, name) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "削除に失敗しました");
      return;
    }
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AdminNav />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">ベンダー管理</h1>
        <Link href="/admin/saas-providers/new" className="btn-primary">+ 新規登録</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500">ID</th>
              <th className="px-4 py-3 text-left text-gray-500">ベンダー名</th>
              <th className="px-4 py-3 text-left text-gray-500">スラッグ</th>
              <th className="px-4 py-3 text-left text-gray-500">URL</th>
              <th className="px-4 py-3 text-left text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">読み込み中...</td></tr>
            ) : providers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">ベンダーがありません</td></tr>
            ) : providers.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{p.id}</td>
                <td className="px-4 py-3 font-bold">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.slug}</td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{p.url || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/admin/saas-providers/${p.id}/edit`} className="text-xs text-blue-600 hover:underline">編集</Link>
                    <button onClick={() => deleteProvider(p.id, p.name)} className="text-xs text-red-500 hover:underline">削除</button>
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
