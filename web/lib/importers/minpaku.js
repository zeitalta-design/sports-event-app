import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { minpakuConfig } = await import(pathToFileURL(resolve(__dirname, "../minpaku-config.js")).href);

const VALID_CATEGORIES = new Set(minpakuConfig.categories.map((c) => c.slug));
const CAT_ALIAS = { "都市": "city", "リゾート": "resort", "ファミリー": "family", "ビジネス": "business", "高級": "luxury", "格安": "budget", "その他": "other" };

function normCat(raw) { if (!raw) return "other"; const t = String(raw).trim(); if (VALID_CATEGORIES.has(t)) return t; if (CAT_ALIAS[t]) return CAT_ALIAS[t]; for (const [k, v] of Object.entries(CAT_ALIAS)) { if (t.includes(k)) return v; } return "other"; }
function normStatus(raw) { if (!raw) return "active"; const s = String(raw).trim().toLowerCase(); if (["active", "掲載中", "公開"].some((k) => s.includes(k))) return "active"; if (["inactive", "休止"].some((k) => s.includes(k))) return "inactive"; if (["closed", "終了"].some((k) => s.includes(k))) return "closed"; return "active"; }
function toSlug(title) { if (!title) return null; return title.replace(/[（）()【】\[\]]/g, " ").replace(/[^\w\u3000-\u9FFF\uF900-\uFAFF-]/g, " ").trim().replace(/\s+/g, "-").toLowerCase().substring(0, 60); }

export function normalize(raw) {
  const errors = [];
  const title = raw.title ? String(raw.title).trim() : raw.name ? String(raw.name).trim() : null;
  if (!title) { errors.push("title が未指定"); return { item: null, errors }; }
  const slug = raw.slug ? String(raw.slug).trim() : toSlug(title);
  if (!slug) { errors.push(`${title}: slug を生成できません`); return { item: null, errors }; }
  return { item: { slug, title, category: normCat(raw.category), area: raw.area ? String(raw.area).trim() : null, property_type: raw.property_type || "entire", capacity: raw.capacity ? Number(raw.capacity) : null, price_per_night: raw.price_per_night ? Number(raw.price_per_night) : null, min_nights: raw.min_nights ? Number(raw.min_nights) : 1, host_name: raw.host_name ? String(raw.host_name).trim() : null, rating: raw.rating ? Number(raw.rating) : null, review_count: raw.review_count ? Number(raw.review_count) : 0, summary: raw.summary ? String(raw.summary).trim() : null, status: normStatus(raw.status), is_published: raw.is_published != null ? (raw.is_published ? 1 : 0) : 1 }, errors };
}

export function loadJson(filePath) { const d = JSON.parse(fs.readFileSync(filePath, "utf-8")); if (Array.isArray(d)) return d; if (d.items && Array.isArray(d.items)) return d.items; throw new Error("入力 JSON は配列または { items: [...] } 形式である必要があります"); }

export async function loadRemoteJson(url) {
  const res = await fetch(url); if (!res.ok) throw new Error(`リモート取得失敗: ${res.status} ${res.statusText} (${url})`);
  let data; try { data = JSON.parse(await res.text()); } catch (e) { throw new Error(`JSON パース失敗: ${e.message} (${url})`); }
  if (Array.isArray(data)) return data; if (data.items && Array.isArray(data.items)) return data.items; if (data.data && Array.isArray(data.data)) return data.data; if (data.results && Array.isArray(data.results)) return data.results;
  throw new Error("リモート JSON は配列または { items/data/results: [...] } 形式である必要があります");
}

export function runImport(rawItems, { dryRun = false, upsertFn, verbose = false } = {}) {
  const report = { total: rawItems.length, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rawItems.length; i++) {
    const { item, errors } = normalize(rawItems[i]);
    if (errors.length > 0) { report.errors.push(...errors); report.skipped++; if (verbose) console.log(`  ⚠️  [${i + 1}] ${errors.join(", ")}`); continue; }
    if (!item) { report.skipped++; continue; }
    report.valid++;
    if (dryRun) { if (verbose) console.log(`  🔍 [${i + 1}] ${item.title} (dry-run)`); continue; }
    try { const r = upsertFn(item); if (r.action === "insert") { report.inserted++; if (verbose) console.log(`  ✅ [${i + 1}] INSERT ${item.title}`); } else if (r.action === "update") { report.updated++; if (verbose) console.log(`  🔄 [${i + 1}] UPDATE ${item.title}`); } else { report.skipped++; } }
    catch (err) { report.errors.push(`${item.title}: ${err.message}`); report.skipped++; if (verbose) console.log(`  ❌ [${i + 1}] ERROR: ${err.message}`); }
  }
  return report;
}
