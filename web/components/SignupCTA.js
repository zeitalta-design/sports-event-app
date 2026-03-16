"use client";

import Link from "next/link";
import { useAuthStatus } from "@/lib/use-auth-status";

/**
 * Phase99: 再利用可能会員登録CTA
 *
 * 3バリアント:
 *   banner — グラデーション背景フル幅（トップ/next-race用）
 *   inline — カード型（runner用）
 *   minimal — テキストリンク型
 *
 * ログイン済みの場合は非表示。
 */

export default function SignupCTA({ variant = "banner" }) {
  const { isLoggedIn, isLoading } = useAuthStatus();

  // ログイン済みor読み込み中は非表示
  if (isLoading || isLoggedIn) return null;

  if (variant === "banner") {
    return (
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-100 rounded-xl p-6 sm:p-8">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-2xl mb-2">🏃‍♂️</p>
          <h3 className="text-base font-bold text-gray-900 mb-2">
            大会選びをもっと便利に
          </h3>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            保存した大会の締切通知、パーソナライズされたおすすめ、
            エントリーまでの一元管理。無料で使えます。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="/benefits"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              会員メリットを見る →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3">
        <span className="text-xl flex-shrink-0">💡</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 mb-1">
            大会選びをもっと便利に
          </p>
          <p className="text-xs text-gray-500 mb-2">
            保存・比較・通知など、無料で使えます
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              無料で始める →
            </Link>
            <Link
              href="/benefits"
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
            >
              詳しく見る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // minimal
  return (
    <div className="text-center py-3">
      <p className="text-xs text-gray-400">
        <Link
          href="/signup"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          無料会員登録
        </Link>
        {" "}で大会の管理がもっと便利に。
        <Link
          href="/benefits"
          className="text-gray-500 hover:text-gray-700 hover:underline ml-1"
        >
          メリットを見る →
        </Link>
      </p>
    </div>
  );
}
