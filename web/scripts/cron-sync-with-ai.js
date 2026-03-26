#!/usr/bin/env node
/**
 * 統合日次運用スクリプト: 同期 + AI抽出
 *
 * Usage:
 *   node scripts/cron-sync-with-ai.js                           # 全ドメイン同期 + AI抽出
 *   node scripts/cron-sync-with-ai.js --domain food-recall      # 特定ドメイン
 *   node scripts/cron-sync-with-ai.js --ai-only                 # AI抽出のみ（同期スキップ）
 *   node scripts/cron-sync-with-ai.js --ai-limit 10             # AI抽出件数上限
 *   node scripts/cron-sync-with-ai.js --status                  # ステータス確認
 *
 * cron設定例:
 *   # 毎朝 7:00 に同期 + AI抽出
 *   0 7 * * * cd /path/to/web && LLM_ENABLED=true LLM_API_KEY=xxx node scripts/cron-sync-with-ai.js
 */

async function main() {
  const args = process.argv.slice(2);
  const domainFilter = args.includes("--domain") ? args[args.indexOf("--domain") + 1] : null;
  const aiOnly = args.includes("--ai-only");
  const aiLimit = args.includes("--ai-limit") ? parseInt(args[args.indexOf("--ai-limit") + 1]) : 10;
  const statusOnly = args.includes("--status");

  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[daily-ops] ${timestamp} — 日次運用開始`);
  console.log(`${"=".repeat(60)}`);

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (statusOnly) {
    await showDailyStatus(db);
    return;
  }

  // ─── Step 1: 同期実行 ─────────────────────
  if (!aiOnly) {
    console.log("\n📡 Step 1: データ同期");
    const { execSync } = await import("child_process");
    try {
      const syncArgs = domainFilter ? `--domain ${domainFilter}` : "";
      const output = execSync(`node scripts/cron-sync.js ${syncArgs}`, {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 120000,
        env: process.env,
      });
      // 結果行だけ表示
      output.split("\n").filter(l => l.includes("結果:") || l.includes("完了")).forEach(l => console.log(`  ${l.trim()}`));
    } catch (err) {
      console.log(`  同期エラー: ${err.message?.substring(0, 200)}`);
    }
  }

  // ─── Step 2: AI抽出対象選定 ─────────────────────
  console.log("\n🤖 Step 2: AI抽出対象選定");
  const domains = domainFilter ? [domainFilter] : ["food-recall", "shitei", "sanpai"];
  const targets = selectAiTargets(db, domains, aiLimit);

  console.log(`  対象: ${targets.length}件`);
  const domainCounts = {};
  targets.forEach(t => { domainCounts[t.domain] = (domainCounts[t.domain] || 0) + 1; });
  Object.entries(domainCounts).forEach(([d, c]) => console.log(`    ${d}: ${c}件`));

  if (targets.length === 0) {
    console.log("  AI抽出対象なし");
    showQuickStats(db);
    return;
  }

  // ─── Step 3: AI抽出実行 ─────────────────────
  console.log("\n📝 Step 3: AI抽出実行");
  const { extractFoodRecallDetail, extractShiteiDetail } = await import("../lib/core/automation/detail-extractors.js");

  let extracted = 0, failed = 0;

  for (const target of targets) {
    try {
      let result;
      if (target.domain === "food-recall") {
        result = await extractFoodRecallDetail(target.url);
      } else {
        result = await extractShiteiDetail(target.url);
      }

      if (!result.ok) {
        console.log(`  ❌ [${target.domain}] ${target.slug}: ${result.error}`);
        failed++;
        continue;
      }

      // LLM補完（有効時）
      let llmModel = "deterministic";
      let llmTokens = 0;
      if (process.env.LLM_ENABLED === "true" && process.env.LLM_API_KEY && result.missing.length > 0) {
        try {
          const { callLlm } = await import("../lib/llm-client.js");
          const { fetchHtml, stripTags } = await import("../lib/core/automation/fetch-helper.js");
          const htmlRes = await fetchHtml(target.url, { timeout: 10000 });
          if (htmlRes.ok) {
            let text = htmlRes.html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
            text = stripTags(text).replace(/\n{3,}/g, "\n\n").trim().substring(0, 6000);
            const llmResult = await callLlm({
              systemPrompt: `不足項目を抽出してJSON形式で返してください。不足: ${result.missing.join(", ")}。出力: {"data":{...},"confidence":0.7}`,
              userPrompt: text,
            });
            try {
              const parsed = JSON.parse(llmResult.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
              if (parsed.data) {
                Object.entries(parsed.data).forEach(([k, v]) => { if (v && !result.data[k]) result.data[k] = v; });
                result.missing = result.missing.filter(f => !parsed.data[f]);
                result.confidence = Math.min(1.0, result.confidence + 0.15);
              }
            } catch {}
            llmModel = llmResult.model || "llm";
            llmTokens = (llmResult.usage?.inputTokens || 0) + (llmResult.usage?.outputTokens || 0);
          }
        } catch {}
      }

      // DB保存
      db.prepare(`
        INSERT INTO ai_extractions (domain_id, entity_type, entity_id, entity_slug, source_url, extraction_type,
         input_text_length, extracted_json, missing_fields, review_reasons, confidence_score, quality_level,
         summary_text, llm_model, llm_tokens_used, created_at)
        VALUES (@d, @et, @eid, @sl, @url, 'detail_page', @len, @json, @miss, @rev, @conf, @qual, @sum, @model, @tok, datetime('now'))
      `).run({
        d: target.domain, et: target.entityType, eid: target.entityId, sl: target.slug, url: target.url,
        len: result.inputLength || 0,
        json: JSON.stringify(result.data),
        miss: JSON.stringify(result.missing),
        rev: JSON.stringify(result.missing.length > 0 ? ["補完要"] : []),
        conf: result.confidence, qual: result.quality,
        sum: result.data.summary || null, model: llmModel, tok: llmTokens,
      });

      const icon = result.quality === "good" ? "✅" : result.quality === "draft" ? "📝" : "⚠️";
      console.log(`  ${icon} [${target.domain}] ${target.slug}: conf=${result.confidence.toFixed(2)} q=${result.quality} miss=${result.missing.length}`);
      extracted++;
    } catch (err) {
      console.log(`  ❌ [${target.domain}] ${target.slug}: ${err.message}`);
      failed++;
    }
  }

  // ─── Step 4: review優先順位付け ─────────────────────
  console.log("\n📊 Step 4: review優先順位付け");
  const priorities = assignReviewPriorities(db);
  console.log(`  P1 (反映候補): ${priorities.p1}件`);
  console.log(`  P2 (要確認): ${priorities.p2}件`);
  console.log(`  P3 (保留): ${priorities.p3}件`);
  console.log(`  P4 (失敗/再取得): ${priorities.p4}件`);

  // 結果表示
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[daily-ops] 完了 (${elapsed}秒) — 抽出${extracted}件, 失敗${failed}件`);
  console.log(`${"=".repeat(60)}`);

  showQuickStats(db);
}

