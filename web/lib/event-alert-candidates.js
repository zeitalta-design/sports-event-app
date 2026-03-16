/**
 * Phase60: 通知候補判定ロジック
 *
 * 保存済み大会・比較候補大会に対して、現在時点で
 * ユーザーに知らせるべき「通知候補」をルールベースで生成する。
 *
 * LLMコスト不要。cron実行前提でも使える構造。
 *
 * 公開関数:
 *   - buildEventAlertCandidates(data)    → 1大会の通知候補
 *   - buildSavedEventsAlerts(events)     → 保存済み大会群の通知一覧
 *   - summarizeAlertCounts(alertItems)   → 件数サマリー
 *
 * @module event-alert-candidates
 */

// ════════════════════════════════════════════════════
//  ヘルパー
// ════════════════════════════════════════════════════

/**
 * 日付から今日までの日数を計算
 * @param {string|null} dateStr
 * @returns {number|null}
 */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  if (isNaN(target.getTime())) return null;
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * 中止/延期文言検出
 * @param {object} data
 * @returns {boolean}
 */
function detectCancelledOrPostponed(data) {
  if (data.entry_status === "cancelled") return true;
  const texts = [
    data.title,
    data.summary,
    data.notes,
  ].filter(Boolean).join(" ");
  return /中止|延期|開催見送|開催中止/.test(texts);
}

/**
 * 定員/先着注意文言検出
 * @param {object} data
 * @returns {boolean}
 */
function detectCapacityWarning(data) {
  const texts = [
    data.capacity_info,
    data.notes,
    data.summary,
  ].filter(Boolean).join(" ");
  return /定員|先着|上限|抽選/.test(texts);
}

/**
 * アラート配列から重複を除去
 * @param {Array} alerts
 * @returns {Array}
 */
function dedupeAlerts(alerts) {
  const seen = new Set();
  return alerts.filter((a) => {
    if (seen.has(a.type)) return false;
    seen.add(a.type);
    return true;
  });
}

/**
 * アラート群から最も高いレベルを決定
 * @param {Array} alerts
 * @returns {"high"|"medium"|"low"|"info"|"none"}
 */
function getAlertLevelFromSignals(alerts) {
  if (alerts.length === 0) return "none";
  const levels = alerts.map((a) => a.level);
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  if (levels.includes("low")) return "low";
  return "info";
}

// ════════════════════════════════════════════════════
//  A. buildEventAlertCandidates
// ════════════════════════════════════════════════════

/**
 * 1大会に対して現在時点で出すべき通知候補を返す
 *
 * @param {object} data - イベント情報（API by-ids レスポンス形式 or getMarathonDetailPageData() 形式）
 * @returns {{ eventId: number, sportSlug: string, level: string, alerts: Array<{ type: string, level: string, label: string, note: string }> }}
 */
export function buildEventAlertCandidates(data) {
  const alerts = [];
  const eventId = data.id || data.eventId;
  const sportSlug = data.sport_slug || data.sportSlug || "marathon";

  // --- 中止/延期 ---
  if (detectCancelledOrPostponed(data)) {
    alerts.push({
      type: "cancelled",
      level: "high",
      label: "中止・延期の可能性",
      note: data.entry_status === "cancelled"
        ? "この大会は中止が発表されています"
        : "中止または延期に関する情報が確認されています",
    });
  }

  // --- 受付終了 ---
  if (data.entry_status === "closed" && !detectCancelledOrPostponed(data)) {
    alerts.push({
      type: "entry_closed",
      level: "high",
      label: "受付終了",
      note: "この大会のエントリー受付は終了しています",
    });
  }

  // --- 締切系 ---
  const deadlineDate = data.entry_end_date || data.entryEndDate;
  const daysDeadline = daysUntil(deadlineDate);
  if (daysDeadline !== null && data.entry_status === "open") {
    if (daysDeadline <= 0) {
      alerts.push({
        type: "deadline_passed",
        level: "high",
        label: "申込期限を過ぎています",
        note: "申込期限が過ぎた可能性があります。掲載元でご確認ください",
      });
    } else if (daysDeadline <= 3) {
      alerts.push({
        type: "deadline_imminent",
        level: "high",
        label: "締切が近づいています",
        note: daysDeadline === 1
          ? "申込期限は明日です"
          : `申込期限まで残り${daysDeadline}日です`,
      });
    } else if (daysDeadline <= 7) {
      alerts.push({
        type: "deadline_soon",
        level: "high",
        label: "締切が近づいています",
        note: `申込期限まで残り${daysDeadline}日です`,
      });
    } else if (daysDeadline <= 14) {
      alerts.push({
        type: "deadline_2weeks",
        level: "medium",
        label: "締切2週間以内",
        note: `申込期限まであと${daysDeadline}日です`,
      });
    }
  }

  // --- 開催日系 ---
  const eventDate = data.event_date || data.eventDate;
  const daysEvent = daysUntil(eventDate);
  if (daysEvent !== null) {
    if (daysEvent < 0) {
      alerts.push({
        type: "event_finished",
        level: "low",
        label: "開催済み",
        note: "この大会はすでに終了しています",
      });
    } else if (daysEvent <= 7) {
      alerts.push({
        type: "event_imminent",
        level: "high",
        label: "開催日が近い大会です",
        note: daysEvent === 0
          ? "本日開催です"
          : `開催まであと${daysEvent}日です`,
      });
    } else if (daysEvent <= 14) {
      alerts.push({
        type: "event_soon",
        level: "medium",
        label: "開催日が近づいています",
        note: `開催まであと${daysEvent}日です`,
      });
    }
  }

  // --- 定員/先着 ---
  if (detectCapacityWarning(data) && data.entry_status === "open") {
    alerts.push({
      type: "capacity_limited",
      level: "medium",
      label: "定員あり",
      note: "定員制のため、早めの申込がおすすめです",
    });
  }

  // --- 情報鮮度 ---
  if (data.freshness && data.freshness.cautionText) {
    alerts.push({
      type: "stale_data",
      level: "low",
      label: "情報が古い可能性",
      note: "掲載元で最新情報をご確認ください",
    });
  } else if (data.last_verified_at || data.lastVerifiedAt) {
    const verifiedDate = data.last_verified_at || data.lastVerifiedAt;
    const daysStale = daysUntil(verifiedDate);
    if (daysStale !== null && daysStale < -30) {
      alerts.push({
        type: "stale_data",
        level: "low",
        label: "情報の更新確認をおすすめします",
        note: "最終確認から30日以上が経過しています",
      });
    }
  }

  // 重複除去 & 最大3件に絞る
  const deduped = dedupeAlerts(alerts).slice(0, 3);

  return {
    eventId,
    sportSlug,
    level: getAlertLevelFromSignals(deduped),
    alerts: deduped,
  };
}

