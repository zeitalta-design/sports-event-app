"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * お気に入りボタン（認証対応版）
 *
 * ログイン状態:    APIがセッションから自動でuser_idを使用
 * 未ログイン状態:  localStorageのanon_keyをuser_keyとして送信
 */

function getAnonKey() {
  if (typeof window === "undefined") return null;
  let key = localStorage.getItem("risk_monitor_user_key");
  if (!key) {
    key = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("risk_monitor_user_key", key);
  }
  return key;
}

export default function FavoriteButton({ actionId }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  const checkStatus = useCallback(async () => {
    const anonKey = getAnonKey();
    try {
      // APIがセッションからuser_idを自動取得。未ログイン時はanon_keyをフォールバック
      const params = new URLSearchParams({ action_id: String(actionId) });
      if (anonKey) params.set("user_key", anonKey);
      const res = await fetch(`/api/gyosei-shobun/favorites/check?${params}`);
      const data = await res.json();
      if (data.ok) setIsFavorite(data.isFavorite);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [actionId]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
    const anonKey = getAnonKey();

    try {
      if (isFavorite) {
        const res = await fetch("/api/gyosei-shobun/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_key: anonKey, action_id: actionId }),
        });
        if (res.ok) { setIsFavorite(false); showToast("お気に入りから削除しました"); }
        else showToast("削除に失敗しました", "error");
      } else {
        const res = await fetch("/api/gyosei-shobun/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_key: anonKey, action_id: actionId }),
        });
        if (res.ok) {
          setIsFavorite(true);
          const data = await res.json().catch(() => ({}));
          if (data.watchAdded) {
            showToast("お気に入りに追加し、この企業の新着処分を監視します");
          } else {
            showToast("お気に入りに追加しました");
          }
        } else {
          showToast("追加に失敗しました", "error");
        }
      }
    } catch {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-200 bg-gray-50">
        <span className="w-4 h-4 animate-pulse bg-gray-200 rounded" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
          isFavorite
            ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
        } ${toggling ? "opacity-60 pointer-events-none" : ""}`}
        title={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
      >
        {toggling ? (
          <span className="w-4 h-4 block animate-spin border-2 border-gray-300 border-t-amber-500 rounded-full" />
        ) : (
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isFavorite ? "text-amber-500 scale-110" : "text-gray-400"}`}
            viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={isFavorite ? 0 : 2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        )}
        <span className="hidden sm:inline">{isFavorite ? "お気に入り済み" : "お気に入り"}</span>
      </button>

      {toast && (
        <div className={`absolute top-full right-0 mt-2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg whitespace-nowrap ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-800 text-white"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

/**
 * ログイン成功後に呼ぶ移行関数（外部から利用可能）
 * 使い方: ログインページで import { migrateAnonymousFavorites } from "..." して呼び出す
 */
export async function migrateAnonymousFavorites() {
  if (typeof window === "undefined") return;
  const anonKey = localStorage.getItem("risk_monitor_user_key");
  if (!anonKey || !anonKey.startsWith("anon_")) return;

  try {
    const res = await fetch("/api/gyosei-shobun/favorites/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anon_key: anonKey }),
    });
    const data = await res.json();
    if (data.ok && data.migrated > 0) {
      console.log(`[Favorites] Migrated ${data.migrated} favorites from anon to user account`);
      // anon_keyを削除（今後はセッションで管理）
      localStorage.removeItem("risk_monitor_user_key");
    }
  } catch {
    // 移行失敗は無視（次回ログイン時に再試行）
  }
}
