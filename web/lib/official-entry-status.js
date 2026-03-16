/**
 * Phase74: 募集状態判定ロジック強化
 * Phase79: 精度強化 — ソース優先度・競合解決・confidence改善・stale判定
 *
 * 「締切日」ではなく「今ほんとうに申し込めるか」を判定する。
 *
 * 状態一覧（official_entry_status）:
 *   open             - 受付中
 *   closing_soon     - 締切間近（7日以内）
 *   capacity_warning - 定員間近（残りわずか）
 *   full             - 定員到達
 *   closed           - 募集終了
 *   suspended        - 一時停止
 *   awaiting_update  - 情報更新待ち（最終確認が古い）
 *   unknown          - 未確認
 *
 * confidence (0-100):
 *   90-100: 公式サイト直接パース確認
 *   80-89:  エントリーサイト（RUNNET/MOSHICOM）確認
 *   70-79:  シグナル複数一致
 *   50-69:  シグナル1件 or 日付推定
 *   0-49:   推定のみ or 古いデータ
 */

import { getDb } from "@/lib/db";
import { detectEntrySignals } from "@/lib/entry-status";
import { SOURCE_PRIORITY, getOfficialStatusDef as _getOfficialStatusDef } from "@/lib/official-status-defs";

// Phase75/85: official status 変化 → 通知種別マッピング
const OFFICIAL_CHANGE_NOTIFICATION_MAP = {
  capacity_warning: "official_capacity_warning",
  full: "official_full",
  closed: "official_closed",
  suspended: "official_suspended",
  awaiting_update: "official_stale_warning",
  unknown: "official_unknown_warning",
};

// closed/full/suspended → open の場合は再開通知
const REOPENED_FROM = new Set(["closed", "full", "suspended"]);

// ── 状態定義（official-status-defs.js から re-export）──

export { OFFICIAL_STATUSES, getOfficialStatusDef, UNKNOWN_REASONS, SOURCE_PRIORITY } from "@/lib/official-status-defs";

// ── Phase79: ソース優先度ボーナス ──

/**
 * ソース種別に基づく confidence ボーナスを返す
 *
 * @param {string} sourceType - "official" | "runnet" | "moshicom" | "other"
 * @returns {number} ボーナス値（0〜15）
 */
function getSourceConfidenceBonus(sourceType) {
  switch (sourceType) {
    case "official": return 15;
    case "runnet":
    case "moshicom": return 10;
    default: return 0;
  }
}

/**
 * ソース種別を推定する
 *
 * @param {object} event - イベントレコード
 * @param {object} options
 * @returns {string} "official" | "runnet" | "moshicom" | "other"
 */
function inferSourceType(event, options = {}) {
  if (options.sourceType) return options.sourceType;
  const url = options.sourceUrl || event.source_url || "";
  if (/runnet\.jp/i.test(url)) return "runnet";
  if (/moshicom\.com/i.test(url)) return "moshicom";
  if (event.source_site === "runnet") return "runnet";
  if (event.source_site === "moshicom") return "moshicom";
  // official は event_source_links で明示的に設定されるケースのみ
  return "other";
}

// ── Phase79: 複数ソース競合解決 ──

/**
 * 複数ソースの判定結果を統合し、最も信頼性の高いものを採用する
 *
 * @param {Array<{status: string, confidence: number, sourceType: string, signals: string[]}>} results
 * @returns {{status: string, confidence: number, sourceType: string, signals: string[], conflictDetected: boolean}}
 */