/**
 * AI抽出対象を自動選定
 */
function selectAiTargets(db, domains, limit) {
  const targets = [];

  for (const domain of domains) {
    let table, urlField, slugField, nameField, entityType;
    if (domain === "food-recall") {
      table = "food_recall_items"; urlField = "source_url"; slugField = "slug"; nameField = "product_name"; entityType = "food_recall_item";
    } else if (domain === "shitei") {
      table = "shitei_items"; urlField = "detail_url"; slugField = "slug"; nameField = "title"; entityType = "shitei_item";
    } else if (domain === "sanpai") {
      table = "sanpai_items"; urlField = "source_url"; slugField = "slug"; nameField = "company_name"; entityType = "sanpai_item";
    } else continue;

    // 対象条件: URL有り + 前回AI未実行（同じentity_idのai_extractionが無い）
    const items = db.prepare(`
      SELECT t.id, t.${slugField} as slug, t.${urlField} as url, t.${nameField} as name
      FROM ${table} t
      WHERE t.${urlField} IS NOT NULL AND t.${urlField} != ''
        AND NOT EXISTS (SELECT 1 FROM ai_extractions ae WHERE ae.entity_id = t.id AND ae.domain_id = '${domain}')
      ORDER BY t.id DESC
      LIMIT ?
    `).all(Math.ceil(limit / domains.length));

    items.forEach(item => {
      if (item.url) targets.push({ domain, entityType, entityId: item.id, slug: item.slug, url: item.url, name: item.name });
    });
  }

  return targets.slice(0, limit);
}

