"use client";

import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase107: 会員メリット訴求CTA
 *
 * 匿名ユーザーのみ表示。/benefitsへの誘導。
 */

export default function MemberBenefitsCTA() {
  const { isLoggedIn, isLoading } = useAuthStatus();

  if (isLoading || isLoggedIn) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-6">
      <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-6 text-center">
        <p className="text-xl mb-2">🏃‍♀️</p>
        <h2 className="text-base font-bold text-gray-900 mb-1">
          大会探しをもっと便利に
        </h2>
        <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
          保存・比較・通知・おすすめ — 無料で使えます
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            無料で始める
          </Link>
          <Link
            href="/benefits"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            詳しく見る →
          </Link>
        </div>
      </div>
    </section>
  );
}
