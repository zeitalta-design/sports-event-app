/**
 * 許認可・登録事業者横断検索 — 外部データ取り込み基盤 + 名寄せロジック
 */

import fs from "fs";
import { kyoninkaConfig, normalizeEntityName } from "../kyoninka-config.js";

const VALID_LICENSE_FAMILIES = new Set(kyoninkaConfig.licenseFamilies.map((f) => f.slug));

// ─── 許認可カテゴリ正規化 ─────────────────

const FAMILY_ALIAS = {
  "建設業": "construction", "建設": "construction", "建設業許可": "construction",
  "宅建": "real_estate", "宅建業": "real_estate", "宅地建物取引業": "real_estate", "不動産": "real_estate",
  "産廃": "waste_disposal", "産業廃棄物": "waste_disposal", "廃棄物処理": "waste_disposal",
  "食品衛生": "food_sanitation", "飲食店": "food_sanitation", "食品": "food_sanitation",
  "運送": "transport", "貨物": "transport", "運送業": "transport",
  "警備": "security", "警備業": "security",
};

export function normalizeLicenseFamily(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_LICENSE_FAMILIES.has(t)) return t;
  if (FAMILY_ALIAS[t]) return FAMILY_ALIAS[t];
  for (const [key, val] of Object.entries(FAMILY_ALIAS)) {
    if (t.includes(key)) return val;
  }
  return "other";
}

// ─── ステータス正規化 ──────────────────

export function normalizeEntityStatus(raw) {
  if (!raw) return "active";
  const s = String(raw).trim();
  if (["active", "営業中", "営業"].some((k) => s.includes(k))) return "active";
  if (["closed", "廃業", "閉鎖"].some((k) => s.includes(k))) return "closed";
  if (["suspended", "停止", "一時停止"].some((k) => s.includes(k))) return "suspended";
  return "unknown";
}

export function normalizeRegistrationStatus(raw) {
  if (!raw) return "active";
  const s = String(raw).trim();
  if (["active", "有効", "登録中"].some((k) => s.includes(k))) return "active";
  if (["expired", "期限切れ", "失効"].some((k) => s.includes(k))) return "expired";
  if (["revoked", "取消", "許可取消"].some((k) => s.includes(k))) return "revoked";
  if (["suspended", "停止"].some((k) => s.includes(k))) return "suspended";
  if (["pending", "審査", "申請"].some((k) => s.includes(k))) return "pending";
  return "active";
}

// ─── slug 生成 ───────────────────────

export function toSlug(entityName, prefecture) {
  const parts = [prefecture, entityName].filter(Boolean).join("-");
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

// ─── 名寄せロジック ──────────────────

/**
 * 名寄せ: 法人番号 → 正規化名 → slug の順で既存エンティティを検索
 * @returns {{ match: object|null, method: string }}
 */
export function resolveEntity(raw, { findByCorporateNumber, findByNormalizedName } = {}) {
  // 1. 法人番号一致
  if (raw.corporate_number && findByCorporateNumber) {
    const match = findByCorporateNumber(String(raw.corporate_number).trim());
    if (match) return { match, method: "corporate_number" };
  }

  // 2. 正規化名一致
  const name = raw.entity_name || raw.company_name || raw.name;
  if (name && findByNormalizedName) {
    const normalized = normalizeEntityName(name);
    const match = findByNormalizedName(normalized);
    if (match) return { match, method: "normalized_name" };
  }

  return { match: null, method: "none" };
}

// ─── 1件正規化 ──────────────────────

export function normalize(raw) {
  const errors = [];
  const entityName = raw.entity_name ? String(raw.entity_name).trim()
    : raw.company_name ? String(raw.company_name).trim()
    : raw.name ? String(raw.name).trim()
    : null;

  if (!entityName) {
    errors.push("entity_name が未指定");
    return { item: null, errors };
  }

  const prefecture = raw.prefecture ? String(raw.prefecture).trim() : null;
  const slug = raw.slug ? String(raw.slug).trim() : toSlug(entityName, prefecture);
  if (!slug) {
    errors.push(`${entityName}: slug を生成できません`);
    return { item: null, errors };
  }

  return {
    item: {
      slug,
      entity_name: entityName,
      normalized_name: normalizeEntityName(entityName),
      corporate_number: raw.corporate_number ? String(raw.corporate_number).trim() : null,
      prefecture,
      city: raw.city ? String(raw.city).trim() : null,
      address: raw.address ? String(raw.address).trim() : null,
      entity_status: normalizeEntityStatus(raw.entity_status || raw.status),
      primary_license_family: normalizeLicenseFamily(raw.primary_license_family || raw.license_family),
      registration_count: raw.registration_count || 0,
      latest_update_date: normalizeDate(raw.latest_update_date),
      source_name: raw.source_name ? String(raw.source_name).trim() : null,
      source_url: raw.source_url ? String(raw.source_url).trim() : null,
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
      if (verbose) console.log(`  [${i + 1}] ${item.entity_name} (dry-run)`);
      continue;
    }

    try {
      const result = upsertFn(item);
      if (result.action === "insert") { report.inserted++; if (verbose) console.log(`  [${i + 1}] INSERT ${item.entity_name}`); }
      else if (result.action === "update") { report.updated++; if (verbose) console.log(`  [${i + 1}] UPDATE ${item.entity_name}`); }
      else { report.skipped++; }
    } catch (err) {
      report.errors.push(`${item.entity_name}: ${err.message}`);
      report.skipped++;
      if (verbose) console.log(`  [${i + 1}] ERROR: ${err.message}`);
    }
  }
  return report;
}
