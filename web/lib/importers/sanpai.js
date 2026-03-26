/**
 * 産廃処理業者・行政処分ウォッチ — 外部データ取り込み基盤
 */

import fs from "fs";
import { sanpaiConfig } from "../sanpai-config.js";

const VALID_LICENSE_TYPES = new Set(sanpaiConfig.licenseTypes.map((t) => t.slug));
const VALID_PENALTY_TYPES = new Set(sanpaiConfig.penaltyTypes.map((t) => t.value));

// ─── 許可種別正規化 ─────────────────

const LICENSE_ALIAS = {
  "収集運搬": "collection_transport",
  "収集運搬業": "collection_transport",
  "中間処理": "intermediate",
  "中間処理業": "intermediate",
  "最終処分": "final_disposal",
  "最終処分業": "final_disposal",
  "特管収集運搬": "special_collection",
  "特別管理収集運搬": "special_collection",
  "特管中間処理": "special_intermediate",
  "特別管理中間処理": "special_intermediate",
  "特管最終処分": "special_final",
  "特別管理最終処分": "special_final",
};

export function normalizeLicenseType(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_LICENSE_TYPES.has(t)) return t;
  if (LICENSE_ALIAS[t]) return LICENSE_ALIAS[t];
  for (const [key, val] of Object.entries(LICENSE_ALIAS)) {
    if (t.includes(key)) return val;
  }
  return "other";
}

// ─── 処分種別正規化 ──────────────────

export function normalizePenaltyType(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_PENALTY_TYPES.has(t)) return t;
  if (t.includes("取消")) return "license_revocation";
  if (t.includes("停止")) return "business_suspension";
  if (t.includes("改善")) return "improvement_order";
  if (t.includes("警告")) return "warning";
  if (t.includes("指導")) return "guidance";
  return "other";
}

// ─── ステータス正規化 ──────────────────

export function normalizeStatus(raw) {
  if (!raw) return "active";
  const s = String(raw).trim();
  if (["active", "営業中", "営業"].some((k) => s.includes(k))) return "active";
  if (["suspended", "停止", "一時停止"].some((k) => s.includes(k))) return "suspended";
  if (["revoked", "取消", "許可取消"].some((k) => s.includes(k))) return "revoked";
  if (["closed", "廃業", "閉鎖"].some((k) => s.includes(k))) return "closed";
  return "active";
}

// ─── slug 生成 ───────────────────────

export function toSlug(companyName, prefecture) {
  const parts = [prefecture, companyName].filter(Boolean).join("-");
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
  const companyName = raw.company_name ? String(raw.company_name).trim()
    : raw.name ? String(raw.name).trim()
    : null;

  if (!companyName) {
    errors.push("company_name が未指定");
    return { item: null, errors };
  }

  const prefecture = raw.prefecture ? String(raw.prefecture).trim() : null;
  const slug = raw.slug ? String(raw.slug).trim() : toSlug(companyName, prefecture);
  if (!slug) {
    errors.push(`${companyName}: slug を生成できません`);
    return { item: null, errors };
  }

  return {
    item: {
      slug,
      company_name: companyName,
      corporate_number: raw.corporate_number ? String(raw.corporate_number).trim() : null,
      prefecture,
      city: raw.city ? String(raw.city).trim() : null,
      license_type: normalizeLicenseType(raw.license_type),
      waste_category: raw.waste_category || "industrial",
      business_area: raw.business_area ? String(raw.business_area).trim() : null,
      status: normalizeStatus(raw.status),
      risk_level: raw.risk_level || "none",
      penalty_count: raw.penalty_count || 0,
      latest_penalty_date: normalizeDate(raw.latest_penalty_date),
      source_name: raw.source_name ? String(raw.source_name).trim() : null,
      source_url: raw.source_url ? String(raw.source_url).trim() : null,
      detail_url: raw.detail_url ? String(raw.detail_url).trim() : null,
      notes: raw.notes ? String(raw.notes).trim() : null,
      is_published: raw.is_published != null ? (raw.is_published ? 1 : 0) : 1,
      published_at: raw.published_at || null,
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
      if (verbose) console.log(`  [${i + 1}] ${item.company_name} (dry-run)`);
      continue;
    }

    try {
      const result = upsertFn(item);
      if (result.action === "insert") { report.inserted++; if (verbose) console.log(`  [${i + 1}] INSERT ${item.company_name}`); }
      else if (result.action === "update") { report.updated++; if (verbose) console.log(`  [${i + 1}] UPDATE ${item.company_name}`); }
      else { report.skipped++; }
    } catch (err) {
      report.errors.push(`${item.company_name}: ${err.message}`);
      report.skipped++;
      if (verbose) console.log(`  [${i + 1}] ERROR: ${err.message}`);
    }
  }
  return report;
}
