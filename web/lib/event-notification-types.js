/**
 * 受付状態変化の通知種別定義
 *
 * 監視ジョブが検知した状態変化に対応する通知タイプを定義し、
 * タイトル・本文・重要度の生成ロジックを提供する。
 */

// ─── 通知種別定数 ────────────────────────────────

export const NOTIFICATION_TYPES = {
  entry_opened: {
    key: "entry_opened",
    label: "受付開始",
    description: "受付前 → 受付中",
    importance: "high",
  },
  entry_almost_full: {
    key: "entry_almost_full",
    label: "残りわずか",
    description: "受付中 → 残りわずか検出",
    importance: "high",
  },
  entry_closed: {
    key: "entry_closed",
    label: "受付終了",
    description: "受付中/残りわずか → 受付終了",
    importance: "medium",
  },
  entry_closed_before_open: {
    key: "entry_closed_before_open",
    label: "受付終了(未開始)",
    description: "受付前 → 受付終了/中止",
    importance: "medium",
  },
  urgency_upgraded: {
    key: "urgency_upgraded",
    label: "緊急度上昇",
    description: "urgency level が上昇した",
    importance: "medium",
  },
  // Phase75: official_entry_status 変化系
  official_capacity_warning: {
    key: "official_capacity_warning",
    label: "定員間近",
    description: "official_entry_status が capacity_warning に変化",
    importance: "high",
  },
  official_full: {
    key: "official_full",
    label: "定員到達",
    description: "official_entry_status が full に変化",
    importance: "high",
  },
  official_closed: {
    key: "official_closed",
    label: "募集終了",
    description: "official_entry_status が closed に変化",
    importance: "medium",
  },
  official_suspended: {
    key: "official_suspended",
    label: "一時停止",
    description: "official_entry_status が suspended に変化",
    importance: "medium",
  },
  official_reopened: {
    key: "official_reopened",
    label: "受付再開",
    description: "closed/full/suspended → open に変化",
    importance: "high",
  },
  // Phase85: 追加通知タイプ
  official_stale_warning: {
    key: "official_stale_warning",
    label: "情報更新待ち",
    description: "受付中の大会で情報が古くなっている",
    importance: "low",
  },
  official_unknown_warning: {
    key: "official_unknown_warning",
    label: "状態不明",
    description: "大会の募集状態が確認できない",
    importance: "low",
  },
};

// urgency レベルの重み（比較用）
const URGENCY_WEIGHT = {
  comfortable: 0,
  first_come: 1,
  early_recommended: 2,
  early_close_warning: 3,
  fills_fast: 4,
};

// ─── 変化種別検出 ─────────────────────────────────

/**
 * before/after のスナップショットから通知すべき変化種別を検出する
 *
 * @param {object} before - { status, urgencyLabel, urgencyLevel, signals }
 * @param {object} after  - { status, urgencyLabel, urgencyLevel, signals }
 * @returns {string|null} NOTIFICATION_TYPES のキー、または null（通知不要）
 */
export function detectNotificationChangeType(before, after) {
  const bs = before.status || "unknown";
  const as = after.status || "unknown";

  // 受付前 → 受付中
  if (bs === "upcoming" && as === "open") {
    return "entry_opened";
  }

  // 受付中 → 受付終了
  if ((bs === "open") && (as === "closed" || as === "ended")) {
    return "entry_closed";
  }

  // 受付前 → 受付終了/中止
  if (bs === "upcoming" && (as === "closed" || as === "ended" || as === "cancelled")) {
    return "entry_closed_before_open";
  }

  // 残りわずか検出: シグナルに「残りわずか」系が出現
  if (as === "open" && after.signals) {
    const almostFullSignals = ["残りわずか", "定員間近", "few_remaining"];
    const hasAlmostFull = after.signals.some((s) => {
      const label = typeof s === "string" ? s : s.label || "";
      return almostFullSignals.some((k) => label.includes(k));
    });
    const hadAlmostFull = before.signals
      ? before.signals.some((s) => {
          const label = typeof s === "string" ? s : s.label || "";
          return almostFullSignals.some((k) => label.includes(k));
        })
      : false;
    if (hasAlmostFull && !hadAlmostFull) {
      return "entry_almost_full";
    }
  }

  // urgency 上昇
  const bw = URGENCY_WEIGHT[before.urgencyLabel] ?? -1;
  const aw = URGENCY_WEIGHT[after.urgencyLabel] ?? -1;
  if (aw > bw && aw >= 3) {
    // early_close_warning 以上に上昇した場合のみ通知
    return "urgency_upgraded";
  }

  return null;
}

