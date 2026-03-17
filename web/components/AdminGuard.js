"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Phase229: AdminGuard（改善版）
 * - 未ログイン時は /login?redirect=... にリダイレクト
 * - 権限不足時は明確な拒否画面
 * - ログイン中のロール判定はサーバーサイドに委譲
 */
export default function AdminGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState("loading"); // loading | authorized | denied | unauthenticated

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          setStatus("unauthenticated");
        } else if (data.user.role === "admin") {
          setStatus("authorized");
        } else {
          setStatus("denied");
        }
      })
      .catch(() => setStatus("unauthenticated"));
  }, []);

  // 未ログイン → ログインページへリダイレクト
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}&denied=1`);
    }
  }, [status, router, pathname]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 mb-2">
            アクセス権限がありません
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            このページは管理者アカウントでのログインが必要です。
            <br />
            管理者権限をお持ちでない場合は、サイト管理者にお問い合わせください。
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              トップへ
            </button>
            <button
              onClick={() => router.push(`/login?redirect=${encodeURIComponent(pathname)}`)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              管理者でログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
