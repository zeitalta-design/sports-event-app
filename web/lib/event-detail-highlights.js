/**
 * Phase57: 大会詳細ページ 要点・ハイライト・比較UI 生成ロジック
 *
 * ルールベースで getMarathonDetailPageData() の戻り値から
 * 3種類のUI用データを生成する。LLMコスト不要。
 *
 * 公開関数:
 *   - buildEventQuickFacts(data)     → 要点サマリー
 *   - buildEventHighlights(data)     → 特徴バッジ
 *   - buildEventComparisonSummary(data) → 比較メモ
 *
 * @module event-detail-highlights
 */

// ════════════════════════════════════════════════════
//  ヘルパー関数群
// ════════════════════════════════════════════════════

/**
 * JSON文字列/配列をパースして配列を返す（defensive）
 */
function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * distances 配列を人が読みやすい文字列に変換
 * 例: "フル / ハーフ / 10km / 5km"
 */
export function formatDistanceList(data) {
  const races = data.races || [];
  const kms = races
    .map((r) => r.distance_km)
    .filter((d) => d && d > 0)
    .sort((a, b) => b - a);
  if (kms.length === 0) {
    // race_name から組み立て
    const names = races.map((r) => r.race_name).filter(Boolean).slice(0, 4);
    return names.length > 0 ? names.join(" / ") : null;
  }
  const labels = kms.map((d) => {
    if (d >= 42 && d <= 43) return "フル";
    if (d >= 20 && d <= 22) return "ハーフ";
    if (d > 43) return `${d}km`;
    return `${d}km`;
  });
  return [...new Set(labels)].join(" / ");
}

/**
 * エントリー状況を人が読みやすい文字列に変換
 */
export function formatEntryStatus(data) {
  const label = data.entry_status_label;
  const status = data.entry_status;
  if (status === "open") return label || "受付中";
  if (status === "closed") return label || "受付終了";
  if (status === "upcoming") return label || "受付開始前";
  if (status === "cancelled") return "中止";
  return label || null;
}

/**
 * 開催日まであと何日か
 */