// ════════════════════════════════════════════════════
//  B. buildSavedEventsAlerts
// ════════════════════════════════════════════════════

/**
 * 保存済み大会群から通知候補一覧を生成する
 *
 * @param {Array<object>} events - イベント情報の配列
 * @returns {Array<{ eventId: number, sportSlug: string, title: string, level: string, topAlertLabel: string, alerts: Array, eventDate: string|null, prefecture: string|null, path: string }>}
 */
export function buildSavedEventsAlerts(events) {
  if (!events || events.length === 0) return [];

  const results = [];

  for (const ev of events) {
    try {
      const candidate = buildEventAlertCandidates(ev);

      // アラートがなくても一覧に含める（閲覧確認用）
      const sportSlug = ev.sport_slug || ev.sportSlug || "marathon";
      const path = sportSlug === "marathon"
        ? `/marathon/${ev.id}`
        : `/${sportSlug}/${ev.id}`;

      results.push({
        eventId: ev.id,
        sportSlug,
        title: ev.title || "不明な大会",
        level: candidate.level,
        topAlertLabel: candidate.alerts.length > 0
          ? candidate.alerts[0].label
          : null,
        alerts: candidate.alerts,
        eventDate: ev.event_date || ev.eventDate || null,
        entryEndDate: ev.entry_end_date || ev.entryEndDate || null,
        entryStatus: ev.entry_status || ev.entryStatus || null,
        prefecture: ev.prefecture || null,
        city: ev.city || null,
        path,
      });
    } catch {
      // 個別エラーは無視、取得できた分だけ返す
    }
  }

  // ソート: high → medium → low → info → none、同レベル内は開催日/締切が近い順
  const LEVEL_ORDER = { high: 0, medium: 1, low: 2, info: 3, none: 4 };
  results.sort((a, b) => {
    const la = LEVEL_ORDER[a.level] ?? 9;
    const lb = LEVEL_ORDER[b.level] ?? 9;
    if (la !== lb) return la - lb;

    // 同レベル内は締切 or 開催日が近い順
    const dateA = a.entryEndDate || a.eventDate || "9999";
    const dateB = b.entryEndDate || b.eventDate || "9999";
    return dateA.localeCompare(dateB);
  });

  return results;
}

// ════════════════════════════════════════════════════
//  C. summarizeAlertCounts
// ════════════════════════════════════════════════════

/**
 * 通知一覧の件数サマリーを生成
 *
 * @param {Array<{ level: string }>} alertItems
 * @returns {{ high: number, medium: number, low: number, none: number, total: number }}
 */
export function summarizeAlertCounts(alertItems) {
  const counts = { high: 0, medium: 0, low: 0, none: 0, total: 0 };

  for (const item of alertItems) {
    counts.total++;
    if (item.level === "high") counts.high++;
    else if (item.level === "medium") counts.medium++;
    else if (item.level === "low" || item.level === "info") counts.low++;
    else counts.none++;
  }

  return counts;
}