export function resolveSourceConflict(results) {
  if (!results || results.length === 0) {
    return { status: "unknown", confidence: 0, sourceType: "other", signals: [], conflictDetected: false };
  }
  if (results.length === 1) {
    return { ...results[0], conflictDetected: false };
  }

  // 全結果が同じ status → 競合なし
  const uniqueStatuses = [...new Set(results.map(r => r.status))];
  if (uniqueStatuses.length === 1) {
    // confidence は最高値を採用
    const best = results.reduce((a, b) => a.confidence >= b.confidence ? a : b);
    const allSignals = [...new Set(results.flatMap(r => r.signals || []))];
    return { ...best, signals: allSignals, conflictDetected: false };
  }

  // 競合あり — ソース優先度で解決
  const sorted = [...results].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.sourceType] || 99;
    const pb = SOURCE_PRIORITY[b.sourceType] || 99;
    if (pa !== pb) return pa - pb;
    return b.confidence - a.confidence;
  });

  const winner = sorted[0];
  const allSignals = [...new Set(results.flatMap(r => r.signals || []))];

  // 競合ペナルティ: confidence を少し下げる
  const conflictPenalty = 10;
  return {
    status: winner.status,
    confidence: Math.max(0, winner.confidence - conflictPenalty),
    sourceType: winner.sourceType,
    signals: allSignals,
    conflictDetected: true,
    conflictSummary: `${sorted.map(r => `${r.sourceType}:${r.status}`).join(" vs ")}`,
  };
}

// ── シグナルパターン（拡張版） ──

const CAPACITY_FULL_PATTERNS = [
  /定員に達し/,
  /満員/,
  /満席/,
  /募集人数.*到達/,
  /定員.*終了/,
  /定員オーバー/,
];

const CAPACITY_WARNING_PATTERNS = [
  /残りわずか/,
  /残り少/,
  /空き僅か/,
  /定員間近/,
  /間もなく定員/,
  /お早めに/,
  /申込.*殺到/,
];

const CLOSED_PATTERNS = [
  /受付.*終了/,
  /募集.*終了/,
  /エントリー.*終了/,
  /申込.*終了/,
  /受付.*締切/,
  /募集.*締切/,
  /受付.*停止/,
  /エントリー.*締め?切/,
];

const SUSPENDED_PATTERNS = [
  /一時.*停止/,
  /一時.*中断/,
  /受付.*中止/,
  /受付.*休止/,
  /メンテナンス/,
];

const OPEN_PATTERNS = [
  /受付中/,
  /エントリー受付中/,
  /申込.*受付中/,
  /募集中/,
  /エントリー.*開始/,
  /申込.*受付.*開始/,
];

const WAITLIST_PATTERNS = [
  /キャンセル待ち/,
  /補欠/,
  /ウェイティング/,
];

// ── Phase79: stale 閾値定数 ──

const STALE_HOURS_THRESHOLD = 72;       // 72h超 → awaiting_update 検討
const VERY_STALE_HOURS_THRESHOLD = 168; // 7日超 → awaiting_update 確定
const CONFIDENCE_DECAY_24H = 10;
const CONFIDENCE_DECAY_72H = 20;
const CONFIDENCE_DECAY_168H = 35;

// ── メイン判定関数 ──

/**
 * 大会の募集状態を総合判定する
 *
 * @param {object} event - イベントレコード
 * @param {object} [options]
 * @param {string} [options.pageText] - 最新のスクレイピングテキスト
 * @param {Array}  [options.signals] - 検出済みシグナル
 * @param {string} [options.sourceType] - "official" | "runnet" | "moshicom" | "other"
 * @param {string} [options.sourceUrl] - 取得元URL
 * @returns {{ status: string, label: string, confidence: number, signals: string[], capacityText: string|null, deadlineText: string|null, note: string|null, sourceType: string, unknownReason: string|null }}
 */
