/**
 * 受付状態の正確な表示ロジック
 *
 * ソース由来の文字列 + 日付ロジック の両方で判定する。
 * すべてのページ（一覧・詳細・比較・関連大会）で共通利用する。
 *
 * 判定優先順位:
 *   1. 開催日を過ぎている → "ended"（開催終了）
 *   2. 申込終了日を過ぎている → "closed"（受付終了）
 *   3. ソースが明示的に "closed" / "cancelled" → そのまま
 *   4. 申込開始前 → "upcoming"（受付前）
 *   5. 申込期間内 → "open"（受付中）
 *   6. 判定不能 → ソース値 or "unknown"
 */

// ─── ステータス定義 ──────────────────────────────

export const DISPLAY_STATUS = {
  open: { label: "受付中", className: "bg-green-100 text-green-700 border-green-300" },
  upcoming: { label: "受付予定", className: "bg-blue-100 text-blue-700 border-blue-300" },
  closed: { label: "受付終了", className: "bg-gray-200 text-gray-600 border-gray-300" },
  ended: { label: "開催終了", className: "bg-gray-200 text-gray-500 border-gray-300" },
  cancelled: { label: "中止", className: "bg-red-100 text-red-700 border-red-300" },
  unknown: { label: "要確認", className: "bg-gray-200 text-gray-500 border-gray-300" },
};

// 一覧カード用の簡易版（borderなし）
export const DISPLAY_STATUS_SIMPLE = {
  open: { label: "受付中", className: "bg-green-50 text-green-700" },
  upcoming: { label: "受付予定", className: "bg-blue-50 text-blue-600" },
  closed: { label: "受付終了", className: "bg-gray-100 text-gray-500" },
  ended: { label: "開催終了", className: "bg-gray-100 text-gray-500" },
  cancelled: { label: "中止", className: "bg-red-50 text-red-600" },
  unknown: { label: "要確認", className: "bg-gray-100 text-gray-500" },
};

// ─── メインAPI ───────────────────────────────────

/**
 * 表示用の受付状態を算出する
 *
 * @param {object} params
 * @param {string} [params.entry_status] - ソース由来のステータス (open/closed/upcoming/cancelled/unknown)
 * @param {string} [params.event_date] - 開催日 (YYYY-MM-DD)
 * @param {string} [params.entry_end_date] - 申込終了日 (YYYY-MM-DD or ISO datetime)
 * @param {string} [params.entry_start_date] - 申込開始日 (YYYY-MM-DD or ISO datetime)
 * @param {string} [params.application_end_at] - marathon_details由来の申込終了日
 * @param {string} [params.application_start_at] - marathon_details由来の申込開始日
 * @param {Date} [now] - 現在日時（テスト用）
 * @returns {{ status: string, label: string, className: string, source: string, reason: string }}
 */
export function getDisplayEntryStatus(params, now = new Date()) {
  const {
    entry_status: rawStatus,
    event_date: eventDateStr,
    entry_end_date: entryEndStr,
    entry_start_date: entryStartStr,
    application_end_at: appEndStr,
    application_start_at: appStartStr,
  } = params || {};

  const today = stripTime(now);
  const eventDate = parseDate(eventDateStr);
  const entryEnd = parseDate(entryEndStr || appEndStr);
  const entryStart = parseDate(entryStartStr || appStartStr);

  // 1. 中止は最優先
  if (rawStatus === "cancelled") {
    return buildResult("cancelled", "source", "ソースが中止を示している");
  }

  // 2. 開催日を過ぎている → 開催終了
  if (eventDate && eventDate < today) {
    return buildResult("ended", "calculated", "開催日を過ぎている");
  }

  // 3. 申込終了日を過ぎている → 受付終了
  if (entryEnd && entryEnd < today) {
    return buildResult("closed", "calculated", "申込終了日を過ぎている");
  }

  // 4. ソースが明示的に closed
  if (rawStatus === "closed") {
    return buildResult("closed", "source", "ソースが締切を示している");
  }

  // 5. 申込開始前
  if (entryStart && entryStart > today) {
    return buildResult("upcoming", "calculated", "申込開始日前");
  }

  // 6. ソースが open で、日付的に矛盾なし → open
  if (rawStatus === "open") {
    return buildResult("open", "source", "ソースが受付中を示しており日付矛盾なし");
  }

  // 7. ソースが upcoming
  if (rawStatus === "upcoming") {
    return buildResult("upcoming", "source", "ソースが受付予定を示している");
  }

  // 8. 日付から推定: 開催日が未来 & 申込期間内
  if (eventDate && eventDate >= today) {
    if (entryStart && entryEnd) {
      if (today >= entryStart && today <= entryEnd) {
        return buildResult("open", "calculated", "申込期間内と判定");
      }
    }
    // 開催日未来だが判定不能
    return buildResult("unknown", "fallback", "開催日は未来だが申込状況不明");
  }

  // 9. どれにも当てはまらない
  if (rawStatus && rawStatus !== "unknown") {
    const status = DISPLAY_STATUS[rawStatus] ? rawStatus : "unknown";
    return buildResult(status, "fallback", "日付情報不足のためソース値を使用");
  }

  return buildResult("unknown", "fallback", "判定に必要な情報が不足");
}