// ─── 通知コンテンツ生成 ──────────────────────────────

/**
 * 通知のタイトル・本文を生成する
 *
 * @param {object} params
 * @param {object} params.event - { id, title }
 * @param {string} params.changeType - NOTIFICATION_TYPES のキー
 * @param {string} [params.beforeStatus]
 * @param {string} [params.afterStatus]
 * @param {string} [params.urgencyLabel]
 * @param {string} [params.source] - "favorite" | "saved_search"
 * @returns {{ title: string, message: string, importance: string }}
 */
export function buildEventNotificationContent({
  event,
  changeType,
  beforeStatus,
  afterStatus,
  urgencyLabel,
  source,
}) {
  const typeDef = NOTIFICATION_TYPES[changeType];
  if (!typeDef) {
    return {
      title: `${event.title} の受付状態が変わりました`,
      message: `受付状態が ${beforeStatus || "?"} から ${afterStatus || "?"} に変更されました。`,
      importance: "low",
    };
  }

  const eventTitle = event.title || "大会";
  const sourcePrefix = source === "favorite" ? "お気に入りの" : "";

  const templates = {
    entry_opened: {
      title: `${sourcePrefix}大会が受付開始: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」のエントリー受付が開始されました。`,
    },
    entry_almost_full: {
      title: `${sourcePrefix}大会で「残りわずか」: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」で「残りわずか」が確認されました。お早めにエントリーをご検討ください。`,
    },
    entry_closed: {
      title: `${sourcePrefix}大会が受付終了: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」のエントリー受付が終了しました。`,
    },
    entry_closed_before_open: {
      title: `${sourcePrefix}大会が受付終了: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」は受付開始前に終了/中止となりました。`,
    },
    urgency_upgraded: {
      title: `${sourcePrefix}大会の緊急度が上昇: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」は人気で早期締切注意に更新されました。`,
    },
    // Phase75: official status 変化
    official_capacity_warning: {
      title: `🔥 ${sourcePrefix}大会が定員間近: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」の募集が定員に近づいています。お早めにエントリーをご検討ください。`,
    },
    official_full: {
      title: `⛔ ${sourcePrefix}大会が定員到達: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」は定員に到達しました。キャンセル待ちの場合があります。`,
    },
    official_closed: {
      title: `${sourcePrefix}大会の募集終了: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」のエントリー募集が終了しました。`,
    },
    official_suspended: {
      title: `${sourcePrefix}大会のエントリー一時停止: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」のエントリー受付が一時停止されています。`,
    },
    official_reopened: {
      title: `🎉 ${sourcePrefix}大会の受付再開: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」のエントリー受付が再開されました！お早めにご確認ください。`,
    },
    // Phase85
    official_stale_warning: {
      title: `⏳ ${sourcePrefix}大会の情報が古くなっています: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」の募集状態が最終確認から時間が経っています。公式サイトで最新情報をご確認ください。`,
    },
    official_unknown_warning: {
      title: `❓ ${sourcePrefix}大会の募集状態を確認できません: ${eventTitle}`,
      message: `${sourcePrefix}「${eventTitle}」の募集状態が不明です。公式サイトで直接ご確認ください。`,
    },
  };

  const tmpl = templates[changeType] || templates.entry_closed;

  return {
    title: tmpl.title,
    message: tmpl.message,
    importance: typeDef.importance,
  };
}

// ─── trigger_key 生成 ─────────────────────────────

/**
 * 重複防止用の trigger_key を生成する
 *
 * @param {object} params
 * @param {number} params.eventId
 * @param {string} params.changeType
 * @param {string} [params.beforeStatus]
 * @param {string} [params.afterStatus]
 * @param {string} [params.verifiedAt] - ISO timestamp
 * @returns {string}
 */
export function buildNotificationTriggerKey({
  eventId,
  changeType,
  beforeStatus,
  afterStatus,
  verifiedAt,
}) {
  // 日付部分のみ（同日の同一変化は1回のみ）
  const dateKey = verifiedAt ? verifiedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `event:${eventId}:${changeType}:${beforeStatus || "?"}>${afterStatus || "?"}:${dateKey}`;
}
