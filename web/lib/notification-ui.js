/**
 * 通知UI表示ユーティリティ
 *
 * 通知タイプに応じたラベル・アイコン・カラー・リンク先を提供する。
 * Phase38 event_notification_types + 既存 deadline/saved_search 通知の両方をカバー。
 */

// ─── 通知タイプ定義 ────────────────────────────────

const NOTIFICATION_TYPE_CONFIG = {
  // Phase38: 受付状態変化通知
  entry_opened: {
    label: "受付開始",
    shortLabel: "受付開始",
    icon: "🎉",
    bgClass: "bg-green-50",
    textClass: "text-green-700",
    borderClass: "border-green-400",
    badgeClass: "bg-green-100 text-green-700",
  },
  entry_almost_full: {
    label: "残りわずか",
    shortLabel: "残りわずか",
    icon: "⚡",
    bgClass: "bg-orange-50",
    textClass: "text-orange-700",
    borderClass: "border-orange-400",
    badgeClass: "bg-orange-100 text-orange-700",
  },
  entry_closed: {
    label: "受付終了",
    shortLabel: "受付終了",
    icon: "🔒",
    bgClass: "bg-gray-50",
    textClass: "text-gray-600",
    borderClass: "border-gray-400",
    badgeClass: "bg-gray-100 text-gray-600",
  },
  entry_closed_before_open: {
    label: "受付終了(未開始)",
    shortLabel: "受付中止",
    icon: "❌",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-400",
    badgeClass: "bg-red-100 text-red-700",
  },
  urgency_upgraded: {
    label: "緊急度上昇",
    shortLabel: "緊急度UP",
    icon: "🔥",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-400",
    badgeClass: "bg-red-100 text-red-700",
  },

  // 既存: 締切通知
  favorite_deadline_today: {
    label: "お気に入り本日締切",
    shortLabel: "本日締切",
    icon: "❗",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-500",
    badgeClass: "bg-red-500 text-white",
  },
  favorite_deadline_3d: {
    label: "お気に入り3日以内",
    shortLabel: "3日以内",
    icon: "⏰",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-400",
    badgeClass: "bg-red-100 text-red-700",
  },
  favorite_deadline_7d: {
    label: "お気に入り7日以内",
    shortLabel: "7日以内",
    icon: "📅",
    bgClass: "bg-pink-50",
    textClass: "text-pink-700",
    borderClass: "border-pink-400",
    badgeClass: "bg-pink-100 text-pink-700",
  },
  deadline_today: {
    label: "本日締切",
    shortLabel: "本日締切",
    icon: "❗",
    bgClass: "bg-red-50",
    textClass: "text-red-700",
    borderClass: "border-red-400",
    badgeClass: "bg-red-100 text-red-700",
  },
  deadline_3d: {
    label: "3日以内締切",
    shortLabel: "3日以内",
    icon: "⏰",
    bgClass: "bg-orange-50",
    textClass: "text-orange-700",
    borderClass: "border-orange-400",
    badgeClass: "bg-orange-100 text-orange-700",
  },
  deadline_7d: {
    label: "7日以内締切",
    shortLabel: "7日以内",
    icon: "📅",
    bgClass: "bg-yellow-50",
    textClass: "text-yellow-700",
    borderClass: "border-yellow-400",
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  saved_search_match: {
    label: "保存検索一致",
    shortLabel: "検索一致",
    icon: "🔍",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    borderClass: "border-blue-400",
    badgeClass: "bg-blue-100 text-blue-700",
  },
};

const DEFAULT_CONFIG = {
  label: "通知",
  shortLabel: "通知",
  icon: "📢",
  bgClass: "bg-gray-50",
  textClass: "text-gray-600",
  borderClass: "border-gray-300",
  badgeClass: "bg-gray-100 text-gray-600",
};

// ─── エクスポート関数 ──────────────────────────────

/**
 * 通知タイプの表示設定を取得する
 */
export function getNotificationTypeConfig(type) {
  return NOTIFICATION_TYPE_CONFIG[type] || DEFAULT_CONFIG;
}

/**
 * 通知タイプのラベルを取得する
 */
export function getNotificationTypeLabel(type) {
  return (NOTIFICATION_TYPE_CONFIG[type] || DEFAULT_CONFIG).label;
}

/**
 * 通知のリンクURLを生成する
 * link_url があればそれを使用、なければ event_id から生成
 */
export function getNotificationLinkUrl(notification) {
  if (notification.link_url) return notification.link_url;

  const eventId = extractEventId(notification);
  if (eventId) return `/marathon/${eventId}`;

  return null;
}

/**
 * 通知から event_id を抽出する
 */
export function extractEventId(notification) {
  if (notification.event_id) return notification.event_id;
  try {
    const payload = JSON.parse(notification.payload_json || "{}");
    return payload.event_id || null;
  } catch {
    return null;
  }
}

/**
 * 通知の相対時刻を生成する（例: 3分前、2時間前、昨日）
 */
export function formatNotificationTime(createdAt) {
  if (!createdAt) return "";
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return created.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

/**
 * 通知の日時を表示用にフォーマットする（例: 3/15 14:30）
 */
export function formatNotificationDateTime(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * フィルター用の通知タイプカテゴリを返す
 */
export function getNotificationTypeCategories() {
  return [
    {
      key: "",
      label: "すべて",
    },
    {
      key: "status_change",
      label: "受付状態変化",
      types: ["entry_opened", "entry_almost_full", "entry_closed", "entry_closed_before_open", "urgency_upgraded"],
    },
    {
      key: "deadline",
      label: "締切通知",
      types: ["favorite_deadline_today", "favorite_deadline_3d", "favorite_deadline_7d", "deadline_today", "deadline_3d", "deadline_7d"],
    },
    {
      key: "saved_search",
      label: "保存検索",
      types: ["saved_search_match"],
    },
  ];
}

/**
 * カテゴリに属するタイプ一覧を返す
 */
export function getTypesForCategory(categoryKey) {
  if (!categoryKey) return null; // all
  const categories = getNotificationTypeCategories();
  const cat = categories.find((c) => c.key === categoryKey);
  return cat?.types || null;
}
