"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * ドメイン非依存のお気に入りボタン
 *
 * 任意のドメインの favorites API を使ってお気に入り登録/解除を行う。
 * 既存の components/FavoriteButton.js (sports専用) は変更しない。
 *
 * @param {Object} props
 * @param {number|string} props.itemId - 対象アイテムのID
 * @param {Object} props.domain - domain-registry のドメイン設定
 *   domain.favorites.checkEndpoint, domain.favorites.apiEndpoint, domain.favorites.deleteEndpoint
 * @param {"icon"|"button"} [props.variant="icon"] - 表示形式
 * @param {string} [props.className] - 追加CSSクラス
 */
export default function DomainFavoriteButton({
  itemId,
  domain,
  variant = "icon",
  className = "",
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  const { checkEndpoint, apiEndpoint, deleteEndpoint } = domain.favorites;
  const idColumn = domain.favorites.idColumn;

  useEffect(() => {
    if (!itemId) return;
    fetch(`${checkEndpoint}${itemId}`)
      .then((r) => r.json())
      .then((data) => setIsFavorite(data.isFavorite))
      .catch(() => {});
  }, [itemId, checkEndpoint]);

  const toggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isFavorite) {
        await fetch(`${deleteEndpoint}${itemId}`, { method: "DELETE" });
        setIsFavorite(false);
      } else {
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [idColumn]: Number(itemId) }),
        });
        if (res.ok || res.status === 200) {
          setIsFavorite(true);
        }
      }
    } catch (err) {
      console.error("Favorite toggle error:", err);
    } finally {
      setLoading(false);
    }
  }, [isFavorite, itemId, loading, apiEndpoint, deleteEndpoint, idColumn]);

  if (variant === "button") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-4 py-2 text-sm font-bold rounded-lg border transition-colors ${
          isFavorite
            ? "bg-red-50 border-red-200 text-red-600"
            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
        } ${className}`}
      >
        {isFavorite ? "♥ お気に入り済" : "♡ お気に入り"}
      </button>
    );
  }

  // icon variant (default)
  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xl p-1 rounded hover:bg-gray-100 transition-colors ${
        isFavorite ? "text-red-500" : "text-gray-300 hover:text-red-400"
      } ${className}`}
      title={isFavorite ? "お気に入り解除" : "お気に入り追加"}
    >
      {isFavorite ? "♥" : "♡"}
    </button>
  );
}
