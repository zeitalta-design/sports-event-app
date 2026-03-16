/**
 * Phase87: 募集状態に関する統一コピー定義
 *
 * バッジ、CTA、警告、通知など全箇所で使用する文言を一元管理。
 * クライアント安全（DB依存なし）。
 */

// ── ステータスごとのCTAテキスト ──

export const STATUS_CTA_TEXT = {
  open: {
    primary: "エントリーする",
    secondary: "公式サイトで申し込む",
    hint: "受付中です。お早めにエントリーしましょう。",
  },
  closing_soon: {
    primary: "今すぐエントリー",
    secondary: "締切間近！公式サイトへ",
    hint: "締切が迫っています。お急ぎください。",
  },
  capacity_warning: {
    primary: "今すぐエントリー",
    secondary: "残りわずか！公式サイトへ",
    hint: "定員間近です。枠がなくなる前にお申し込みください。",
  },
  full: {
    primary: null,
    secondary: "公式サイトで確認",
    hint: "定員に達しました。キャンセル待ちの場合があります。",
  },
  closed: {
    primary: null,
    secondary: "公式サイトで確認",
    hint: "エントリー受付は終了しました。",
  },
  suspended: {
    primary: null,
    secondary: "公式サイトで確認",
    hint: "エントリーが一時停止中です。再開をお待ちください。",
  },
  awaiting_update: {
    primary: null,
    secondary: "公式サイトで最新情報を確認",
    hint: "情報が古い可能性があります。公式サイトで最新の募集状態をご確認ください。",
  },
  unknown: {
    primary: null,
    secondary: "公式サイトで確認",
    hint: "募集状態を確認できませんでした。公式サイトで直接ご確認ください。",
  },
};

// ── 状態変化の説明テキスト ──

export const STATUS_CHANGE_TEXT = {
  "open→closing_soon": "締切が近づいています",
  "open→capacity_warning": "定員間近になりました",
  "open→full": "定員に達しました",
  "open→closed": "募集が終了しました",
  "closing_soon→closed": "募集が終了しました",
  "closing_soon→full": "定員に達しました",
  "capacity_warning→full": "定員に達しました",
  "capacity_warning→closed": "募集が終了しました",
  "closed→open": "受付が再開されました",
  "full→open": "受付が再開されました",
  "suspended→open": "受付が再開されました",
};

/**
 * 状態変化の説明テキストを取得
 */
export function getStatusChangeText(fromStatus, toStatus) {
  return STATUS_CHANGE_TEXT[`${fromStatus}→${toStatus}`] || `${fromStatus} → ${toStatus}`;
}

// ── 公式サイトリンクの統一テキスト ──

export const OFFICIAL_LINK_TEXT = {
  default: "公式サイトで確認",
  entry: "公式サイトでエントリー",
  check_status: "最新の募集状態を確認",
  check_detail: "大会の詳細を確認",
};

// ── 信頼度の表示テキスト ──

export function getConfidenceText(confidence) {
  if (confidence == null) return "未確認";
  if (confidence >= 80) return "高い信頼度";
  if (confidence >= 60) return "中程度の信頼度";
  if (confidence >= 40) return "低い信頼度";
  return "不確実な情報";
}

export function getConfidenceIcon(confidence) {
  if (confidence == null) return "⚪";
  if (confidence >= 80) return "🟢";
  if (confidence >= 60) return "🟡";
  if (confidence >= 40) return "🟠";
  return "⚪";
}

// ── 鮮度の表示テキスト ──

export function getFreshnessText(checkedAt) {
  if (!checkedAt) return "未確認";
  const d = new Date(checkedAt);
  if (isNaN(d.getTime())) return "未確認";
  const now = new Date();
  const diffH = Math.floor((now - d) / (1000 * 60 * 60));
  if (diffH < 1) return "1時間以内に確認";
  if (diffH < 24) return `${diffH}時間前に確認`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "昨日確認";
  return `${diffD}日前に確認`;
}