/**
 * review 優先順位を付与
 */
function assignReviewPriorities(db) {
  const extractions = db.prepare("SELECT * FROM ai_extractions WHERE applied_at IS NULL").all();
  let p1 = 0, p2 = 0, p3 = 0, p4 = 0;

  for (const ext of extractions) {
    const missingCount = JSON.parse(ext.missing_fields || "[]").length;
    if (ext.quality_level === "raw" || ext.confidence_score < 0.3) p4++;
    else if (ext.confidence_score >= 0.6 && missingCount <= 2) p1++;
    else if (ext.confidence_score >= 0.5) p2++;
    else p3++;
  }

  return { p1, p2, p3, p4 };
}

function showQuickStats(db) {
  const totalExtractions = db.prepare("SELECT COUNT(*) as c FROM ai_extractions").get().c;
  const applied = db.prepare("SELECT COUNT(*) as c FROM ai_extractions WHERE applied_at IS NOT NULL").get().c;
  const reviewPending = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL").get().c;
  const unreadNotifs = db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
  console.log(`\n累計: AI抽出${totalExtractions}件(反映${applied}), review待ち${reviewPending}件, 未読通知${unreadNotifs}件`);
}

async function showDailyStatus(db) {
  console.log("\n=== 日次運用ステータス ===\n");

  // 同期状態
  const recentRuns = db.prepare("SELECT domain_id, MAX(started_at) as last_run, SUM(created_count) as total_created, SUM(updated_count) as total_updated FROM sync_runs GROUP BY domain_id").all();
  console.log("同期状態:");
  recentRuns.forEach(r => console.log(`  ${r.domain_id}: 最終=${r.last_run?.substring(0, 19)} 累計新規=${r.total_created} 更新=${r.total_updated}`));

  // AI抽出状態
  const aiStats = db.prepare("SELECT domain_id, COUNT(*) as total, AVG(confidence_score) as avg_conf, SUM(CASE WHEN applied_at IS NOT NULL THEN 1 ELSE 0 END) as applied FROM ai_extractions GROUP BY domain_id").all();
  console.log("\nAI抽出状態:");
  aiStats.forEach(a => console.log(`  ${a.domain_id}: ${a.total}件 (反映${a.applied}, avg conf=${a.avg_conf?.toFixed(2)})`));

  // review優先順位
  const priorities = assignReviewPriorities(db);
  console.log(`\nreview優先順位: P1=${priorities.p1} P2=${priorities.p2} P3=${priorities.p3} P4=${priorities.p4}`);

  // LLM設定
  console.log(`\nLLM: ${process.env.LLM_ENABLED === "true" ? "有効" : "無効"} | Slack: ${process.env.SLACK_WEBHOOK_URL ? "有効" : "無効"}`);

  // 対象候補数
  for (const domain of ["food-recall", "shitei", "sanpai"]) {
    let table, urlField;
    if (domain === "food-recall") { table = "food_recall_items"; urlField = "source_url"; }
    else if (domain === "shitei") { table = "shitei_items"; urlField = "detail_url"; }
    else { table = "sanpai_items"; urlField = "source_url"; }
    const pending = db.prepare(`SELECT COUNT(*) as c FROM ${table} t WHERE t.${urlField} IS NOT NULL AND t.${urlField} != '' AND NOT EXISTS (SELECT 1 FROM ai_extractions ae WHERE ae.entity_id = t.id AND ae.domain_id = '${domain}')`).get().c;
    console.log(`  ${domain} AI未実行: ${pending}件`);
  }
}

main().catch((err) => { console.error(`[daily-ops] Fatal: ${err.message}`); process.exit(1); });
