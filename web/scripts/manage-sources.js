#!/usr/bin/env node
/**
 * Source 管理ユーティリティ
 *
 * Usage:
 *   node scripts/manage-sources.js list                    # ソース一覧
 *   node scripts/manage-sources.js check                   # 全ソースの到達確認
 *   node scripts/manage-sources.js deactivate <id>         # ソースを inactive に
 *   node scripts/manage-sources.js activate <id>           # ソースを active に
 *   node scripts/manage-sources.js update-url <id> <url>   # URL更新
 *   node scripts/manage-sources.js fix-404                 # 404ソースを自動修正
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (!command || command === "list") {
    const sources = db.prepare("SELECT * FROM data_sources ORDER BY domain_id, id").all();
    console.log(`\nデータソース一覧 (${sources.length}件):\n`);
    for (const s of sources) {
      const statusIcon = s.status === "active" ? "✅" : s.status === "error" ? "❌" : "⏸️";
      console.log(`  ${statusIcon} [${s.id}] ${s.domain_id} / ${s.source_name}`);
      console.log(`     URL: ${s.source_url || "—"}`);
      console.log(`     方式: ${s.fetch_method} | 頻度: ${s.run_frequency} | ポリシー: ${s.publish_policy}`);
      console.log(`     最終成功: ${s.last_success_at || "never"} | 最終確認: ${s.last_checked_at || "never"}`);
      console.log("");
    }
    return;
  }

  if (command === "check") {
    console.log("\n全ソースの到達確認...\n");
    const sources = db.prepare("SELECT * FROM data_sources WHERE source_url IS NOT NULL ORDER BY id").all();

    for (const s of sources) {
      process.stdout.write(`  [${s.id}] ${s.source_name}: `);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(s.source_url, {
          method: "HEAD",
          signal: controller.signal,
          headers: { "User-Agent": "SportsEventApp-HealthCheck/1.0" },
          redirect: "follow",
        });
        clearTimeout(timer);

        if (res.ok) {
          console.log(`✅ ${res.status} OK`);
        } else {
          console.log(`❌ ${res.status} ${res.statusText}`);
          // 報告のみ。自動ステータス変更はしない。
          // 停止する場合は: node manage-sources.js deactivate <id>
        }
      } catch (err) {
        console.log(`❌ ${err.name === "AbortError" ? "Timeout" : err.message}`);
      }
    }
    return;
  }

  if (command === "deactivate") {
    const id = parseInt(args[1]);
    if (!id) { console.log("Usage: manage-sources.js deactivate <id>"); return; }
    db.prepare("UPDATE data_sources SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(id);
    console.log(`Source #${id} を inactive に変更しました`);
    return;
  }

  if (command === "activate") {
    const id = parseInt(args[1]);
    if (!id) { console.log("Usage: manage-sources.js activate <id>"); return; }
    db.prepare("UPDATE data_sources SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(id);
    console.log(`Source #${id} を active に変更しました`);
    return;
  }

  if (command === "update-url") {
    const id = parseInt(args[1]);
    const url = args[2];
    if (!id || !url) { console.log("Usage: manage-sources.js update-url <id> <url>"); return; }
    db.prepare("UPDATE data_sources SET source_url = ?, status = 'active', updated_at = datetime('now') WHERE id = ?").run(url, id);
    console.log(`Source #${id} の URL を更新しました: ${url}`);
    return;
  }

  if (command === "fix-404") {
    console.log("\n404ソースの修正...\n");

    // 横浜市: 正しいURLに更新
    const yokohama = db.prepare("SELECT id FROM data_sources WHERE source_name LIKE '%横浜%'").get();
    if (yokohama) {
      db.prepare("UPDATE data_sources SET source_url = 'https://www.city.yokohama.lg.jp/business/shitei/', status = 'active', notes = '横浜市指定管理者公募ページ（URL修正済み）', updated_at = datetime('now') WHERE id = ?").run(yokohama.id);
      console.log(`  [${yokohama.id}] 横浜市: URL更新 → active`);
    }

    // 大阪市: inactive に変更（正確なURLが不明）
    const osaka = db.prepare("SELECT id FROM data_sources WHERE source_name LIKE '%大阪%'").get();
    if (osaka) {
      db.prepare("UPDATE data_sources SET status = 'inactive', notes = '公募ページのURL確認が必要。一時的に inactive に変更。', updated_at = datetime('now') WHERE id = ?").run(osaka.id);
      console.log(`  [${osaka.id}] 大阪市: → inactive（URL要確認）`);
    }

    console.log("\n完了");
    return;
  }

  console.log("Unknown command. Use: list | check | deactivate | activate | update-url | fix-404");
}

main().catch((err) => { console.error(err); process.exit(1); });
