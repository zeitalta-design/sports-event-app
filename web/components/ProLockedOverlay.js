"use client";

/**
 * ProLockedOverlay — 非 Pro 向けボカシ + CTA 共通コンポーネント（Phase M-Post）
 *
 * 使い方:
 *   <ProLockedOverlay isPro={isPro} variant="full">
 *     <RiskScoreBadgeRaw ... />
 *   </ProLockedOverlay>
 *
 * variant:
 *   full    — 大きめカード向け。オーバーレイに CTA ボタン付き
 *   compact — 小バッジ向け。blur + 鍵アイコン
 *   inline  — テーブルセル向け。blur のみ、クリック遷移
 *
 * 設計意図（「見せるが読ませない」）:
 *   - children は常に DOM に存在させ、CSS で blur + pointer-events-none
 *   - 上に overlay を被せて CTA / 鍵アイコンを表示
 *   - isPro == true なら素の children を返す（overlay なし）
 *   - isPro == null (判定前) は blur を出して「ちらつきで読める」事故を防ぐ
 */
import Link from "next/link";

const BLURRED = "blur-sm select-none pointer-events-none";

export default function ProLockedOverlay({
  isPro,
  variant = "compact",
  children,
  className = "",
  // Phase M-Post: full variant でのオーバーレイ文言を差し替え可能に。
  // スコア以外のもの（リスク概要、備考 等）に流用するため。
  title = "このスコアは Pro で閲覧できます",
  description = "有料会員になると詳細なスコアと判定理由を確認できます",
  ctaLabel = "Pro プランを見る →",
}) {
  if (isPro === true) return children;

  if (variant === "compact") {
    return (
      <Link
        href="/pricing"
        title="Pro で完全表示"
        aria-label="Pro で完全表示"
        className={`relative inline-flex ${className}`}
      >
        <span className={BLURRED}>{children}</span>
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
        </span>
      </Link>
    );
  }

  if (variant === "inline") {
    return (
      <Link href="/pricing" className={`inline-flex items-center gap-1 ${className}`} title="Pro で完全表示">
        <span className={BLURRED}>{children}</span>
        <span className="text-[10px] text-gray-400">🔒</span>
      </Link>
    );
  }

  // full
  return (
    <div className={`relative ${className}`}>
      <div className={BLURRED}>{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/55 backdrop-blur-[1px] rounded-2xl">
        <p className="text-sm font-bold text-gray-900 mb-1">{title}</p>
        <p className="text-[11px] text-gray-600 mb-3 text-center px-4">
          {description}
        </p>
        <Link
          href="/pricing"
          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
