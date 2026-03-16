"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminGuard({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // loading | authorized | denied

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.user && data.user.role === "admin") {
          setStatus("authorized");
        } else {
          setStatus("denied");
        }
      })
      .catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") {
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
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">アクセス拒否</h1>
        <p className="text-sm text-gray-500 mb-4">
          このページは管理者のみアクセスできます。
        </p>
        <button
          onClick={() => router.push("/login")}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          ログインページへ
        </button>
      </div>
    );
  }

  return children;
}
