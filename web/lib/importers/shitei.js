/**
 * 指定管理・委託公募まとめ — 外部データ取り込み基盤
 */

import fs from "fs";
import { shiteiConfig, calculateRecruitmentStatus } from "../shitei-config.js";

const VALID_CATEGORIES = new Set(shiteiConfig.facilityCategories.map((c) => c.slug));

const CATEGORY_ALIAS = {
  "スポーツ": "sports", "体育館": "sports", "プール": "sports", "競技場": "sports", "運動場": "sports",
  "文化": "culture", "ホール": "culture", "美術館": "culture", "博物館": "culture", "図書館": "culture",
  "福祉": "welfare", "介護": "welfare", "障害者": "welfare", "高齢者": "welfare", "保育": "welfare",
  "公園": "park", "緑地": "park", "庭園": "park",
  "住宅": "housing", "駐車場": "housing", "駐輪場": "housing",
  "教育": "education", "学校": "education", "研修": "education",
  "コミュニティ": "community", "集会所": "community", "市民センター": "community", "公民館": "community",
  "観光": "tourism", "宿泊": "tourism", "キャンプ": "tourism", "温泉": "tourism",
  "環境": "waste", "廃棄物": "waste", "清掃": "waste", "リサイクル": "waste",
};

export function normalizeFacilityCategory(raw) {
  if (!raw) return "other";
  const t = String(raw).trim();
  if (VALID_CATEGORIES.has(t)) return t;
  if (CATEGORY_ALIAS[t]) return CATEGORY_ALIAS[t];
  for (const [key, val] of Object.entries(CATEGORY_ALIAS)) {
    if (t.includes(key)) return val;
  }
  return "other";
}

export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const match = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return s;
}

export function toSlug(title, municipalityName) {
  const parts = [municipalityName, title].filter(Boolean).join("-");
  if (!parts) return null;
  return parts
    .replace(/[（）()【】\[\]]/g, " ")
    .replace(/[^\w\u3000-\u9FFF\uF900-\uFAFF-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 80);
}

export function normalize(raw) {
  const errors = [];
  const title = raw.title ? String(raw.title).trim()
    : raw.name ? String(raw.name).trim()
    : null;

  if (!title) {
    errors.push("title が未指定");
    return { item: null, errors };
  }

  const municipalityName = raw.municipality_name ? String(raw.municipality_name).trim() : null;
  const slug = raw.slug ? String(raw.slug).trim() : toSlug(title, municipalityName);
  if (!slug) {
    errors.push(`${title}: slug を生成できません`);
    return { item: null, errors };
  }

  const item = {
    slug,
    title,
    municipality_name: municipalityName,
    prefecture: raw.prefecture ? String(raw.prefecture).trim() : null,
    facility_category: normalizeFacilityCategory(raw.facility_category),
    facility_name: raw.facility_name ? String(raw.facility_name).trim() : null,
    recruitment_status: raw.recruitment_status || "unknown",
    application_start_date: normalizeDate(raw.application_start_date),
    application_deadline: normalizeDate(raw.application_deadline),
    opening_date: normalizeDate(raw.opening_date),
    contract_start_date: normalizeDate(raw.contract_start_date),
    contract_end_date: normalizeDate(raw.contract_end_date),
    summary: raw.summary ? String(raw.summary).trim() : null,
    eligibility: raw.eligibility ? String(raw.eligibility).trim() : null,
    application_method: raw.application_method ? String(raw.application_method).trim() : null,
    detail_url: raw.detail_url ? String(raw.detail_url).trim() : null,
    source_name: raw.source_name ? String(raw.source_name).trim() : null,
    source_url: raw.source_url ? String(raw.source_url).trim() : null,
    attachment_count: raw.attachment_count || 0,
    notes: raw.notes ? String(raw.notes).trim() : null,
    is_published: raw.is_published != null ? (raw.is_published ? 1 : 0) : 1,
    published_at: raw.published_at || null,
  };

  // 募集状態の自動判定
  item.recruitment_status = calculateRecruitmentStatus(item);

  return { item, errors };
}

export function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  throw new Error("入力 JSON は配列または { items: [...] } 形式である必要があります");
}

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
      if (verbose) console.log(`  [${i + 1}] ${item.title} (dry-run)`);
      continue;
    }

    try {
      const result = upsertFn(item);
      if (result.action === "insert") { report.inserted++; if (verbose) console.log(`  [${i + 1}] INSERT ${item.title}`); }
      else if (result.action === "update") { report.updated++; if (verbose) console.log(`  [${i + 1}] UPDATE ${item.title}`); }
      else { report.skipped++; }
    } catch (err) {
      report.errors.push(`${item.title}: ${err.message}`);
      report.skipped++;
      if (verbose) console.log(`  [${i + 1}] ERROR: ${err.message}`);
    }
  }
  return report;
}
