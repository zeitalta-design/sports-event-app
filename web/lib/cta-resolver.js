/**
 * Phase96: CTA最適化ロジック
 *
 * 大会の状態に応じた最適なCTAを決定する。
 * クライアントサイド（DB不要）。
 * Phase87 の STATUS_CTA_TEXT を活用。
 */

import { STATUS_CTA_TEXT } from "@/lib/status-copy";

/**
 * 大会の状態に応じた最適CTAを決定
 *
 * @param {object} event - 大会データ
 *   必要フィールド: official_entry_status, entry_status, entry_url, source_url
 * @param {object} [options]
 * @param {string} [options.context="detail"] - "detail" | "card" | "compare"
 * @returns {{
 *   primary: { label: string, href: string, variant: string } | null,
 *   secondary: { label: string, href: string, variant: string } | null,
 *   hint: string
 * }}
 */
export function resolveCTA(event, options = {}) {
  const { context = "detail" } = options;

  // 状態を決定（official_entry_status 優先）
  const status = resolveEffectiveStatus(event);
  const copyDef = STATUS_CTA_TEXT[status] || STATUS_CTA_TEXT.unknown;

  const entryUrl = event.entry_url || null;
  const sourceUrl = event.source_url || null;

  const result = {
    primary: null,
    secondary: null,
    hint: copyDef.hint || "",
  };

  // primary CTA
  if (copyDef.primary && entryUrl) {
    result.primary = {
      label: copyDef.primary,
      href: entryUrl,
      variant: getVariantForStatus(status),
    };
  }

  // secondary CTA
  if (copyDef.secondary) {
    const href = entryUrl || sourceUrl;
    if (href) {
      result.secondary = {
        label: copyDef.secondary,
        href,
        variant: "secondary",
      };
    }
  }

  // fallback: source_url があるなら secondary に公式サイトリンク
  if (!result.primary && !result.secondary && sourceUrl) {
    result.secondary = {
      label: "公式サイトで確認",
      href: sourceUrl,
      variant: "secondary",
    };
  }

  return result;
}

/**
 * 有効な状態を解決
 */
function resolveEffectiveStatus(event) {
  // official_entry_status 優先
  const official = event.official_entry_status;
  if (official && STATUS_CTA_TEXT[official]) {
    return official;
  }

  // entry_status から推定
  const entry = event.entry_status;
  if (entry === "open") return "open";
  if (entry === "closed" || entry === "ended") return "closed";
  if (entry === "cancelled") return "closed";

  return "unknown";
}

/**
 * 状態に応じたボタンバリアント
 */
function getVariantForStatus(status) {
  switch (status) {
    case "open":
      return "primary";
    case "closing_soon":
    case "capacity_warning":
      return "urgent";
    default:
      return "secondary";
  }
}

/**
 * CTAのCSSクラスを取得
 *
 * @param {string} variant - "primary" | "urgent" | "secondary"
 * @returns {string}
 */
export function getCTAClassName(variant) {
  switch (variant) {
    case "primary":
      return "bg-blue-600 text-white hover:bg-blue-700 border-blue-600";
    case "urgent":
      return "bg-red-600 text-white hover:bg-red-700 border-red-600 animate-pulse";
    case "secondary":
      return "bg-white text-gray-700 hover:bg-gray-50 border-gray-300";
    default:
      return "bg-white text-gray-600 hover:bg-gray-50 border-gray-300";
  }
}
