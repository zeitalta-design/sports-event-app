/**
 * マイカレンダー管理 — localStorageベース
 *
 * 既存の my-events-manager.js と連携しつつ、
 * カレンダー表示に必要な追加データ（参加記録等）を管理する。
 */

const RESULTS_KEY = "taikai_my_results";
const PREP_KEY = "taikai_my_prep";
const NOTES_KEY = "taikai_my_notes";
const REFLECTION_KEY = "taikai_my_reflections";

// ─── デフォルトチェックリスト ──────────────────────

export const DEFAULT_CHECKLIST = [
  { id: "entry", label: "エントリー確認", category: "手続き" },
  { id: "venue", label: "会場確認", category: "当日" },
  { id: "gear", label: "持ち物準備", category: "準備" },
  { id: "hotel", label: "宿泊確認", category: "移動" },
  { id: "transport", label: "交通確認", category: "移動" },
  { id: "reception", label: "受付方法確認", category: "当日" },
  { id: "goal", label: "当日の目標を決める", category: "メンタル" },
];

// ─── 参加記録 CRUD ─────────────────────────────

/**
 * 全参加記録を取得
 * @returns {Object} { [eventId]: { finishTime, netTime, overallRank, genderRank, ageRank, isPB, memo, updatedAt } }
 */
export function getAllResults() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * 特定大会の参加記録を取得
 */
export function getResult(eventId) {
  return getAllResults()[eventId] || null;
}

/**
 * 参加記録を保存/更新
 */
export function saveResult(eventId, data) {
  const all = getAllResults();
  all[eventId] = {
    ...all[eventId],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  _saveResults(all);
  _dispatch();
}

/**
 * 参加記録を削除
 */
export function removeResult(eventId) {
  const all = getAllResults();
  if (!(eventId in all)) return;
  delete all[eventId];
  _saveResults(all);
  _dispatch();
}

// ─── カレンダーヘルパー ─────────────────────────

/**
 * 指定月のカレンダーデータを構築
 * @param {number} year
 * @param {number} month (1-12)
 * @param {Array} events — イベント配列（event_date, entry_end_date を含む）
 * @param {Object} statuses — { [eventId]: { status } }
 * @param {Object} results — { [eventId]: { finishTime, isPB, ... } }
 * @returns {Object} { days: [...], labels: { 'YYYY-MM-DD': [...] } }
 */
export function buildCalendarMonth(year, month, events, statuses, results, preps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = firstDay.getDay(); // 0=Sun

  const days = [];
  const labels = {};

  // 前月パディング
  for (let i = 0; i < startPad; i++) {
    days.push(null);
  }

  // 当月の各日
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(year, month - 1, d);
    days.push({
      date: d,
      dateStr,
      isToday: dateObj.getTime() === today.getTime(),
      isPast: dateObj < today,
      isFuture: dateObj > today,
    });

    // この日に関連するイベントのラベルを構築
    const dayLabels = [];
    for (const ev of events) {
      const evDate = ev.event_date;
      const entryEnd = ev.entry_end_date;
      const evStatus = statuses[ev.id]?.status;
      const evResult = results[ev.id];

      // 大会当日
      if (evDate === dateStr) {
        if (evResult) {
          if (evResult.isPB) {
            dayLabels.push({ type: "pb", text: "自己ベスト", color: "yellow" });
          } else if (evResult.finishTime) {
            dayLabels.push({ type: "finished", text: "完走", color: "green" });
          }
        } else if (dateObj < today) {
          // 過去の大会（記録未入力）
          if (evStatus === "entered" || evStatus === "completed") {
            dayLabels.push({ type: "past", text: "参加済み", color: "gray" });
          }
        } else if (dateObj.getTime() === today.getTime()) {
          dayLabels.push({ type: "raceday", text: "本番", color: "red" });
        } else {
          // 未来の大会日
          const diff = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
          if (diff <= 7) {
            dayLabels.push({ type: "countdown", text: `あと${diff}日`, color: "blue" });
          } else {
            dayLabels.push({ type: "event", text: "大会", color: "blue" });
          }
        }
      }

      // エントリー締切日
      if (entryEnd === dateStr && dateObj >= today) {
        const diff = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
        if (diff === 0) {
          dayLabels.push({ type: "deadline", text: "締切今日！", color: "red" });
        } else if (diff <= 3) {
          dayLabels.push({ type: "deadline", text: `締切${diff}日`, color: "red" });
        } else if (diff <= 7) {
          dayLabels.push({ type: "deadline", text: `締切${diff}日`, color: "orange" });
        }
      }

      // エントリー済みラベル（大会日が未来の場合）
      if (evDate === dateStr && evStatus === "entered" && dateObj > today) {
        dayLabels.push({ type: "entered", text: "エントリー済", color: "green" });
      }

      // 準備状態ラベル（大会日が未来の場合）
      if (evDate === dateStr && dateObj > today && preps) {
        const prep = preps[ev.id];
        if (prep) {
          if (prep.percent === 100) {
            dayLabels.push({ type: "prep_done", text: "準備OK", color: "green" });
          } else if (prep.remaining > 0) {
            const diff = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
            if (diff <= 7) {
              dayLabels.push({ type: "prep_warn", text: `未準備${prep.remaining}`, color: "orange" });
            }
          }
        }
      }
    }

    if (dayLabels.length > 0) {
      labels[dateStr] = dayLabels;
    }
  }

  return { days, labels };
}

