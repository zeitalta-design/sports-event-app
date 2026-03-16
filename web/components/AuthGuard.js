"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function AuthGuard({ children }) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => setStatus(data.user ? "authenticated" : "unauthenticated"))
      .catch(() => setStatus("unauthenticated"));
  }, []);

  if (status === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          ログインが必要です
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          この機能を利用するにはログインしてください。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            新規登録
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
