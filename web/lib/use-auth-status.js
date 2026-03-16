"use client";

import { useState, useEffect } from "react";

/**
 * Phase99: クライアント認証状態フック
 *
 * GET /api/auth でユーザー情報を取得。
 * sessionStorageキャッシュ（5分）+ SWR風の再検証。
 */

const CACHE_KEY = "taikai_auth_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5分

function getCachedAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedAuth(data) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {}
}

export function clearAuthCache() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function useAuthStatus() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // まずキャッシュ確認
    const cached = getCachedAuth();
    if (cached !== null) {
      setUser(cached.user || null);
      setIsLoading(false);
      // バックグラウンドで再検証
      revalidate();
      return;
    }

    // キャッシュなし → API呼び出し
    revalidate();

    async function revalidate() {
      try {
        const res = await fetch("/api/auth");
        if (!res.ok) {
          setCachedAuth({ user: null });
          setUser(null);
          return;
        }
        const data = await res.json();
        setCachedAuth(data);
        setUser(data.user || null);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    isLoading,
  };
}
