"use client";

import { calculateSuitability, getSuitabilityLevelDef } from "@/lib/event-suitability";
import { getRunnerProfile } from "@/lib/runner-profile";
import { useState, useEffect } from "react";

/**
 * Phase91: 適性バッジコンポーネント
 *
 * ランナープロフィールがある場合のみ表示。
 * variant:
 *   - "badge" — コンパクトなバッジ（一覧カード向け）
 *   - "detail" — 理由テキスト付き（詳細ページ向け）
 *   - "inline" — インラインテキスト（比較テーブル向け）
 *
 * @param {object} props
 * @param {object} props.event - 大会データ
 * @param {string} [props.variant="badge"]
 * @param {object} [props.profile] - 外部からプロフィールを渡す場合
 */
export default function SuitabilityBadge({ event, variant = "badge", profile: externalProfile }) {
  const [profile, setProfile] = useState(externalProfile || null);
  const [mounted, setMounted] = useState(!!externalProfile);

  useEffect(() => {
    if (!externalProfile) {
      setProfile(getRunnerProfile());
      setMounted(true);
    }
    const handler = () => setProfile(getRunnerProfile());
    window.addEventListener("runner-profile-change", handler);
    return () => window.removeEventListener("runner-profile-change", handler);
  }, [externalProfile]);

  if (!mounted) return null;
  if (!profile) return null;

  const suitability = calculateSuitability(event, profile);
  if (suitability.level === "low" && suitability.reasons.length === 0) return null;

  const levelDef = suitability.levelDef;

  if (variant === "badge") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded ${levelDef.className}`}
        title={`適性スコア: ${suitability.score}点 - ${suitability.reasons.join(", ")}`}
      >
        {levelDef.icon} {levelDef.label}
      </span>
    );
  }

  if (variant === "detail") {
    return (
      <div className={`inline-flex flex-col gap-1 px-3 py-2 text-sm border rounded-lg ${levelDef.className}`}>
        <div className="flex items-center gap-1.5 font-medium">
          <span>{levelDef.icon}</span>
          <span>あなたへの適性: {levelDef.label}</span>
          <span className="text-xs opacity-75">({suitability.score}点)</span>
        </div>
        {suitability.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {suitability.reasons.map((r, i) => (
              <span key={i} className="text-xs opacity-80">
                {i > 0 && "・"}{r}
              </span>
            ))}
          </div>
        )}
        {suitability.mismatches.length > 0 && (
          <div className="text-xs opacity-60 mt-0.5">
            {suitability.mismatches.join("、")}
          </div>
        )}
      </div>
    );
  }

  // inline
  return (
    <span className="text-xs">
      {levelDef.icon} {levelDef.label} ({suitability.score}点)
    </span>
  );
}
