"use client";

import Link from "next/link";

/**
 * Phase104: アップグレード誘導
 *
 * 上限到達時やプレミアム機能アクセス時に表示。
 */

export default function UpgradePrompt({ feature, currentLimit, premiumLimit }) {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">💎</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-purple-800 mb-1">
            {feature
              ? `${feature}は現在${currentLimit}件まで利用可能です`
              : "もっと便利に使いませんか？"}
          </p>
          <p className="text-xs text-purple-600 mb-2">
            {premiumLimit
              ? `プレミアムなら${premiumLimit}件まで保存できます。`
              : "プレミアムプランでさらに多くの機能が使えます。"}
          </p>
          <Link
            href="/pricing"
            className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline"
          >
            プランを見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
