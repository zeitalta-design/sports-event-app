/**
 * 入札ナビ — 外部データ取り込み基盤
 */

import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { nyusatsuConfig } = await import(pathToFileURL(resolve(__dirname, "../nyusatsu-config.js")).href);

// ─── カテゴリ正規化 ─────────────────

const VALID_CATEGORIES = new Set(nyusatsuConfig.categories.map((c) => c.slug));

const CATEGORY_ALIAS = {
  "IT": "it", "IT・システム": "it", "システム": "it", "情報": "it",
  "建設": "construction", "土木": "construction", "建設・土木": "construction", "工事": "construction",
  "コンサル": "consulting", "調査": "consulting", "コンサル・調査": "consulting", "コンサルティング": "consulting",
  "物品": "goods", "調達": "goods", "物品調達": "goods", "購入": "goods",
  "業務委託": "service", "委託": "service", "サービス": "service",
  "その他": "other",
};

function normalizeCategory(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_CATEGORIES.has(t)) return t;
  if (CATEGORY_ALIAS[t]) return CATEGORY_ALIAS[t];
  for (const [key, val] of Object.entries(CATEGORY_ALIAS)) {
    if (t.includes(key)) return val;
  }
  return "other";
}

// ─── bidding_method 正規化 ──────────

const METHOD_ALIAS = {
  "一般競争入札": "open", "一般競争": "open", "一般": "open",
  "指名競争入札": "designated", "指名競争": "designated", "指名": "designated",
  "企画競争": "proposal", "プロポーザル": "proposal", "企画": "proposal",
  "随意契約": "negotiated", "随契": "negotiated", "随意": "negotiated",
};
const VALID_METHODS = new Set(["open", "designated", "proposal", "negotiated", "other"]);

function normalizeBiddingMethod(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (VALID_METHODS.has(t)) return t;
  if (METHOD_ALIAS[t]) return METHOD_ALIAS[t];
  for (const [key, val] of Object.entries(METHOD_ALIAS)) {
    if (t.includes(key)) return val;
  }
  return "other";
}

// ─── status 正規化 ──────────────────

function normalizeStatus(raw) {
  if (!raw) return "open";
  const s = String(raw).trim().toLowerCase();
  if (["open", "募集中", "公告中", "公示中", "受付中"].some((k) => s.includes(k))) return "open";
  if (["upcoming", "予定", "準備中"].some((k) => s.includes(k))) return "upcoming";
  if (["closed", "終了", "締切", "落札済"].some((k) => s.includes(k))) return "closed";
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
  const match = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return s;
}

// ─── 1件正規化 ──────────────────────

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
      issuer_name: raw.issuer_name ? String(raw.issuer_name).trim() : null,
      target_area: raw.target_area ? String(raw.target_area).trim() : null,
      deadline: normalizeDeadline(raw.deadline),
      budget_amount: raw.budget_amount != null ? Math.round(Number(raw.budget_amount)) || null : null,
      bidding_method: normalizeBiddingMethod(raw.bidding_method),
      summary: raw.summary ? String(raw.summary).trim() : null,
      status: normalizeStatus(raw.status),
      is_published: raw.is_published != null ? (raw.is_published ? 1 : 0) : 1,
      qualification: raw.qualification ? String(raw.qualification).trim() : null,
      announcement_url: raw.announcement_url ? String(raw.announcement_url).trim() : null,
      contact_info: raw.contact_info ? String(raw.contact_info).trim() : null,
      delivery_location: raw.delivery_location ? String(raw.delivery_location).trim() : null,
      has_attachment: raw.has_attachment ? 1 : 0,
      announcement_date: normalizeDeadline(raw.announcement_date),
      contract_period: raw.contract_period ? String(raw.contract_period).trim() : null,
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
