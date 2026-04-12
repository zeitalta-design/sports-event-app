"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const MAX_COMPARE = 6;
const STORAGE_KEY = "gyosei_shobun_compare_ids";

function getCompareIds() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function setCompareIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function useCompareIds() {
  const [ids, setIds] = useState([]);
  useEffect(() => { setIds(getCompareIds()); }, []);
  return ids;
}

/**
 * 比較に追加/削除ボタン
 * @param {{ actionId: number, compact?: boolean }} props
 */
export default function AddToCompareButton({ actionId, compact = false }) {
  const router = useRouter();
  const [inCompare, setInCompare] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setInCompare(getCompareIds().includes(actionId));
  }, [actionId]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function handleToggle() {
    const current = getCompareIds();
    if (inCompare) {
      const next = current.filter((id) => id !== actionId);
      setCompareIds(next);
      setInCompare(false);
      showToast("比較から削除しました");
    } else {
      if (current.length >= MAX_COMPARE) {
        showToast(`比較は最大${MAX_COMPARE}件までです`);
        return;
      }
      const next = [...current, actionId];
      setCompareIds(next);
      setInCompare(true);
      showToast("比較に追加しました");
    }
  }

  function handleGoCompare() {
    const ids = getCompareIds();
    if (ids.length > 0) {
      router.push(`/gyosei-shobun/compare?ids=${ids.join(",")}`);
    }
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition border ${
            inCompare
              ? "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
          }`}
          title={inCompare ? "比較から削除" : "比較に追加"}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
          {inCompare ? "比較中" : "比較"}
        </button>
        {toast && (
          <div className="absolute top-full left-0 mt-1 z-50 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-white shadow-lg whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${
            inCompare
              ? "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
              : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
          }`}
        >
          <svg className={`w-4 h-4 ${inCompare ? "text-indigo-600" : "text-gray-400"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          <span className="hidden sm:inline">{inCompare ? "比較リストに追加済み" : "比較に追加"}</span>
        </button>
        {inCompare && (
          <button
            onClick={handleGoCompare}
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            比較ページへ →
          </button>
        )}
      </div>
      {toast && (
        <div className="absolute top-full right-0 mt-2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-white shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
