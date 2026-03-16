"use client";

import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase99: 小型ログイン誘導コンポーネント
 *
 * 1行テキスト+リンク。ログイン済みなら非表示。
 */

export default function LoginPrompt() {
  const { isLoggedIn, isLoading } = useAuthStatus();

  if (isLoading || isLoggedIn) return null;

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-center">
      <p className="text-xs text-gray-500">
        <Link
          href="/login"
          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
        >
          ログイン
        </Link>
        するともっと便利に使えます。
        <Link
          href="/benefits"
          className="text-gray-500 hover:text-gray-700 hover:underline ml-1"
        >
          詳しく見る →
        </Link>
      </p>
    </div>
  );
}