/**
 * 次の大会を取得（最も近い未来の大会）
 */
export function getNextEvent(events, statuses) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return events
    .filter((ev) => {
      if (!ev.event_date) return false;
      const d = new Date(ev.event_date);
      return d >= today;
    })
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))[0] || null;
}

/**
 * あと何日か計算
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * イベントを未来/過去に分割
 */
export function splitEvents(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const future = [];
  const past = [];

  for (const ev of events) {
    if (!ev.event_date) continue;
    const d = new Date(ev.event_date);
    d.setHours(0, 0, 0, 0);
    if (d >= today) {
      future.push(ev);
    } else {
      past.push(ev);
    }
  }

  future.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  past.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

  return { future, past };
}

// ─── 準備チェックリスト CRUD ──────────────────────

function _loadStore(key) {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function _saveStore(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

/**
 * 旧データ形式を新形式に正規化（後方互換）
 * 旧: { checked: [], custom: [] }
 * 新: { checked: [], custom: [], itemNotes: {} }
 */
function _normalizePrep(raw) {
  if (!raw || typeof raw !== "object") {
    return { checked: [], custom: [], itemNotes: {} };
  }
  return {
    checked: Array.isArray(raw.checked) ? raw.checked : [],
    custom: Array.isArray(raw.custom) ? raw.custom : [],
    itemNotes: (raw.itemNotes && typeof raw.itemNotes === "object") ? raw.itemNotes : {},
  };
}

/**
 * 大会の準備データを取得（正規化済み）
 * @returns {{ checked: string[], custom: {id,label,category}[], itemNotes: {[itemId]: string} }}
 */
export function getPrep(eventId) {
  const all = _loadStore(PREP_KEY);
  return _normalizePrep(all[eventId]);
}

/** 全大会の準備データ */
export function getAllPreps() {
  return _loadStore(PREP_KEY);
}

/** チェック項目をON/OFF */
export function togglePrepItem(eventId, itemId) {
  const all = _loadStore(PREP_KEY);
  const prep = _normalizePrep(all[eventId]);
  const idx = prep.checked.indexOf(itemId);
  if (idx >= 0) {
    prep.checked.splice(idx, 1);
  } else {
    prep.checked.push(itemId);
  }
  all[eventId] = prep;
  _saveStore(PREP_KEY, all);
  _dispatch();
}

/** カスタム項目を追加 */
export function addCustomPrepItem(eventId, label) {
  const all = _loadStore(PREP_KEY);
  const prep = _normalizePrep(all[eventId]);
  const id = `custom_${Date.now()}`;
  prep.custom.push({ id, label, category: "カスタム" });
  all[eventId] = prep;
  _saveStore(PREP_KEY, all);
  _dispatch();
  return id;
}

/** カスタム項目を削除 */
export function removeCustomPrepItem(eventId, itemId) {
  const all = _loadStore(PREP_KEY);
  const prep = _normalizePrep(all[eventId]);
  prep.custom = prep.custom.filter((c) => c.id !== itemId);
  prep.checked = prep.checked.filter((c) => c !== itemId);
  delete prep.itemNotes[itemId];
  all[eventId] = prep;
  _saveStore(PREP_KEY, all);
  _dispatch();
}

/** 項目別メモを保存 */
export function saveItemNote(eventId, itemId, text) {
  const all = _loadStore(PREP_KEY);
  const prep = _normalizePrep(all[eventId]);
  if (text && text.trim()) {
    prep.itemNotes[itemId] = text;
  } else {
    delete prep.itemNotes[itemId];
  }
  all[eventId] = prep;
  _saveStore(PREP_KEY, all);
  _dispatch();
}

/** 項目別メモを取得 */
export function getItemNote(eventId, itemId) {
  const prep = getPrep(eventId);
  return prep.itemNotes[itemId] || "";
}

/** 全項目メモを取得 */
export function getAllItemNotes(eventId) {
  const prep = getPrep(eventId);
  return prep.itemNotes;
}

/**
 * チェックリスト全体（デフォルト + カスタム）を取得
 */
export function getFullChecklist(eventId) {
  const prep = getPrep(eventId);
  return [...DEFAULT_CHECKLIST, ...prep.custom];
}

/**
 * 準備の進捗を計算（項目メモ含む）
 * @returns {{ total, done, remaining, percent, items: [{...item, checked, note}] }}
 */
export function getPrepProgress(eventId) {
  const prep = getPrep(eventId);
  const all = getFullChecklist(eventId);
  const items = all.map((item) => ({
    ...item,
    checked: prep.checked.includes(item.id),
    note: prep.itemNotes[item.id] || "",
  }));
  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  return {
    total,
    done,
    remaining: total - done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    items,
  };
}

// ─── 大会メモ CRUD ─────────────────────────────

/** メモを取得 */
export function getNote(eventId) {
  return _loadStore(NOTES_KEY)[eventId] || "";
}

/** 全メモ取得 */
export function getAllNotes() {
  return _loadStore(NOTES_KEY);
}

/** メモを保存 */
export function saveNote(eventId, text) {
  const all = _loadStore(NOTES_KEY);
  if (text.trim()) {
    all[eventId] = text;
  } else {
    delete all[eventId];
  }
  _saveStore(NOTES_KEY, all);
  _dispatch();
}

// ─── 振り返りメモ CRUD ─────────────────────────

/**
 * 振り返りを取得
 * @returns {{ reflection, nextGoal, whatWorked, whatToImprove, updatedAt }}
 */
export function getReflection(eventId) {
  return _loadStore(REFLECTION_KEY)[eventId] || null;
}

/** 全振り返り取得 */
export function getAllReflections() {
  return _loadStore(REFLECTION_KEY);
}

/** 振り返りを保存 */
export function saveReflection(eventId, data) {
  const all = _loadStore(REFLECTION_KEY);
  all[eventId] = { ...all[eventId], ...data, updatedAt: new Date().toISOString() };
  _saveStore(REFLECTION_KEY, all);
  _dispatch();
}

// ─── 内部ヘルパー ──────────────────────────────

function _saveResults(data) {
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(data));
  } catch {}
}

function _dispatch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("my-calendar-change"));
}
