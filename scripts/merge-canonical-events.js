/**
 * 名寄せスクリプト: 同一大会を canonical_event_id で統合
 *
 * Usage:
 *   node scripts/merge-canonical-events.js              # ドライラン（変更なし）
 *   node scripts/merge-canonical-events.js --apply      # 実際に適用
 *   node scripts/merge-canonical-events.js --verbose    # 詳細ログ
 *
 * ロジック:
 *   1. 大会名を正規化（第○回削除、年号削除、全角→半角、小文字、空白除去）
 *   2. 正規化名 + 開催日 + 都道府県 でグルーピング
 *   3. 同一グループ内で最も情報が豊富なレコードを canonical に選定
 *   4. 他のレコードの canonical_event_id を canonical の id にセット
 */

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(
  path.join(__dirname, "..", "web", "package.json")
);
const Database = webRequire("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");

/**
 * 大会名を正規化
 */
function normalizeTitle(title) {
  if (!title) return "";
  return title
    // 「第○回」削除
    .replace(/第\s*\d+\s*回\s*/g, "")
    // 年号削除（2024, 2025, 2026等）
    .replace(/20\d{2}年?/g, "")
    // 全角英数→半角
    .replace(/[Ａ-Ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[ａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // 全角スペース→半角
    .replace(/　/g, " ")
    // 記号除去
    .replace(/[・\-‐–—＝=＆&＠@！!？?【】「」『』（）()〔〕\[\]]/g, "")
    // 小文字化
    .toLowerCase()
    // 全スペース除去
    .replace(/\s+/g, "")
    .trim();
}

/**
 * レコードの情報充実度スコア
 * 高いほど canonical に適する
 */
function qualityScore(event) {
  let score = 0;
  if (event.description) score += 3;
  if (event.hero_image_url) score += 2;
  if (event.event_date) score += 2;
  if (event.prefecture) score += 1;
  if (event.city) score += 1;
  if (event.venue_name) score += 1;
  if (event.entry_start_date) score += 1;
  if (event.entry_end_date) score += 1;
  if (event.official_url) score += 1;
  if (event.entry_status === "open") score += 2;
  // RUNNETを優先（詳細データが豊富）
  if (event.source_site === "runnet") score += 3;
  return score;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes("--apply"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

function main() {
  const { apply, verbose } = parseArgs();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  console.log("=== 名寄せ処理（canonical_event_id 統合） ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  // 全イベント取得
  const events = db.prepare(`
    SELECT id, source_site, source_event_id, title, normalized_title,
           event_date, prefecture, city, venue_name, description,
           hero_image_url, entry_status, entry_start_date, entry_end_date,
           official_url, source_url
    FROM events
    WHERE is_active = 1
  `).all();

  console.log(`\nTotal active events: ${events.length}`);

  // [1] 正規化キー生成
  const groups = {};
  for (const ev of events) {
    const nKey = normalizeTitle(ev.title) + "|" + (ev.event_date || "") + "|" + (ev.prefecture || "");
    ev._normalizedKey = nKey;
    if (!groups[nKey]) groups[nKey] = [];
    groups[nKey].push(ev);
  }

  // [2] 重複グループ抽出
  const dupeGroups = Object.entries(groups).filter(([, v]) => v.length > 1);
  console.log(`Duplicate groups: ${dupeGroups.length}`);

  if (dupeGroups.length === 0) {
    console.log("No duplicates found. Nothing to merge.");
    // normalized_keyだけ更新
    if (apply) {
      const updateKey = db.prepare("UPDATE events SET normalized_key = ? WHERE id = ?");
      const tx = db.transaction(() => {
        for (const ev of events) {
          updateKey.run(ev._normalizedKey, ev.id);
        }
      });
      tx();
      console.log("Updated normalized_key for all events.");
    }
    db.close();
    return;
  }

  // [3] 各グループで canonical を選定
  const mergeOps = [];
  for (const [key, members] of dupeGroups) {
    // スコア順にソート（高い順）
    members.sort((a, b) => qualityScore(b) - qualityScore(a));
    const canonical = members[0];
    const others = members.slice(1);

    if (verbose) {
      console.log(`\n  Group: ${key.substring(0, 60)}`);
      console.log(`    Canonical: id=${canonical.id} (${canonical.source_site}) score=${qualityScore(canonical)}`);
      others.forEach((o) => {
        console.log(`    Merge: id=${o.id} (${o.source_site}) score=${qualityScore(o)} → canonical_event_id=${canonical.id}`);
      });
    }

    mergeOps.push({ canonical, others });
  }

  console.log(`\nMerge operations: ${mergeOps.length} groups, ${mergeOps.reduce((s, m) => s + m.others.length, 0)} records to merge`);

  // [4] 適用
  if (apply) {
    const updateCanonical = db.prepare("UPDATE events SET canonical_event_id = ? WHERE id = ?");
    const updateKey = db.prepare("UPDATE events SET normalized_key = ? WHERE id = ?");

    const tx = db.transaction(() => {
      // 全イベントの normalized_key を更新
      for (const ev of events) {
        updateKey.run(ev._normalizedKey, ev.id);
      }

      // 重複グループのみ canonical_event_id を設定
      for (const { canonical, others } of mergeOps) {
        // canonical自身は canonical_event_id = NULL（自分が代表）
        updateCanonical.run(null, canonical.id);
        // 他は canonical の id を設定
        for (const other of others) {
          updateCanonical.run(canonical.id, other.id);
        }
      }
    });
    tx();

    const merged = db.prepare("SELECT COUNT(*) as c FROM events WHERE canonical_event_id IS NOT NULL").get().c;
    console.log(`\nApplied: ${merged} records now have canonical_event_id set`);
  } else {
    console.log("\n[DRY RUN] No changes applied. Use --apply to execute.");
  }

  db.close();
  console.log("\n=== Done ===");
}

main();
