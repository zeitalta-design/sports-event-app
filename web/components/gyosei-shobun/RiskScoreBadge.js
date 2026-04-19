"use client";

/**
 * リスクスコアバッジ（Phase M-Post: 非 Pro はボカシ表示）
 *
 * 3つの表示モード:
 *  - full:    円グラフ風 + ラベル + スコア数字（詳細ページ用）
 *  - compact: 小さいバッジ（一覧カード用）
 *  - inline:  テキストのみ（テーブルセル用）
 *
 * 非 Pro ユーザーではスコア数値 / ラベル / 詳細をボカシ、
 * 「スコア存在すること + Pro で閲覧可能」の導線だけ見せる。
 * isPro 判定は useIsPro フックで auto。強制 override は isPro prop で可能。
 */

import { calculateRiskScore, RISK_COLORS } from "@/lib/risk-score";
import { useIsPro } from "@/lib/useIsPro";
import ProLockedOverlay from "@/components/ProLockedOverlay";

/**
 * @param {{ action: Object, mode?: "full" | "compact" | "inline", isPro?: boolean }} props
 */
export default function RiskScoreBadge({ action, mode = "compact", isPro: isProProp }) {
  const { isPro: isProAuto } = useIsPro();
  const isPro = typeof isProProp === "boolean" ? isProProp : isProAuto;

  const raw = <RawBadge action={action} mode={mode} />;

  // mode ごとの ProLockedOverlay variant を選ぶ
  const variant = mode === "full" ? "full" : mode === "inline" ? "inline" : "compact";
  return (
    <ProLockedOverlay isPro={isPro} variant={variant}>
      {raw}
    </ProLockedOverlay>
  );
}

// ─── 素のバッジ（isPro 判定前の children として使う） ──
function RawBadge({ action, mode }) {
  const { score, level, label } = calculateRiskScore(action);
  const c = RISK_COLORS[level] || RISK_COLORS.unknown;

  if (mode === "inline") {
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.badge}`}>
        {score}
      </span>
    );
  }

  if (mode === "compact") {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg border ${c.bg} ${c.text} ${c.border}`} title={`リスクスコア: ${score}/100 (${label})`}>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="10" className={`${level === "high" ? "stroke-red-400" : level === "medium" ? "stroke-amber-400" : "stroke-green-400"}`} />
          <path d={level === "high" ? "M12 8v4m0 4h.01" : level === "medium" ? "M12 9v3m0 3h.01" : "M9 12l2 2 4-4"} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {score}
      </span>
    );
  }

  // full モード
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        {/* 円グラフ */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
          <svg className="w-16 h-16 sm:w-20 sm:h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              stroke={level === "high" ? "#EF4444" : level === "medium" ? "#F59E0B" : "#22C55E"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-black ${c.text}`}>{score}</span>
          </div>
        </div>

        {/* テキスト */}
        <div>
          <p className={`text-sm font-bold ${c.text}`}>{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">リスクスコア {score}/100</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-2 h-2 rounded-full ${c.fill}`} />
            <span className="text-[11px] text-gray-500">
              {level === "high" ? "重大な処分内容" : level === "medium" ? "注意が必要" : "軽微な処分"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
