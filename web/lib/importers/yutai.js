/**
 * 株主優待ナビ — 外部データ取り込み基盤
 *
 * 責務:
 *   1. loader   — JSON ファイルを読んで生配列を返す
 *   2. normalize — 1件の生データを yutai_items 形式に正規化する
 *   3. runImport — 全件を処理し、upsert + レポートを行う
 *
 * 使い方:
 *   import { loadJson, normalize, runImport } from "@/lib/importers/yutai";
 */

import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { yutaiConfig } = await import(pathToFileURL(resolve(__dirname, "../yutai-config.js")).href);

// ─── カテゴリ正規化マップ ──────────────

const VALID_CATEGORIES = new Set(yutaiConfig.categories.map((c) => c.slug));

// よくある表記ゆれの吸収
const CATEGORY_ALIAS = {
  "食品": "food",
  "食品・飲料": "food",
  "食事券": "food",
  "飲食": "food",
  "買い物": "shopping",
  "買い物券": "shopping",
  "割引券": "shopping",
  "買い物券・割引": "shopping",
  "旅行": "leisure",
  "レジャー": "leisure",
  "レジャー・旅行": "leisure",
  "航空": "leisure",
  "日用品": "daily",
  "生活": "daily",
  "日用品・生活": "daily",
  "金券": "money",
  "QUOカード": "money",
  "クオカード": "money",
  "金券・QUOカード": "money",
  "その他": "other",
};

function normalizeCategory(raw) {
  if (!raw) return "other";
  const trimmed = String(raw).trim();
  if (VALID_CATEGORIES.has(trimmed)) return trimmed;
  const alias = CATEGORY_ALIAS[trimmed];
  if (alias) return alias;
  // 部分一致
  for (const [key, val] of Object.entries(CATEGORY_ALIAS)) {
    if (trimmed.includes(key)) return val;
  }
  return "other";
}

// ─── slug 生成 ──────────────────────

function toSlug(code, title) {
  if (!code) return null;
  // title から安全な ASCII slug を生成
  const titleSlug = (title || "")
    .replace(/[^\w\u3000-\u9FFF\uF900-\uFAFF]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 40);
  return `${String(code).trim()}-${titleSlug || "item"}`;
}

// ─── confirm_months 正規化 ───────────

function normalizeConfirmMonths(raw) {
  if (!raw) return "[]";
  // 既に配列
  if (Array.isArray(raw)) {
    const nums = raw.map(Number).filter((n) => n >= 1 && n <= 12);
    return JSON.stringify(nums);
  }
  // 文字列: "3,9" or "3月・9月" or "[3,9]"
  const str = String(raw);
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed.map(Number).filter((n) => n >= 1 && n <= 12));
    }
  } catch {}
  // カンマ / ・ / スペース区切り
  const nums = str
    .replace(/月/g, "")
    .split(/[,・\s/]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n >= 1 && n <= 12);
  return JSON.stringify(nums);
}

// ─── 1件正規化 ─────────────────────

/**
 * 外部データ1件を yutai_items 形式に正規化する
 *
 * @param {object} raw - 外部データ1件
 * @returns {{ item: object|null, errors: string[] }}
 */
export function normalize(raw) {
  const errors = [];

  // code は必須
  const code = raw.code != null ? String(raw.code).trim() : null;
  if (!code) {
    errors.push("code が未指定");
    return { item: null, errors };
  }

  const title = raw.title ? String(raw.title).trim() : raw.name ? String(raw.name).trim() : null;
  if (!title) {
    errors.push(`code=${code}: title が未指定`);
    return { item: null, errors };
  }

  const slug = raw.slug ? String(raw.slug).trim() : toSlug(code, title);
  const category = normalizeCategory(raw.category);
  const confirmMonths = normalizeConfirmMonths(raw.confirm_months || raw.confirmMonths || raw.record_month);
  const minInvestment = raw.min_investment != null ? Math.round(Number(raw.min_investment)) || null : null;
  const benefitSummary = raw.benefit_summary ? String(raw.benefit_summary).trim() : null;
  const dividendYield = raw.dividend_yield != null ? parseFloat(raw.dividend_yield) || null : null;
  const benefitYield = raw.benefit_yield != null ? parseFloat(raw.benefit_yield) || null : null;
  const isPublished = raw.is_published != null ? (raw.is_published ? 1 : 0) : 1;

  return {
    item: {
      code,
      slug,
      title,
      category,
      confirm_months: confirmMonths,
      min_investment: minInvestment,
      benefit_summary: benefitSummary,
      dividend_yield: dividendYield,
      benefit_yield: benefitYield,
      is_published: isPublished,
    },
    errors,
  };
}

// ─── JSON ファイル読み込み ───────────

/**
 * JSON ファイルを読んで配列を返す
 * @param {string} filePath
 * @returns {object[]}
 */
export function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  // { items: [...] } 形式も許容
  if (data.items && Array.isArray(data.items)) return data.items;
  throw new Error("入力 JSON は配列または { items: [...] } 形式である必要があります");
}

/**
 * リモート URL から JSON を取得して配列を返す
 * @param {string} url
 * @returns {Promise<object[]>}
 */
export async function loadRemoteJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`リモート取得失敗: ${res.status} ${res.statusText} (${url})`);
  }
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON パース失敗: ${e.message} (${url})`);
  }
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.results && Array.isArray(data.results)) return data.results;
  throw new Error("リモート JSON は配列または { items/data/results: [...] } 形式である必要があります");
}

// ─── インポート実行 ─────────────────

/**
 * 全件処理して upsert + レポート
 *
 * @param {object[]} rawItems - 生データ配列
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]
 * @param {function} [opts.upsertFn] - upsert 関数（DI 用。省略時は repository の upsertYutaiItem）
 * @param {boolean} [opts.verbose=false]
 * @returns {{ total, valid, inserted, updated, skipped, errors: string[] }}
 */
export function runImport(rawItems, { dryRun = false, upsertFn, verbose = false } = {}) {
  const report = {
    total: rawItems.length,
    valid: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const { item, errors } = normalize(raw);

    if (errors.length > 0) {
      report.errors.push(...errors);
      report.skipped++;
      if (verbose) console.log(`  ⚠️  [${i + 1}] ${errors.join(", ")}`);
      continue;
    }

    if (!item) {
      report.skipped++;
      continue;
    }

    report.valid++;

    if (dryRun) {
      if (verbose) console.log(`  🔍 [${i + 1}] ${item.code} ${item.title} (dry-run)`);
      // dry-run では DB を触らないので insert/update の判定はスキップ
      continue;
    }

    try {
      const result = upsertFn(item);
      if (result.action === "insert") {
        report.inserted++;
        if (verbose) console.log(`  ✅ [${i + 1}] INSERT ${item.code} ${item.title}`);
      } else if (result.action === "update") {
        report.updated++;
        if (verbose) console.log(`  🔄 [${i + 1}] UPDATE ${item.code} ${item.title}`);
      } else {
        report.skipped++;
      }
    } catch (err) {
      report.errors.push(`code=${item.code}: ${err.message}`);
      report.skipped++;
      if (verbose) console.log(`  ❌ [${i + 1}] ERROR ${item.code}: ${err.message}`);
    }
  }

  return report;
}