/**
 * イベントオブジェクトから表示ステータスを取得する（便利ラッパー）
 *
 * events テーブルのレコードまたは getMarathonDetailPageData の戻り値を
 * そのまま渡せる。
 *
 * @param {object} event - イベントオブジェクト
 * @returns {{ status: string, label: string, className: string, source: string, reason: string }}
 */
export function getEventDisplayStatus(event) {
  if (!event) return buildResult("unknown", "fallback", "イベントなし");
  return getDisplayEntryStatus({
    entry_status: event.entry_status,
    event_date: event.event_date,
    entry_end_date: event.entry_end_date,
    entry_start_date: event.entry_start_date,
    application_end_at: event.application_end_at,
    application_start_at: event.application_start_at,
  });
}

/**
 * ステータスラベルを取得（表示用）
 * @param {string} status
 * @returns {string}
 */
export function getStatusLabel(status) {
  return DISPLAY_STATUS[status]?.label || "要確認";
}

/**
 * ステータスのCSSクラスを取得（Hero/詳細ページ用、border付き）
 * @param {string} status
 * @returns {string}
 */
export function getStatusBadgeClass(status) {
  return DISPLAY_STATUS[status]?.className || DISPLAY_STATUS.unknown.className;
}

/**
 * ステータスのCSSクラスを取得（カード用、シンプル）
 * @param {string} status
 * @returns {string}
 */
export function getStatusBadgeClassSimple(status) {
  return DISPLAY_STATUS_SIMPLE[status]?.className || DISPLAY_STATUS_SIMPLE.unknown.className;
}

/**
 * 受付中かどうか
 * @param {object} event
 * @returns {boolean}
 */
export function isEntryOpen(event) {
  return getEventDisplayStatus(event).status === "open";
}

// ─── シグナル検出 ─────────────────────────────────

/**
 * 締切・定員に関するシグナルキーワード定義
 * 各シグナルには id / pattern / label / category を持つ
 */
const ENTRY_SIGNAL_PATTERNS = [
  { id: "first_come", pattern: /先着順/, label: "先着順", category: "capacity" },
  { id: "capacity_close", pattern: /定員に達した場合.{0,4}(受付|募集)?(終了|締切)/, label: "定員到達で締切", category: "capacity" },
  { id: "capacity_close2", pattern: /定員に達し次第.{0,4}締切/, label: "定員到達で締切", category: "capacity" },
  { id: "capacity_reached", pattern: /定員に達し(まし)?た/, label: "定員到達", category: "closed" },
  { id: "full", pattern: /満員(御礼)?/, label: "満員", category: "closed" },
  { id: "few_remaining", pattern: /残りわずか/, label: "残りわずか", category: "warning" },
  { id: "entry_ended", pattern: /エントリー(受付)?終了/, label: "エントリー終了", category: "closed" },
  { id: "entry_closed", pattern: /受付(は)?終了/, label: "受付終了", category: "closed" },
  { id: "waitlist", pattern: /キャンセル待ち/, label: "キャンセル待ち", category: "closed" },
  { id: "recommend_early", pattern: /早め.{0,4}(申込|エントリー).{0,4}(おすすめ|推奨|お勧め)/, label: "早め推奨", category: "warning" },
  { id: "popular", pattern: /人気(大会|のため|につき)/, label: "人気大会", category: "warning" },
  { id: "may_close_early", pattern: /締切前.{0,6}終了する場合/, label: "早期終了の可能性", category: "warning" },
];

/**
 * テキストから締切・定員関連シグナルを検出する
 *
 * @param {string} text - 検索対象テキスト（大会説明、ページ本文など）
 * @returns {{ signals: Array<{id: string, label: string, category: string}>, isCapacityBased: boolean }}
 */
export function detectEntrySignals(text) {
  if (!text) return { signals: [], isCapacityBased: false };

  const found = [];
  const seenLabels = new Set();

  for (const def of ENTRY_SIGNAL_PATTERNS) {
    if (def.pattern.test(text) && !seenLabels.has(def.label)) {
      seenLabels.add(def.label);
      found.push({ id: def.id, label: def.label, category: def.category });
    }
  }

  const isCapacityBased = found.some(
    (s) => s.category === "capacity" || s.id === "capacity_reached" || s.id === "full"
  );

  return { signals: found, isCapacityBased };
}

/**
 * シグナルから close_reason を推定する
 * @param {Array<{id: string, category: string}>} signals
 * @returns {string} close_reason
 */
export function inferCloseReason(signals) {
  if (!signals || signals.length === 0) return "unknown";
  if (signals.some((s) => s.id === "capacity_reached" || s.id === "full")) {
    return "capacity_reached";
  }
  if (signals.some((s) => s.id === "waitlist")) {
    return "capacity_reached";
  }
  if (signals.some((s) => s.category === "closed")) {
    return "normal_deadline";
  }
  return "unknown";
}

// ─── ヘルパー ──────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return stripTime(d);
  } catch {
    return null;
  }
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildResult(status, source, reason) {
  const info = DISPLAY_STATUS[status] || DISPLAY_STATUS.unknown;
  return {
    status,
    label: info.label,
    className: info.className,
    source,
    reason,
  };
}
