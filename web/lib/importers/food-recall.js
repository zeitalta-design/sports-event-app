/**
 * 食品リコール監視 — 外部データ取り込み基盤
 */

import fs from "fs";
import { foodRecallConfig } from "../food-recall-config.js";

const VALID_CATEGORIES = new Set(foodRecallConfig.categories.map((c) => c.slug));
const VALID_RISK_LEVELS = new Set(foodRecallConfig.riskLevels.map((r) => r.value));
const VALID_REASONS = new Set(foodRecallConfig.reasons.map((r) => r.value));

// ─── カテゴリ正規化 ─────────────────

const CATEGORY_ALIAS = {
  "加工食品": "processed", "加工": "processed",
  "生鮮": "fresh", "生鮮食品": "fresh", "青果": "fresh", "鮮魚": "fresh", "精肉": "fresh",
  "飲料": "beverage", "ドリンク": "beverage", "清涼飲料水": "beverage", "酒類": "beverage",
  "乳製品": "dairy", "牛乳": "dairy", "ヨーグルト": "dairy",
  "菓子": "confectionery", "お菓子": "confectionery", "スナック": "confectionery", "チョコ": "confectionery",
  "冷凍": "frozen", "冷凍食品": "frozen",
  "調味料": "seasoning", "ソース": "seasoning", "醤油": "seasoning",
  "健康食品": "supplement", "サプリ": "supplement", "サプリメント": "supplement",
  "その他": "other",
};

export function normalizeCategory(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_CATEGORIES.has(t)) return t;
  if (CATEGORY_ALIAS[t]) return CATEGORY_ALIAS[t];
  for (const [key, val] of Object.entries(CATEGORY_ALIAS)) {
    if (t.includes(key)) return val;
  }
  return "other";
}

// ─── リスクレベル正規化 ──────────

export function normalizeRiskLevel(raw) {
  if (!raw) return "unknown";
  const t = String(raw).trim().toLowerCase();
  if (VALID_RISK_LEVELS.has(t)) return t;
  if (t.includes("class1") || t.includes("クラス1") || t.includes("重篤")) return "class1";
  if (t.includes("class2") || t.includes("クラス2") || t.includes("中程度")) return "class2";
  if (t.includes("class3") || t.includes("クラス3") || t.includes("軽微")) return "class3";
  return "unknown";
}

// ─── 原因正規化 ──────────────────

export function normalizeReason(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_REASONS.has(t)) return t;
  if (t.includes("異物")) return "foreign_matter";
  if (t.includes("微生物") || t.includes("細菌") || t.includes("カビ")) return "microbe";
  if (t.includes("アレルゲン") || t.includes("アレルギー")) return "allergen";
  if (t.includes("化学") || t.includes("残留") || t.includes("農薬")) return "chemical";
  if (t.includes("表示")) return "labeling";
  if (t.includes("品質") || t.includes("変色") || t.includes("異臭")) return "quality";
  return "other";
}

// ─── status 正規化 ──────────────────

export function normalizeStatus(raw) {
  if (!raw) return "active";
  const s = String(raw).trim().toLowerCase();
  if (["active", "回収中", "継続中"].some((k) => s.includes(k))) return "active";
  if (["completed", "完了", "終了"].some((k) => s.includes(k))) return "completed";
  if (["investigating", "調査", "確認中"].some((k) => s.includes(k))) return "investigating";
  return "active";
}

// ─── slug 生成 ───────────────────────

export function toSlug(productName, manufacturer) {
  const parts = [manufacturer, productName].filter(Boolean).join("-");
  if (!parts) return null;
  return parts
    .replace(/[（）()【】\[\]]/g, " ")
    .replace(/[^\w\u3000-\u9FFF\uF900-\uFAFF-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 80);
}

// ─── 日付正規化 ──────────────────

export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const match = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return s;
}

// ─── 1件正規化 ──────────────────────

export function normalize(raw) {
  const errors = [];
  const productName = raw.product_name ? String(raw.product_name).trim()
    : raw.title ? String(raw.title).trim()
    : raw.name ? String(raw.name).trim()
    : null;

  if (!productName) {
    errors.push("product_name が未指定");
    return { item: null, errors };
  }

  const manufacturer = raw.manufacturer ? String(raw.manufacturer).trim() : null;
  const slug = raw.slug ? String(raw.slug).trim() : toSlug(productName, manufacturer);
  if (!slug) {
    errors.push(`${productName}: slug を生成できません`);
    return { item: null, errors };
  }

  return {
    item: {
      slug,
      product_name: productName,
      manufacturer,
      category: normalizeCategory(raw.category),
      recall_type: raw.recall_type || "voluntary",
      reason: normalizeReason(raw.reason),
      risk_level: normalizeRiskLevel(raw.risk_level),
      affected_area: raw.affected_area ? String(raw.affected_area).trim() : null,
      lot_number: raw.lot_number ? String(raw.lot_number).trim() : null,
      recall_date: normalizeDate(raw.recall_date || raw.date),
      status: normalizeStatus(raw.status),
      consumer_action: raw.consumer_action ? String(raw.consumer_action).trim() : null,
      source_url: raw.source_url ? String(raw.source_url).trim() : null,
      manufacturer_url: raw.manufacturer_url ? String(raw.manufacturer_url).trim() : null,
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
      if (verbose) console.log(`  [${i + 1}] SKIP: ${errors.join(", ")}`);
      continue;
    }
    if (!item) { report.skipped++; continue; }
    report.valid++;

    if (dryRun) {
      if (verbose) console.log(`  [${i + 1}] ${item.product_name} (dry-run)`);
      continue;
    }

    try {
      const result = upsertFn(item);
      if (result.action === "insert") { report.inserted++; if (verbose) console.log(`  [${i + 1}] INSERT ${item.product_name}`); }
      else if (result.action === "update") { report.updated++; if (verbose) console.log(`  [${i + 1}] UPDATE ${item.product_name}`); }
      else { report.skipped++; }
    } catch (err) {
      report.errors.push(`${item.product_name}: ${err.message}`);
      report.skipped++;
      if (verbose) console.log(`  [${i + 1}] ERROR: ${err.message}`);
    }
  }
  return report;
}
