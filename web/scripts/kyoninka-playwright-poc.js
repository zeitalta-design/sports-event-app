#!/usr/bin/env node
/**
 * kyoninka Playwright PoC — ブラウザ自動操作で国交省検索を実行
 *
 * 前提: npm install playwright (または npx playwright install chromium)
 *
 * Usage:
 *   node scripts/kyoninka-playwright-poc.js             # 東京都で検索テスト
 *   node scripts/kyoninka-playwright-poc.js --ken 27    # 大阪府(27)で検索
 *   node scripts/kyoninka-playwright-poc.js --check     # Playwright インストール確認のみ
 *
 * 成功時: 検索結果HTMLをDBに保存し、entity/registrations に最小パース
 */

async function main() {
  const args = process.argv.slice(2);
  const kenCode = args.includes("--ken") ? args[args.indexOf("--ken") + 1] : "13";
  const checkOnly = args.includes("--check");

  console.log("\n=== kyoninka Playwright PoC ===\n");

  // Playwright インストール確認
  let playwright;
  try {
    playwright = await import("playwright");
    console.log("✅ Playwright: インストール済み");
  } catch {
    console.log("❌ Playwright: 未インストール");
    console.log("");
    console.log("インストール方法:");
    console.log("  npm install playwright");
    console.log("  npx playwright install chromium");
    console.log("");
    console.log("代替: Playwright なしでの運用方針");
    console.log("  1. kyoninka は引き続き fallback（サンプルデータ）で運用");
    console.log("  2. 手動で国交省検索結果をCSV/JSONで取り込み");
    console.log("  3. 都道府県の建設業許可者名簿（HTMLベース）を代替ソースに");
    console.log("");

    // 代替方針をドキュメント化
    await writeAlternativePlan();
    return;
  }

  if (checkOnly) {
    console.log("Playwright インストール確認完了");
    return;
  }

  console.log(`検索条件: 都道府県コード=${kenCode}`);
  console.log("ブラウザ起動中...\n");

  const { chromium } = playwright;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();

    // Step 1: 検索ページにアクセス
    console.log("Step 1: 検索ページにアクセス...");
    await page.goto("https://etsuran2.mlit.go.jp/TAKKEN/kensetuKensaku.do?outPutKbn=1", { timeout: 30000 });
    console.log(`  URL: ${page.url()}`);
    console.log(`  タイトル: ${await page.title()}`);

    // Step 2: 都道府県を選択
    console.log(`\nStep 2: 都道府県コード ${kenCode} を選択...`);
    await page.selectOption("select[name='kenCode']", kenCode);

    // Step 3: 検索実行
    console.log("\nStep 3: 検索実行...");
    // CMD=search の hidden フィールドを設定
    await page.evaluate(() => {
      const cmdField = document.querySelector("input[name='CMD']");
      if (cmdField) cmdField.value = "search";
    });
    await page.click("input[type='submit'], button[type='submit']");

    // 結果待ち
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Step 4: 結果HTML取得
    console.log("\nStep 4: 結果HTML取得...");
    const resultHtml = await page.content();
    console.log(`  HTML長: ${resultHtml.length}文字`);

    // 結果テーブルの存在確認
    const hasTable = resultHtml.includes("kensetuDetail") || resultHtml.includes("業者名") || resultHtml.includes("商号");
    console.log(`  結果テーブル: ${hasTable ? "✅ あり" : "❌ なし"}`);

    if (hasTable) {
      // 最小パース
      const rows = extractRows(resultHtml);
      console.log(`  抽出行数: ${rows.length}`);

      if (rows.length > 0) {
        console.log("\n  サンプル（先頭5件）:");
        rows.slice(0, 5).forEach((r, i) => {
          console.log(`    [${i + 1}] ${JSON.stringify(r)}`);
        });

        // DB保存（kyoninka_entities に最小投入）
        const { getDb } = await import("../lib/db.js");
        const db = getDb();
        let saved = 0;

        for (const row of rows.slice(0, 10)) {
          if (!row.name || row.name.length < 2) continue;
          const slug = row.name.replace(/[（）()【】\[\]\s]/g, "-").replace(/-+/g, "-").toLowerCase().substring(0, 80);
          const existing = db.prepare("SELECT id FROM kyoninka_entities WHERE slug = ?").get(slug);
          if (existing) continue;

          try {
            db.prepare(`
              INSERT OR IGNORE INTO kyoninka_entities
                (slug, entity_name, normalized_name, prefecture, entity_status, primary_license_family, registration_count, source_name, is_published, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'active', 'construction', 0, '国土交通省建設業者検索(Playwright)', 1, datetime('now'), datetime('now'))
            `).run(slug, row.name, row.name, row.prefecture || null);
            saved++;
          } catch {}
        }
        console.log(`\n  DB保存: ${saved}件`);
      }
    } else {
      console.log("  検索結果が取得できませんでした");
      console.log("  ページ内容のサンプル:");
      const text = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || "");
      console.log(`    ${text.substring(0, 300)}`);
    }

    console.log("\n=== PoC 完了 ===");
  } catch (err) {
    console.log(`\n❌ エラー: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

function extractRows(html) {
  const rows = [];
  // テーブル行からデータを抽出（簡易版）
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = trRegex.exec(html)) !== null) {
    const cells = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(match[1])) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length >= 3 && !cells[0].includes("商号") && !cells[0].includes("No")) {
      rows.push({ name: cells[0] || cells[1], prefecture: null, regNumber: cells[2] || null });
    }
  }
  return rows;
}

async function writeAlternativePlan() {
  console.log("=== kyoninka 代替運用方針（Playwright未導入時）===\n");
  console.log("1. 現状維持（fallback サンプルデータで運用）");
  console.log("   - 公開ページは seed + 手動入力データで構成");
  console.log("   - sync_runs / change_logs は記録される");
  console.log("");
  console.log("2. 手動CSV取り込み");
  console.log("   - 国交省サイトで手動検索 → 結果をCSV/JSONに保存");
  console.log("   - node scripts/run-sync.js kyoninka でインポート");
  console.log("");
  console.log("3. 都道府県の建設業許可者名簿を代替ソースに");
  console.log("   - HTML公開している都道府県のページを Source Adapter に追加");
  console.log("   - 例: 東京都建設業課の許可業者一覧");
  console.log("");
  console.log("推奨: まずは選択肢1で運用開始し、");
  console.log("      Playwright 導入可能な環境が整ったら npm install playwright で有効化");
}

main().catch((err) => { console.error(err); process.exit(1); });
