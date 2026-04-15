#!/usr/bin/env node
/**
 * 到達性監査でHTTP 404を返した「確認済（巡回中）」ソースを
 * 「補完対象（国集約で充当）」に一括降格するスクリプト。
 *
 * 背景:
 *   登録時にURLは存在したが、その後のCMS移行等でURLが無効化したケース。
 *   大半の都道府県の産廃ページは sanpainet_torikeshi が全国横断で
 *   データを収集しているため、個別URLが壊れていても実害なし。
 *   ただし registry の状態としては補完対象に降格するのが正確。
 *
 * 使い方:
 *   node scripts/demote-404-to-manual-review.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const FILE = path.resolve(process.cwd(), "lib/gyosei-shobun-source-registry.js");
const TODAY = "2026-04-16";

// 2026-04-16 の初回監査で HTTP 404 を返した確認済ソース（33件）。
// sanpainet_torikeshi が全国横断で補完するため実害なし。
const TO_DEMOTE = [
  { id: "fukuoka_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "shizuoka_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "ibaraki_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "niigata_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "nagano_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "gifu_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "fukushima_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "tochigi_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "gunma_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "mie_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "shiga_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "toyama_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "ishikawa_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "fukui_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "wakayama_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "okayama_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "yamaguchi_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "shimane_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "tokushima_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "kagawa_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "ehime_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "aomori_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "iwate_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "yamagata_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "kochi_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "saga_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "nagasaki_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "kumamoto_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "oita_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "miyazaki_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "kagoshima_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "okinawa_sanpai", reason: "URL 404化・sanpainetで補完" },
  { id: "yamanashi_sanpai", reason: "URL 404化・sanpainetで補完" },
];

let src = fs.readFileSync(FILE, "utf8");
const original = src;
let changed = 0, skipped = 0;

for (const { id, reason } of TO_DEMOTE) {
  const idPattern = new RegExp(`(id:\\s*"${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}")`);
  const idMatch = src.match(idPattern);
  if (!idMatch) { console.warn(`[skip] id not found: ${id}`); skipped++; continue; }

  const idStart = idMatch.index;
  const afterIdPart = src.slice(idStart);

  const statusPattern = /discoveryStatus:\s*"confirmed"/;
  const statusMatch = afterIdPart.match(statusPattern);
  if (!statusMatch) {
    console.warn(`[skip] discoveryStatus: "confirmed" not found for ${id}`);
    skipped++;
    continue;
  }

  const absPos = idStart + statusMatch.index;
  src = src.slice(0, absPos) + `discoveryStatus: "manual_review"` + src.slice(absPos + statusMatch[0].length);

  // notes に履歴を追記
  const sliceFromId = src.slice(idStart);
  const notesMatch = sliceFromId.match(/notes:\s*"((?:[^"\\]|\\.)*)"/);
  if (notesMatch) {
    const oldNotes = notesMatch[1];
    const newNotes = `[${TODAY}補完対象に降格/${reason}] ${oldNotes}`;
    const notesAbsPos = idStart + notesMatch.index;
    src = src.slice(0, notesAbsPos) + `notes: "${newNotes}"` + src.slice(notesAbsPos + notesMatch[0].length);
  }

  changed++;
  console.log(`[ok] ${id} → manual_review`);
}

console.log();
console.log(`変更: ${changed}件 / スキップ: ${skipped}件`);

if (dryRun) {
  console.log("(--dry-run なので書き込みなし)");
} else if (src !== original) {
  fs.writeFileSync(FILE, src, "utf8");
  console.log(`✓ ${FILE} を更新しました`);
}