export function determineOfficialEntryStatus(event, options = {}) {
  const now = new Date();
  const pageText = options.pageText || "";
  const existingSignals = options.signals || [];
  const sourceType = inferSourceType(event, options);

  let status = "unknown";
  let confidence = 0;
  let capacityText = null;
  let deadlineText = null;
  let note = null;
  let unknownReason = null;
  const detectedSignals = [];

  // --- 1. 中止/キャンセル（最優先）---
  if (event.entry_status === "cancelled") {
    return {
      status: "closed", label: "中止", confidence: 95, signals: ["中止"],
      capacityText: null, deadlineText: null, note: "大会中止",
      sourceType, unknownReason: null,
    };
  }

  // --- 2. テキストからシグナル検出 ---
  const textToScan = pageText || event.description || "";
  const hasPageText = !!pageText && pageText.length > 50;

  // ソースボーナス（ページテキストがある = 直接確認済み）
  const sourceBonus = hasPageText ? getSourceConfidenceBonus(sourceType) : 0;

  // 定員到達
  for (const p of CAPACITY_FULL_PATTERNS) {
    if (p.test(textToScan)) {
      detectedSignals.push("定員到達");
      status = "full";
      confidence = Math.max(confidence, 85 + sourceBonus);
      capacityText = "定員に達しました";
      break;
    }
  }

  // キャンセル待ち → full扱い
  if (status !== "full") {
    for (const p of WAITLIST_PATTERNS) {
      if (p.test(textToScan)) {
        detectedSignals.push("キャンセル待ち");
        status = "full";
        confidence = Math.max(confidence, 80 + sourceBonus);
        capacityText = "キャンセル待ち";
        break;
      }
    }
  }

  // 一時停止
  if (status === "unknown") {
    for (const p of SUSPENDED_PATTERNS) {
      if (p.test(textToScan)) {
        detectedSignals.push("一時停止");
        status = "suspended";
        confidence = Math.max(confidence, 80 + sourceBonus);
        note = "エントリー受付一時停止中";
        break;
      }
    }
  }

  // 募集終了テキスト
  if (status === "unknown") {
    for (const p of CLOSED_PATTERNS) {
      if (p.test(textToScan)) {
        detectedSignals.push("募集終了");
        status = "closed";
        confidence = Math.max(confidence, 85 + sourceBonus);
        break;
      }
    }
  }

  // 定員間近
  if (status === "unknown" || status === "open") {
    for (const p of CAPACITY_WARNING_PATTERNS) {
      if (p.test(textToScan)) {
        detectedSignals.push("定員間近");
        if (status !== "full" && status !== "closed") {
          status = "capacity_warning";
          confidence = Math.max(confidence, 75 + sourceBonus);
          capacityText = "残りわずか";
        }
        break;
      }
    }
  }

  // --- 3. 既存 entry_status からの推定 ---
  if (status === "unknown") {
    if (event.entry_status === "closed" || event.entry_status === "ended") {
      status = "closed";
      confidence = Math.max(confidence, 70);
    } else if (event.entry_status === "open") {
      status = "open";
      confidence = Math.max(confidence, 60);
    } else if (event.entry_status === "upcoming") {
      status = "unknown";
      confidence = 30;
      note = "受付開始前";
      unknownReason = "pre_open";
    }
  }

  // --- 4. 日付ベース補正 ---
  if (event.entry_end_date) {
    const deadline = new Date(event.entry_end_date);
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 && status !== "full" && status !== "suspended") {
      if (status !== "closed") {
        status = "closed";
        confidence = Math.max(confidence, 65);
        note = "締切日超過";
      }
    } else if (diffDays >= 0 && diffDays <= 7) {
      deadlineText = diffDays === 0 ? "本日締切" : `あと${diffDays}日`;
      if (status === "open") {
        status = "closing_soon";
        confidence = Math.max(confidence, 70);
      }
    } else if (diffDays > 7) {
      deadlineText = `${deadline.getMonth() + 1}/${deadline.getDate()}まで`;
    }
  }

  // --- 5. 受付中テキスト確認 ---
  if (status === "unknown") {
    for (const p of OPEN_PATTERNS) {
      if (p.test(textToScan)) {
        detectedSignals.push("受付中");
        status = "open";
        confidence = Math.max(confidence, 75 + sourceBonus);
        break;
      }
    }
  }

  // --- 6. 開催日過去 → closed ---
  if (event.event_date) {
    const eventDate = new Date(event.event_date);
    if (eventDate < now && status !== "closed") {
      status = "closed";
      confidence = Math.max(confidence, 90);
      note = "開催終了";
    }
  }

  // --- 7. 既存シグナルの統合 ---
  if (existingSignals.length > 0) {
    for (const sig of existingSignals) {
      if (!detectedSignals.includes(sig)) detectedSignals.push(sig);
    }
    if (confidence < 50 && detectedSignals.length > 0) {
      confidence = 50;
    }
  }

  // --- 8. Phase79: 鮮度による confidence 減衰 + awaiting_update 判定 ---
  const hoursAgo = calcHoursAgo(event.last_verified_at, now);
  if (hoursAgo !== null) {
    if (hoursAgo > VERY_STALE_HOURS_THRESHOLD) {
      // 7日超 → 受付中/締切間近/定員間近は信頼できない → awaiting_update に格下げ
      confidence = Math.max(0, confidence - CONFIDENCE_DECAY_168H);
      if (status === "open" || status === "closing_soon" || status === "capacity_warning") {
        status = "awaiting_update";
        note = (note ? note + " / " : "") + "最終確認から7日以上経過";
        unknownReason = "stale_data";
      } else {
        note = (note ? note + " / " : "") + "データが古い可能性";
      }
    } else if (hoursAgo > STALE_HOURS_THRESHOLD) {
      confidence = Math.max(0, confidence - CONFIDENCE_DECAY_72H);
      note = (note ? note + " / " : "") + "データが古い可能性";
    } else if (hoursAgo > 24) {
      confidence = Math.max(0, confidence - CONFIDENCE_DECAY_24H);
    }
  } else {
    // 未確認
    confidence = Math.min(confidence, 40);
    if (!event.source_url) {
      unknownReason = unknownReason || "no_source";
    }
  }

  // --- 9. Phase79: unknown 理由の補完 ---
  if (status === "unknown" && !unknownReason) {
    if (!event.source_url) {
      unknownReason = "no_source";
    } else if (hasPageText && detectedSignals.length === 0) {
      unknownReason = "ambiguous_text";
    } else if (!hasPageText && !event.description) {
      unknownReason = "no_source";
    } else {
      unknownReason = "ambiguous_text";
    }
  }

  // confidence 上限キャップ (100)
  confidence = Math.min(100, confidence);

  const statusDef = _getOfficialStatusDef(status);

  return {
    status,
    label: statusDef.label,
    confidence,
    signals: detectedSignals,
    capacityText,
    deadlineText,
    note,
    sourceType,
    unknownReason,
  };
}

