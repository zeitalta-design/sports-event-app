/**
 * 補助金ナビ — 外部データ取り込み基盤
 *
 * 責務:
 *   1. loadJson  — JSON ファイルを読んで配列を返す
 *   2. normalize — 1件の生データを hojokin_items 形式に正規化する
 *   3. runImport — 全件を処理し、upsert + レポートを行う
 */

import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { hojokinConfig } = await import(pathToFileURL(resolve(__dirname, "../hojokin-config.js")).href);

// ─── カテゴリ正規化 ─────────────────

const VALID_CATEGORIES = new Set(hojokinConfig.categories.map((c) => c.slug));

const CATEGORY_ALIAS = {
  "IT": "it",
  "IT導入": "it",
  "デジタル化": "it",
  "IT・システム": "it",
  "IT導入・デジタル化": "it",
  "創業": "startup",
  "起業": "startup",
  "創業・起業": "startup",
  "設備": "equipment",
  "設備投資": "equipment",
  "研究": "rd",
  "研究開発": "rd",
  "R&D": "rd",
  "雇用": "employment",
  "人材": "employment",
  "雇用・人材": "employment",
  "海外": "export",
  "海外展開": "export",
  "輸出": "export",
  "その他": "other",
};

function normalizeCategory(raw) {
  if (!raw) return "other";
  const trimmed = String(raw).trim();
  if (VALID_CATEGORIES.has(trimmed)) return trimmed;
  if (CATEGORY_ALIAS[trimmed]) return CATEGORY_ALIAS[trimmed];
  for (const [key, val] of Object.entries(CATEGORY_ALIAS)) {
    if (trimmed.includes(key)) return val;
  }
  return "other";
}

// ─── target_type 正規化 ─────────────

const TARGET_ALIAS = {
  "中小企業": "corp",
  "法人": "corp",
  "企業": "corp",
  "中小企業者": "corp",
  "個人事業主": "sole",
  "個人事業": "sole",
  "フリーランス": "sole",
  "スタートアップ": "startup",
  "ベンチャー": "startup",
  "創業者": "startup",
  "NPO": "npo",
  "非営利": "npo",
  "団体": "npo",
  "自治体": "local",
  "地方公共団体": "local",
};

const VALID_TARGETS = new Set(["corp", "sole", "startup", "npo", "local", "other"]);

function normalizeTarget(raw) {
  if (!raw) return "corp";
  const trimmed = String(raw).trim();
  if (VALID_TARGETS.has(trimmed)) return trimmed;
  if (TARGET_ALIAS[trimmed]) return TARGET_ALIAS[trimmed];
  for (const [key, val] of Object.entries(TARGET_ALIAS)) {
    if (trimmed.includes(key)) return val;
  }
  return "other";
}

// ─── status 正規化 ──────────────────

function normalizeStatus(raw) {
  if (!raw) return "open";
  const s = String(raw).trim().toLowerCase();
  if (["open", "募集中", "公募中", "受付中"].some((k) => s.includes(k))) return "open";
  if (["upcoming", "予定", "準備中"].some((k) => s.includes(k))) return "upcoming";
  if (["closed", "終了", "締切", "募集終了"].some((k) => s.includes(k))) return "closed";
  return "open";
}

// ─── slug 生成 ───────────────────────

function toSlug(title) {
  if (!title) return null;
  return title
    .replace(/[（）()【】\[\]]/g, " ")
    .replace(/[^\w\u3000-\u9FFF\uF900-\uFAFF-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 60);
}

// ─── deadline 整形 ──────────────────

function normalizeDeadline(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const match = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return s;
}

// ─── 1件正規化 ──────────────────────

/**
 * @param {object} raw
 * @returns {{ item: object|null, errors: string[] }}
 */
export function normalize(raw) {
  const errors = [];

  const title = raw.title ? String(raw.title).trim() : raw.name ? String(raw.name).trim() : null;
  if (!title) {
    errors.push("title が未指定");
    return { item: null, errors };
  }

  const slug = raw.slug ? String(raw.slug).trim() : toSlug(title);
  if (!slug) {
    errors.push(`${title}: slug を生成できません`);
    return { item: null, errors };
  }

  return {
    item: {
      slug,
      title,
      category: normalizeCategory(raw.category),
      target_type: normalizeTarget(raw.target_type || raw.target),
      max_amount: raw.max_amount != null ? Math.round(Number(raw.max_amount)) || null : null,
      subsidy_rate: raw.subsidy_rate ? String(raw.subsidy_rate).trim() : null,
      deadline: normalizeDeadline(raw.deadline),
      status: normalizeStatus(raw.status),
      provider_name: raw.provider_name ? String(raw.provider_name).trim() : null,
      summary: raw.summary ? String(raw.summary).trim() : null,
      is_published: raw.is_published != null ? (raw.is_published ? 1 : 0) : 1,
    },
    errors,
  };
}

// ─── JSON 読み込み ──────────────────

export function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  throw new Error("入力 JSON は配列または { items: [...] } 形式である必要があります");
}

/**
 * リモート URL から JSON を取得して配列を返す
 */
export async function loadRemoteJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`リモート取得失敗: ${res.status} ${res.statusText} (${url})`);
  let data;
  try { data = JSON.parse(await res.text()); }
  catch (e) { throw new Error(`JSON パース失敗: ${e.message} (${url})`); }
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.results && Array.isArray(data.results)) return data.results;
  throw new Error("リモート JSON は配列または { items/data/results: [...] } 形式である必要があります");
}

// ─── インポート実行 ─────────────────

/**
 * @param {object[]} rawItems
 * @param {{ dryRun?: boolean, upsertFn?: function, verbose?: boolean }} opts
 * @returns {{ total, valid, inserted, updated, skipped, errors: string[] }}
 */
export function runImport(rawItems, { dryRun = false, upsertFn, verbose = false } = {}) {
  const report = { total: rawItems.length, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rawItems.length; i++) {
    const { item, errors } = normalize(rawItems[i]);
    if (errors.length > 0) {
      report.errors.push(...errors);
      report.skipped++;
      if (verbose) console.log(`  ⚠️  [${i + 1}] ${errors.join(", ")}`);
      continue;
    }
    if (!item) { report.skipped++; continue; }
    report.valid++;

    if (dryRun) {
      if (verbose) console.log(`  🔍 [${i + 1}] ${item.title} (dry-run)`);
      continue;
    }

    try {
      const result = upsertFn(item);
      if (result.action === "insert") { report.inserted++; if (verbose) console.log(`  ✅ [${i + 1}] INSERT ${item.title}`); }
      else if (result.action === "update") { report.updated++; if (verbose) console.log(`  🔄 [${i + 1}] UPDATE ${item.title}`); }
      else { report.skipped++; }
    } catch (err) {
      report.errors.push(`${item.title}: ${err.message}`);
      report.skipped++;
      if (verbose) console.log(`  ❌ [${i + 1}] ERROR: ${err.message}`);
    }
  }
  return report;
}
