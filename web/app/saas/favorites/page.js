"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCategoryLabel, getCategoryIcon } from "@/lib/saas-config";

export default function SaasFavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/item-favorites");
        const data = await res.json();
        setFavorites(data.favorites || []);
      } catch {
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function removeFavorite(itemId) {
    await fetch(`/api/item-favorites/${itemId}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => f.id !== itemId));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">お気に入り</h1>
      <p className="text-sm text-gray-500 mb-6">保存したSaaSツール</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2" /></div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">お気に入りに登録されたツールはありません</p>
          <Link href="/saas" className="btn-primary inline-block">ツール一覧を見る</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((item) => (
            <div key={item.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                {getCategoryIcon(item.category)}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/saas/${item.slug}`} className="text-sm font-bold text-gray-900 hover:text-blue-600 truncate block">
                  {item.title}
                </Link>
                <p className="text-xs text-gray-500">{item.provider_name} • {getCategoryLabel(item.category)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.price_display && <span className="text-xs text-gray-600">{item.price_display}</span>}
                <button
                  onClick={() => removeFavorite(item.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
