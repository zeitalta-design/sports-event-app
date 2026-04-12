"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * 企業ウォッチボタン（ログイン必須）
 *
 * 新着処分時にメール通知を受け取るための監視登録。
 * お気に入り（★）とは別の機能。
 *
 * @param {{ organizationName: string, industry?: string, compact?: boolean }} props
 */
export default function WatchButton({ organizationName, industry = "", compact = false }) {
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  const checkStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams({ org: organizationName });
      if (industry) params.set("industry", industry);
      const res = await fetch(`/api/watchlist?${params}`);
      if (res.status === 401) {
        setNeedsLogin(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.ok) setIsWatched(data.isWatched);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [organizationName, industry]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  async function handleToggle() {
    if (toggling || needsLogin) return;
    setToggling(true);

    try {
      if (isWatched) {
        const res = await fetch("/api/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_name: organizationName, industry }),
        });
        if (res.ok) { setIsWatched(false); showToast("監視を解除しました"); }
        else if (res.status === 401) { setNeedsLogin(true); }
        else showToast("解除に失敗しました", "error");
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_name: organizationName, industry }),
        });
        if (res.ok) { setIsWatched(true); showToast("監視リストに登録しました — 新着処分時にメール通知"); }
        else if (res.status === 401) { setNeedsLogin(true); }
        else showToast("登録に失敗しました", "error");
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

  // 未ログイン → ログイン誘導
  if (needsLogin) {
    if (compact) {
      return (
        <Link
          href="/login?redirect=/gyosei-shobun"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition"
          title="ログインして監視登録"
        >
          <EyeIcon className="w-3 h-3" />
          監視
        </Link>
      );
    }
    return (
      <Link
        href="/login?redirect=/gyosei-shobun"
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition bg-white"
        title="ログインして監視登録"
      >
        <EyeIcon className="w-4 h-4" />
        <span className="hidden sm:inline">ログインして監視</span>
      </Link>
    );
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition border ${
            isWatched
              ? "bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100"
              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
          } ${toggling ? "opacity-60" : ""}`}
          title={isWatched ? "監視を解除" : "監視リストに登録"}
        >
          <EyeIcon className={`w-3 h-3 ${isWatched ? "text-teal-600" : ""}`} filled={isWatched} />
          {isWatched ? "監視中" : "監視"}
        </button>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
          isWatched
            ? "bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100"
            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
        } ${toggling ? "opacity-60 pointer-events-none" : ""}`}
        title={isWatched ? "監視を解除" : "新着処分時にメール通知を受け取る"}
      >
        {toggling ? (
          <span className="w-4 h-4 block animate-spin border-2 border-gray-300 border-t-teal-500 rounded-full" />
        ) : (
          <EyeIcon className={`w-4 h-4 ${isWatched ? "text-teal-600" : "text-gray-400"}`} filled={isWatched} />
        )}
        <span className="hidden sm:inline">{isWatched ? "監視中" : "この企業を監視"}</span>
      </button>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

function EyeIcon({ className = "", filled = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
      {filled ? (
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </>
      )}
    </svg>
  );
}

function Toast({ message, type }) {
  return (
    <div className={`absolute top-full right-0 mt-2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg whitespace-nowrap ${
      type === "error" ? "bg-red-600 text-white" : "bg-gray-800 text-white"
    }`}>
      {message}
    </div>
  );
}
