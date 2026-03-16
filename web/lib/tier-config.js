/**
 * Phase104: ティア定義・機能制限設定
 *
 * 無料/プレミアムの機能制限を定義。
 * 現時点では全ユーザーfree。将来users.tierカラム追加で拡張。
 */

export const TIERS = {
  free: {
    label: "無料会員",
    maxSaved: 20,
    maxCompare: 3,
    maxSearches: 3,
    hasAdvancedAlerts: false,
    hasExport: false,
    hasPriority: false,
  },
  premium: {
    label: "プレミアム",
    maxSaved: 100,
    maxCompare: 10,
    maxSearches: 20,
    hasAdvancedAlerts: true,
    hasExport: true,
    hasPriority: true,
  },
};

/**
 * 現在のユーザーティアを取得（常にfree）
 */
export function getUserTier() {
  return "free";
}

/**
 * ティアの制限値を取得
 */
export function getTierLimits(tier) {
  return TIERS[tier] || TIERS.free;
}

/**
 * 現在のユーザーの制限値を取得
 */
export function getCurrentLimits() {
  return getTierLimits(getUserTier());
}

/**
 * プレミアム限定機能かどうか
 */
export function isPremiumFeature(feature) {
  const freeConfig = TIERS.free;
  const premiumConfig = TIERS.premium;
  return !freeConfig[feature] && premiumConfig[feature];
}

/**
 * 比較表用のプラン機能リスト
 */
export const PLAN_FEATURES = [
  { key: "saved", label: "大会保存", free: "最大20件", premium: "最大100件" },
  { key: "compare", label: "大会比較", free: "最大3件", premium: "最大10件" },
  { key: "searches", label: "保存検索条件", free: "最大3件", premium: "最大20件" },
  { key: "alerts", label: "通知", free: "基本通知", premium: "高度な通知" },
  { key: "export", label: "データエクスポート", free: "—", premium: "CSV出力" },
  { key: "priority", label: "優先サポート", free: "—", premium: "✓" },
  { key: "profile", label: "ランナープロフィール", free: "✓", premium: "✓" },
  { key: "suitability", label: "適性スコア", free: "✓", premium: "✓" },
  { key: "recommendation", label: "おすすめ大会", free: "✓", premium: "✓" },
];