export function getDaysUntilEvent(eventDate) {
  if (!eventDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(eventDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * エントリー締切日まであと何日か
 */
export function getDaysUntilDeadline(data) {
  const end = data.entry_end_date;
  if (!end) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(end);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * services_json から主要サービスのうち利用可能なものを数える
 */
export function countMajorServices(data) {
  const services = safeArray(data.services);
  const majorNames = [
    "参加賞", "完走メダル", "記録証", "荷物預かり", "更衣室",
    "シャワー", "給水所", "救護所", "保険",
  ];
  return services.filter(
    (s) =>
      majorNames.some((n) => (s.name || "").includes(n)) &&
      isServiceAvailable(s)
  ).length;
}

function isServiceAvailable(s) {
  return (
    s.available === true ||
    s.available === "true" ||
    s.available === "◯" ||
    s.available === "○" ||
    s.available === "あり"
  );
}

/**
 * 情報充実度スコア（0〜10）
 */
export function getInformationCompletenessScore(data) {
  let score = 0;
  if (data.summary) score++;
  if (data.venue_name) score++;
  if (data.venue_address) score++;
  if (data.access_info || data.transit_text) score++;
  if ((data.schedule || []).length > 0) score++;
  if (data.reception_place || data.reception_time_text) score++;
  if (data.parking_info) score++;
  if (data.notes) score++;
  if (data.course_info || data.race_method_text) score++;
  if ((data.faq || []).length > 0) score++;
  return score;
}

/**
 * 日付を「YYYY年M月D日」形式にフォーマット
 */
function formatJapaneseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${dow})`;
}

/**
 * 日付を「M月D日」形式にフォーマット
 */
function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// ════════════════════════════════════════════════════
//  A. buildEventQuickFacts — 要点サマリー
// ════════════════════════════════════════════════════

/**
 * 大会データから「この大会の要点」を組み立てる
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @returns {{ items: Array<{label: string, value: string}> }}
 */
export function buildEventQuickFacts(data) {
  const items = [];

  // 1. 開催日
  const dateStr = formatJapaneseDate(data.event_date);
  if (dateStr) {
    items.push({ label: "開催日", value: dateStr });
  }

  // 2. 会場
  if (data.venue_name) {
    items.push({ label: "会場", value: data.venue_name });
  }

  // 3. 開催地
  const location = [data.prefecture, data.city].filter(Boolean).join(" ");
  if (location) {
    items.push({ label: "開催地", value: location });
  }

  // 4. 種目
  const distStr = formatDistanceList(data);
  if (distStr) {
    items.push({ label: "種目", value: distStr });
  }

  // 5. エントリー状況
  const entryStr = formatEntryStatus(data);
  if (entryStr) {
    items.push({ label: "エントリー", value: entryStr });
  }

  // 6. 申込期限
  if (data.entry_end_date) {
    const endStr = formatShortDate(data.entry_end_date);
    if (endStr) {
      const daysLeft = getDaysUntilDeadline(data);
      const suffix =
        daysLeft !== null && daysLeft > 0 && daysLeft <= 30
          ? `（あと${daysLeft}日）`
          : "";
      items.push({ label: "申込期限", value: `${endStr}まで${suffix}` });
    }
  }

  // 7. 参加費
  const feeStr = buildFeeString(data);
  if (feeStr) {
    items.push({ label: "参加費", value: feeStr });
  }

  // 8. 主催
  if (data.organizer?.name) {
    items.push({ label: "主催", value: data.organizer.name });
  }

  return { items: items.slice(0, 8) };
}

function buildFeeString(data) {
  const races = data.races || [];
  const pricing = data.pricing || [];

  const fees = [];
  for (const r of races) {
    if (r.fee_min > 0) fees.push(r.fee_min);
    if (r.fee_max > 0) fees.push(r.fee_max);
  }
  for (const p of pricing) {
    const match = (p.fee || "").match(/[\d,]+/);
    if (match) {
      const val = parseInt(match[0].replace(/,/g, ""));
      if (val > 0) fees.push(val);
    }
  }
  if (fees.length === 0) return null;

  const min = Math.min(...fees);
  const max = Math.max(...fees);
  return min === max
    ? `${min.toLocaleString()}円`
    : `${min.toLocaleString()}〜${max.toLocaleString()}円`;
}

// ════════════════════════════════════════════════════
//  B. buildEventHighlights — 特徴バッジ
// ════════════════════════════════════════════════════

/**
 * 大会データから特徴バッジを生成
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @returns {{ badges: Array<{key: string, label: string}> }}
 */
export function buildEventHighlights(data) {
  const badges = [];
  const races = data.races || [];
  const features = safeArray(data.features);
  const services = safeArray(data.services);
  const levels = safeArray(data.level_labels);

  // --- 距離系 ---
  const distances = races.map((r) => r.distance_km).filter((d) => d > 0);

  if (distances.some((d) => d >= 42 && d <= 43)) {
    badges.push({ key: "full", label: "フルあり" });
  }
  if (distances.some((d) => d >= 20 && d <= 22)) {
    badges.push({ key: "half", label: "ハーフあり" });
  }
  if (distances.some((d) => d > 43)) {
    badges.push({ key: "ultra", label: "ウルトラあり" });
  }

  // ファミリー / キッズ
  const isFamilyEvent =
    features.some((f) => /ファミリー|親子|キッズ|こども|子供|家族/.test(f)) ||
    races.some((r) => /ファミリー|親子|キッズ|こども|子供/.test(r.race_name || ""));

  if (isFamilyEvent) {
    badges.push({ key: "family", label: "ファミリー向け" });
  }

  // --- サービス系 ---
  const hasAvailableService = (keyword) =>
    services.some(
      (s) => (s.name || "").includes(keyword) && isServiceAvailable(s)
    );

  if (hasAvailableService("参加賞") || hasAvailableService("完走メダル")) {
    badges.push({ key: "souvenir", label: "参加賞あり" });
  }
  if (hasAvailableService("記録証")) {
    badges.push({ key: "record", label: "記録証あり" });
  }
  if (
    hasAvailableService("計測") ||
    (data.measurement_method && /チップ|計測/.test(data.measurement_method))
  ) {
    badges.push({ key: "chip", label: "計測あり" });
  }
  if (hasAvailableService("更衣室")) {
    badges.push({ key: "changing_room", label: "更衣室あり" });
  }
  if (hasAvailableService("荷物預かり")) {
    badges.push({ key: "baggage", label: "荷物預かりあり" });
  }
  if (hasAvailableService("シャワー")) {
    badges.push({ key: "shower", label: "シャワーあり" });
  }

  // 駐車場
  if (data.parking_info && !/なし|不可|ありません/.test(data.parking_info)) {
    badges.push({ key: "parking", label: "駐車場あり" });
  }

  // --- 特徴系 ---
  if (features.some((f) => /公認|陸連/.test(f))) {
    badges.push({ key: "certified", label: "陸連公認" });
  }
  if (features.some((f) => /ペーサー|ペースメーカー/.test(f))) {
    badges.push({ key: "pacer", label: "ペーサーあり" });
  }

  // 初心者向け
  if (
    levels.some((l) => /初心者/.test(l)) ||
    features.some((f) => /初心者|ビギナー/.test(f)) ||
    hasLongTimeLimit(data)
  ) {
    badges.push({ key: "beginner", label: "初心者向け" });
  }

  // アクセス良好（駅近判定）
  if (data.access_info && /駅.{0,5}(徒歩|分)/.test(data.access_info)) {
    badges.push({ key: "access", label: "アクセス良好" });
  }

  // --- 時期系 ---
  const daysUntilEvent = getDaysUntilEvent(data.event_date);
  if (daysUntilEvent !== null && daysUntilEvent > 0 && daysUntilEvent <= 14) {
    badges.push({ key: "soon", label: "近日開催" });
  }

  const daysUntilDeadline = getDaysUntilDeadline(data);
  if (
    daysUntilDeadline !== null &&
    daysUntilDeadline > 0 &&
    daysUntilDeadline <= 14 &&
    data.entry_status === "open"
  ) {
    badges.push({ key: "near_deadline", label: "締切近め" });
  }

  // トレイル
  if (data.sport_type === "trail" || data.sports_category === "トレイルラン") {
    badges.push({ key: "trail", label: "トレイルラン" });
  }

  // 強い特徴を優先するソート
  const PRIORITY_ORDER = [
    "full", "half", "ultra", "certified", "pacer", "beginner", "family",
    "souvenir", "record", "chip", "near_deadline", "soon",
    "access", "changing_room", "baggage", "shower", "parking", "trail",
  ];
  badges.sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.key);
    const bi = PRIORITY_ORDER.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return { badges: badges.slice(0, 8) };
}

function hasLongTimeLimit(data) {
  const races = data.races || [];
  const timeLimits = safeArray(data.time_limits);

  for (const race of races) {
    if (!race.time_limit) continue;
    const hours = parseTimeLimitHours(race.time_limit);
    if (!hours) continue;
    const km = race.distance_km || 0;
    if (km >= 42 && hours >= 6) return true;
    if (km >= 20 && km < 42 && hours >= 3) return true;
  }
  for (const tl of timeLimits) {
    if (!tl.limit) continue;
    const hours = parseTimeLimitHours(tl.limit);
    if (!hours) continue;
    if (/フル|42/.test(tl.name || "") && hours >= 6) return true;
    if (/ハーフ|21/.test(tl.name || "") && hours >= 3) return true;
    if (hours >= 7) return true;
  }
  return false;
}

function parseTimeLimitHours(str) {
  if (!str) return null;
  const hMatch = str.match(/(\d+)\s*時間/);
  if (hMatch) return parseFloat(hMatch[1]);
  const colonMatch = str.match(/^(\d+):(\d+)/);
  if (colonMatch) return parseInt(colonMatch[1]) + parseInt(colonMatch[2]) / 60;
  return null;
}

// ════════════════════════════════════════════════════
//  C. buildEventComparisonSummary — 比較メモ
// ════════════════════════════════════════════════════

/**
 * 大会データから比較用サマリーを生成
 *
 * 初期版は他大会とのDB横断比較ではなく、
 * ルールベースの相対評価で「見え方」を提供する。
 *
 * @param {object} data - getMarathonDetailPageData() の戻り値
 * @returns {{ items: Array<{label: string, value: string, tone: "good"|"neutral"|"low", note: string}> }}
 */
export function buildEventComparisonSummary(data) {
  const items = [];

  // 1. 距離バリエーション
  const distItem = evaluateDistanceVariety(data);
  if (distItem) items.push(distItem);

  // 2. サービス充実度
  const serviceItem = evaluateServiceRichness(data);
  if (serviceItem) items.push(serviceItem);

  // 3. 情報充実度
  const infoItem = evaluateInformationCompleteness(data);
  if (infoItem) items.push(infoItem);

  // 4. 開催時期
  const timingItem = evaluateEventTiming(data);
  if (timingItem) items.push(timingItem);

  return { items };
}

function evaluateDistanceVariety(data) {
  const races = data.races || [];
  const distances = races.map((r) => r.distance_km).filter((d) => d > 0);
  const uniqueDistances = new Set(
    distances.map((d) => {
      if (d >= 42 && d <= 43) return 42;
      if (d >= 20 && d <= 22) return 21;
      return Math.round(d);
    })
  );

  const count = uniqueDistances.size;
  // 種目がない場合は race_name で代替カウント
  const raceCount = count > 0 ? count : races.length;
  if (raceCount === 0) return null;

  if (raceCount >= 4) {
    return {
      label: "距離バリエーション",
      value: "多い",
      tone: "good",
      note: "複数距離から選びやすい大会です",
    };
  }
  if (raceCount >= 2) {
    return {
      label: "距離バリエーション",
      value: "標準",
      tone: "neutral",
      note: `${raceCount}種目から選べます`,
    };
  }
  return {
    label: "距離バリエーション",
    value: "少ない",
    tone: "low",
    note: "種目が絞られています",
  };
}

function evaluateServiceRichness(data) {
  const services = safeArray(data.services);
  if (services.length === 0) return null;

  const majorCount = countMajorServices(data);

  if (majorCount >= 5) {
    return {
      label: "サービス充実度",
      value: "高い",
      tone: "good",
      note: "参加賞・記録証・計測などに対応",
    };
  }
  if (majorCount >= 3) {
    return {
      label: "サービス充実度",
      value: "標準",
      tone: "neutral",
      note: "基本的なサービスがそろっています",
    };
  }
  return {
    label: "サービス充実度",
    value: "限定的",
    tone: "low",
    note: "サービスは最低限の構成です",
  };
}

function evaluateInformationCompleteness(data) {
  const score = getInformationCompletenessScore(data);

  if (score >= 7) {
    return {
      label: "情報充実度",
      value: "高い",
      tone: "good",
      note: "大会情報がそろっていて把握しやすいです",
    };
  }
  if (score >= 4) {
    return {
      label: "情報充実度",
      value: "標準",
      tone: "neutral",
      note: "主要な情報がそろっています",
    };
  }
  if (score >= 1) {
    return {
      label: "情報充実度",
      value: "少なめ",
      tone: "low",
      note: "掲載元で最新情報をご確認ください",
    };
  }
  return null;
}

function evaluateEventTiming(data) {
  const days = getDaysUntilEvent(data.event_date);
  if (days === null) return null;
  if (days < 0) {
    return {
      label: "開催時期",
      value: "終了",
      tone: "low",
      note: "この大会はすでに終了しています",
    };
  }
  if (days <= 14) {
    return {
      label: "開催時期",
      value: "近日",
      tone: "neutral",
      note: "開催が近いため、早めの確認がおすすめです",
    };
  }
  if (days <= 30) {
    return {
      label: "開催時期",
      value: "今月",
      tone: "neutral",
      note: "今月中に開催予定の大会です",
    };
  }
  return {
    label: "開催時期",
    value: "先",
    tone: "neutral",
    note: "開催はまだ先です。余裕をもって準備できます",
  };
}