/**
 * 最終確認からの経過時間（時間単位）を算出
 */
function calcHoursAgo(lastVerifiedAt, now) {
  if (!lastVerifiedAt) return null;
  const lastCheck = new Date(lastVerifiedAt);
  return (now - lastCheck) / (1000 * 60 * 60);
}

// ── DB更新 ──

/**
 * 判定結果をDBに保存する
 *
 * @param {number} eventId
 * @param {object} result - determineOfficialEntryStatus の戻り値
 * @param {string} [sourceUrl]
 */
export function saveOfficialEntryStatus(eventId, result, sourceUrl = null) {
  const db = getDb();
  const now = new Date().toISOString();

  // 現在の状態を取得（差分検出用）
  const current = db
    .prepare("SELECT official_entry_status, official_entry_status_label FROM events WHERE id = ?")
    .get(eventId);

  // events テーブル更新 (Phase79: source_type, unknown_reason 追加)
  db.prepare(`
    UPDATE events SET
      official_entry_status = ?,
      official_entry_status_label = ?,
      official_checked_at = ?,
      official_deadline_text = ?,
      official_capacity_text = ?,
      official_status_source_url = ?,
      official_status_confidence = ?,
      official_status_note = ?,
      official_status_source_type = ?,
      official_unknown_reason = ?
    WHERE id = ?
  `).run(
    result.status,
    result.label,
    now,
    result.deadlineText || null,
    result.capacityText || null,
    sourceUrl || null,
    result.confidence,
    result.note || null,
    result.sourceType || null,
    result.unknownReason || null,
    eventId,
  );

  // Phase75: 状態変化時にログ記録 + 通知生成
  if (current && current.official_entry_status && current.official_entry_status !== result.status) {
    db.prepare(`
      INSERT INTO entry_status_changes (
        event_id, previous_status, new_status,
        previous_label, new_label,
        change_source, confidence,
        detected_signals_json, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      current.official_entry_status,
      result.status,
      current.official_entry_status_label,
      result.label,
      "monitor",
      result.confidence,
      result.signals.length > 0 ? JSON.stringify(result.signals) : null,
      result.note || null,
      now,
    );

    // Phase75: 通知キュー追加（お気に入り・保存済みユーザー向け）
    try {
      const prevStatus = current.official_entry_status;
      let notificationType = null;

      if (REOPENED_FROM.has(prevStatus) && (result.status === "open" || result.status === "closing_soon")) {
        notificationType = "official_reopened";
      } else {
        notificationType = OFFICIAL_CHANGE_NOTIFICATION_MAP[result.status] || null;
      }

      if (notificationType) {
        queueOfficialStatusChangeNotifications(db, eventId, notificationType, prevStatus, result, now);
      }
    } catch {
      // 通知生成失敗は保存に影響させない
    }
  }
}

/**
 * Phase75: official status 変化に対する通知をキューに追加
 * お気に入り登録ユーザーに通知する。
 */
function queueOfficialStatusChangeNotifications(db, eventId, notificationType, prevStatus, result, now) {
  // イベント情報取得
  const event = db.prepare("SELECT id, title, sport_type, prefecture FROM events WHERE id = ?").get(eventId);
  if (!event) return;

  // お気に入り登録ユーザーを取得
  const favoriteUsers = db.prepare(
    "SELECT DISTINCT user_key FROM favorites WHERE event_id = ?"
  ).all(eventId);

  if (favoriteUsers.length === 0) return;

  const triggerDate = now.slice(0, 10);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO notifications
    (user_key, type, title, body, payload_json, event_id, trigger_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const { user_key } of favoriteUsers) {
    const triggerKey = `official:${eventId}:${notificationType}:${prevStatus}>${result.status}:${triggerDate}`;
    const title = `${result.label}: ${event.title}`;
    const body = `お気に入りの大会「${event.title}」の募集状態が「${result.label}」に変わりました。`;
    const payload = JSON.stringify({
      event_id: eventId,
      notification_type: notificationType,
      previous_status: prevStatus,
      new_status: result.status,
      confidence: result.confidence,
    });

    try {
      insertStmt.run(user_key, notificationType, title, body, payload, eventId, triggerKey);
    } catch {
      // 重複 or エラーは無視
    }
  }
}

// ── 一括判定（バッチ用） ──

/**
 * 全未判定イベントの official_entry_status を一括更新
 * Phase79: ソース種別を渡す、priorityベースの対象選定
 *
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @returns {{ updated: number, changes: number, awaitingUpdate: number }}
 */
export function batchUpdateOfficialStatuses(options = {}) {
  const db = getDb();
  const limit = options.limit || 100;

  // Phase79: 優先度改善 — open/closing_soon/capacity_warning を最優先、
  // 次に未判定、最後に古いデータ
  const targets = db
    .prepare(`
      SELECT id, title, entry_status, entry_end_date, entry_start_date,
             event_date, description, entry_signals_json,
             last_verified_at, official_entry_status,
             source_url, source_site
      FROM events
      WHERE is_active = 1
        AND (event_date IS NULL OR event_date >= date('now', '-1 day'))
        AND (
          official_entry_status IS NULL
          OR official_checked_at IS NULL
          OR official_checked_at < datetime('now', '-6 hours')
        )
      ORDER BY
        CASE
          WHEN official_entry_status IN ('open', 'closing_soon', 'capacity_warning') THEN 0
          WHEN official_entry_status IS NULL THEN 1
          WHEN entry_status = 'open' THEN 2
          ELSE 3
        END,
        entry_end_date ASC NULLS LAST
      LIMIT ?
    `)
    .all(limit);

  let updated = 0;
  let changes = 0;
  let awaitingUpdate = 0;

  for (const event of targets) {
    let signals = [];
    if (event.entry_signals_json) {
      try { signals = JSON.parse(event.entry_signals_json); } catch {}
    }

    const result = determineOfficialEntryStatus(event, { signals });
    const hadPrevious = !!event.official_entry_status;
    const changed = hadPrevious && event.official_entry_status !== result.status;

    saveOfficialEntryStatus(event.id, result, event.source_url);
    updated++;
    if (changed) changes++;
    if (result.status === "awaiting_update") awaitingUpdate++;
  }

  return { updated, changes, awaitingUpdate };
}
