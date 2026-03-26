#!/usr/bin/env node
/**
 * 手動同期実行スクリプト
 *
 * Usage:
 *   node scripts/run-sync.js food-recall [--source caa] [--dry-run]
 *   node scripts/run-sync.js shitei [--source yokohama] [--dry-run]
 *   node scripts/run-sync.js food-recall --round 2   # 2回目同期（差分テスト）
 */

async function main() {
  const args = process.argv.slice(2);
  const domainId = args[0];
  if (!domainId) {
    console.log("Usage: node scripts/run-sync.js <domain-id> [--source <name>] [--dry-run] [--round <n>]");
    console.log("  Domains: food-recall, shitei");
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run");
  const sourceArg = args.includes("--source") ? args[args.indexOf("--source") + 1] : null;
  const round = args.includes("--round") ? parseInt(args[args.indexOf("--round") + 1]) : 1;

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  console.log(`\n=== 同期実行: ${domainId} (round ${round}) ${dryRun ? "[DRY RUN]" : ""} ===\n`);

  let rawItems = [];
  let sourceId = null;
  let errors = [];

  // ─── food-recall ─────────────────────
  if (domainId === "food-recall") {
    const { fetchFoodRecallFromCaa, getSampleFoodRecallItems } = await import("../lib/core/automation/sources/food-recall-caa.js");

    console.log("ソース: 消費者庁リコール情報サイト");
    console.log("取得中...");

    // 実ソースへのfetchを試みる
    const result = await fetchFoodRecallFromCaa();

    if (result.items.length > 0) {
      console.log(`実データ取得成功: ${result.items.length}件`);
      rawItems = result.items;
    } else {
      // フォールバック: サンプルデータを使用
      console.log(`実ソースからの取得: ${result.errors.join(", ") || "0件"}`);
      console.log("フォールバック: サンプルデータを使用");
      rawItems = getSampleFoodRecallItems();

      // 2回目のラウンドでは変化をシミュレート
      if (round >= 2) {
        console.log("  → 2回目: 一部データを変更してテスト");
        // 1件目のstatusを変更
        if (rawItems.length > 0) rawItems[0].status = "completed";
        // 新しいアイテムを追加
        rawItems.push({
          product_name: `テスト新規商品 R${round}`,
          manufacturer: "テストメーカー株式会社",
          category: "other",
          recall_type: "voluntary",
          reason: "quality",
          risk_level: "class3",
          recall_date: new Date().toISOString().substring(0, 10),
          status: "active",
          summary: `round ${round} で追加されたテストデータ`,
          source_url: "https://www.recall.caa.go.jp/",
        });
      }
    }
    errors = result.errors;

    // sourceIdを取得
    const src = db.prepare("SELECT id FROM data_sources WHERE domain_id = 'food-recall' AND source_name LIKE '%消費者庁%' LIMIT 1").get();
    sourceId = src?.id || null;
  }

  // ─── shitei ─────────────────────
  else if (domainId === "shitei") {
    const { fetchShiteiFromMunicipalities, getSampleShiteiItems } = await import("../lib/core/automation/sources/shitei-municipalities.js");

    console.log("ソース: 自治体公募情報ページ");
    console.log("取得中...");

    const result = await fetchShiteiFromMunicipalities({
      municipalityIds: sourceArg ? [sourceArg] : [],
    });

    if (result.items.length > 0) {
      console.log(`実データ取得成功: ${result.items.length}件`);
      result.sources.forEach((s) => console.log(`  - ${s.name}: ${s.count}件`));
      rawItems = result.items;
    } else {
      console.log(`実ソースからの取得: ${result.errors.join(", ") || "0件"}`);
      console.log("フォールバック: サンプルデータを使用");
      rawItems = getSampleShiteiItems();

      if (round >= 2) {
        console.log("  → 2回目: 一部データを変更してテスト");
        // 1件目の締切を延長
        if (rawItems.length > 0) rawItems[0].application_deadline = "2026-06-15";
        // 新しいアイテムを追加
        rawItems.push({
          title: `テスト新規公募案件 R${round}`,
          municipality_name: "テスト市",
          prefecture: "東京都",
          facility_category: "community",
          facility_name: "テスト市民センター",
          recruitment_status: "open",
          application_start_date: new Date().toISOString().substring(0, 10),
          application_deadline: "2026-07-31",
          summary: `round ${round} で追加されたテストデータ`,
          source_name: "テスト市",
        });
      }
    }
    errors = result.errors;

    const src = db.prepare("SELECT id FROM data_sources WHERE domain_id = 'shitei' LIMIT 1").get();
    sourceId = src?.id || null;
  }

  else {
    console.log(`未対応のドメイン: ${domainId}`);
    process.exit(1);
  }

  console.log(`\n取得件数: ${rawItems.length}件`);
  if (errors.length > 0) console.log(`エラー: ${errors.join(", ")}`);

  // ─── 同期実行 ─────────────────────
  // DB直接操作方式（@/ alias回避）

  console.log("\n同期処理開始...");

  // sync_run 開始
  const runResult = db.prepare(`
    INSERT INTO sync_runs (domain_id, source_id, run_type, run_status, started_at, created_at)
    VALUES (@domainId, @sourceId, 'manual', 'running', datetime('now'), datetime('now'))
  `).run({ domainId, sourceId });
  const runId = runResult.lastInsertRowid;

  let created = 0, updated = 0, unchanged = 0, review = 0, failed = 0;

  const table = domainId === "food-recall" ? "food_recall_items" : "shitei_items";
  const slugField = "slug";
  const nameField = domainId === "food-recall" ? "product_name" : "title";

  // 正規化 + slug生成
  const { toSlug: frToSlug } = await import("../lib/importers/food-recall.js");
  const { toSlug: shToSlug, normalizeDate } = await import("../lib/importers/shitei.js");

  const trackedFields = domainId === "food-recall"
    ? ["product_name", "manufacturer", "category", "status", "risk_level", "reason", "recall_date"]
    : ["title", "municipality_name", "recruitment_status", "application_deadline", "facility_category"];

  for (let i = 0; i < rawItems.length; i++) {
    try {
      const raw = rawItems[i];

      // slug生成
      let slug;
      if (domainId === "food-recall") {
        slug = raw.slug || frToSlug(raw.product_name, raw.manufacturer);
      } else {
        slug = raw.slug || shToSlug(raw.title, raw.municipality_name);
      }
      if (!slug) { failed++; continue; }

      // 既存チェック
      const existing = db.prepare(`SELECT * FROM ${table} WHERE slug = ?`).get(slug);

      if (existing) {
        // 差分検知
        const changes = [];
        for (const field of trackedFields) {
          const bVal = existing[field] ?? "";
          const aVal = raw[field] ?? "";
          if (String(bVal) !== String(aVal) && String(aVal) !== "") {
            changes.push({ field, before: String(bVal) || null, after: String(aVal) || null });
          }
        }

        if (changes.length === 0) {
          unchanged++;
          if (!dryRun) console.log(`  [${i + 1}] UNCHANGED: ${slug}`);
          continue;
        }

        // 更新
        if (!dryRun) {
          for (const change of changes) {
            // 個別フィールド更新
            try {
              db.prepare(`UPDATE ${table} SET ${change.field} = ?, updated_at = datetime('now') WHERE id = ?`).run(change.after, existing.id);
            } catch { /* skip invalid field */ }

            // change_log 記録
            db.prepare(`
              INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, field_name, before_value, after_value, requires_review, created_at)
              VALUES (@domainId, @runId, @sourceId, @entityType, @entityId, @slug, 'updated', @field, @before, @after, 1, datetime('now'))
            `).run({
              domainId, runId, sourceId,
              entityType: table.replace("_items", "_item").replace("_entities", "_entity"),
              entityId: existing.id, slug,
              field: change.field, before: change.before, after: change.after,
            });
          }
          console.log(`  [${i + 1}] UPDATE: ${slug} (${changes.map((c) => c.field).join(", ")})`);
        }
        updated++;
        review++;
      } else {
        // 新規作成
        if (!dryRun) {
          let insertResult;
          if (domainId === "food-recall") {
            insertResult = db.prepare(`
              INSERT OR IGNORE INTO food_recall_items (slug, product_name, manufacturer, category, recall_type, reason, risk_level, affected_area, recall_date, status, consumer_action, summary, source_url, is_published, created_at, updated_at)
              VALUES (@slug, @product_name, @manufacturer, @category, @recall_type, @reason, @risk_level, @affected_area, @recall_date, @status, @consumer_action, @summary, @source_url, 1, datetime('now'), datetime('now'))
            `).run({
              slug,
              product_name: raw.product_name || "不明",
              manufacturer: raw.manufacturer || null,
              category: raw.category || "other",
              recall_type: raw.recall_type || "voluntary",
              reason: raw.reason || "other",
              risk_level: raw.risk_level || "unknown",
              affected_area: raw.affected_area || null,
              recall_date: raw.recall_date || null,
              status: raw.status || "active",
              consumer_action: raw.consumer_action || null,
              summary: raw.summary || null,
              source_url: raw.source_url || null,
            });
          } else {
            insertResult = db.prepare(`
              INSERT OR IGNORE INTO shitei_items (slug, title, municipality_name, prefecture, facility_category, facility_name, recruitment_status, application_start_date, application_deadline, opening_date, contract_start_date, contract_end_date, summary, eligibility, application_method, detail_url, source_name, source_url, attachment_count, is_published, created_at, updated_at)
              VALUES (@slug, @title, @municipality_name, @prefecture, @facility_category, @facility_name, @recruitment_status, @application_start_date, @application_deadline, @opening_date, @contract_start_date, @contract_end_date, @summary, @eligibility, @application_method, @detail_url, @source_name, @source_url, 0, 1, datetime('now'), datetime('now'))
            `).run({
              slug,
              title: raw.title || "不明",
              municipality_name: raw.municipality_name || null,
              prefecture: raw.prefecture || null,
              facility_category: raw.facility_category || "other",
              facility_name: raw.facility_name || null,
              recruitment_status: raw.recruitment_status || "unknown",
              application_start_date: raw.application_start_date || null,
              application_deadline: raw.application_deadline || null,
              opening_date: raw.opening_date || null,
              contract_start_date: raw.contract_start_date || null,
              contract_end_date: raw.contract_end_date || null,
              summary: raw.summary || null,
              eligibility: raw.eligibility || null,
              application_method: raw.application_method || null,
              detail_url: raw.detail_url || null,
              source_name: raw.source_name || null,
              source_url: raw.source_url || null,
            });
          }

          if (insertResult && insertResult.changes > 0) {
            db.prepare(`
              INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, requires_review, created_at)
              VALUES (@domainId, @runId, @sourceId, @entityType, @entityId, @slug, 'created', 1, datetime('now'))
            `).run({
              domainId, runId, sourceId,
              entityType: table.replace("_items", "_item"),
              entityId: insertResult.lastInsertRowid, slug,
            });
          }
          console.log(`  [${i + 1}] CREATE: ${slug}`);
        }
        created++;
        review++;
      }
    } catch (err) {
      failed++;
      console.log(`  [${i + 1}] ERROR: ${err.message}`);
    }
  }

  // sync_run 完了
  const runStatus = failed > 0 && created + updated === 0 ? "failed" : "completed";
  const errorSummary = errors.length > 0 ? errors.slice(0, 5).join("\n") : null;

  db.prepare(`
    UPDATE sync_runs SET run_status = @status, fetched_count = @fetched, created_count = @created, updated_count = @updated, unchanged_count = @unchanged, review_count = @review, failed_count = @failed, finished_at = datetime('now'), error_summary = @errorSummary
    WHERE id = @runId
  `).run({ runId, status: runStatus, fetched: rawItems.length, created, updated, unchanged, review, failed, errorSummary });

  // 通知作成
  const parts = [];
  if (created > 0) parts.push(`新規${created}件`);
  if (updated > 0) parts.push(`更新${updated}件`);
  if (review > 0) parts.push(`要確認${review}件`);
  if (parts.length > 0 || failed > 0) {
    db.prepare(`
      INSERT INTO admin_notifications (domain_id, notification_type, title, message, related_entity_type, related_entity_id, created_at)
      VALUES (@domainId, @type, @title, @message, 'sync_run', @runId, datetime('now'))
    `).run({
      domainId,
      type: review > 0 ? "warning" : "info",
      title: `[${domainId}] 同期完了 (round ${round}): ${parts.join(", ") || "変更なし"}`,
      message: `Run #${runId} — 取得${rawItems.length}件, ${parts.join(", ")}${failed > 0 ? `, 失敗${failed}件` : ""}`,
      runId,
    });
  }

  // ソースの last_checked_at を更新
  if (sourceId) {
    db.prepare("UPDATE data_sources SET last_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(sourceId);
    if (runStatus === "completed") {
      db.prepare("UPDATE data_sources SET last_success_at = datetime('now') WHERE id = ?").run(sourceId);
    }
  }

  // 結果表示
  console.log(`\n=== 結果 (Run #${runId}) ===`);
  console.log(`状態: ${runStatus}`);
  console.log(`取得: ${rawItems.length}件`);
  console.log(`新規: ${created}件`);
  console.log(`更新: ${updated}件`);
  console.log(`不変: ${unchanged}件`);
  console.log(`要確認: ${review}件`);
  console.log(`失敗: ${failed}件`);

  // DB全体の統計
  const totalSyncRuns = db.prepare("SELECT COUNT(*) as c FROM sync_runs").get().c;
  const totalChangeLogs = db.prepare("SELECT COUNT(*) as c FROM change_logs").get().c;
  const totalReviewPending = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL").get().c;
  const totalNotifications = db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
  console.log(`\n--- 累計 ---`);
  console.log(`sync_runs: ${totalSyncRuns}件`);
  console.log(`change_logs: ${totalChangeLogs}件`);
  console.log(`review待ち: ${totalReviewPending}件`);
  console.log(`未読通知: ${totalNotifications}件`);
}

main().catch((err) => { console.error(err); process.exit(1); });
