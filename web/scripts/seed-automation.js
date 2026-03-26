#!/usr/bin/env node
/**
 * 自動化共通基盤 seed — data_sources に初期ソースを投入 + 擬似同期テスト
 * Usage: node scripts/seed-automation.js [--clear] [--test-sync]
 *
 * --test-sync は DB直接操作で同期フローを擬似実行する（@/ alias 不要）
 */

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM admin_notifications").run();
    db.prepare("DELETE FROM change_logs").run();
    db.prepare("DELETE FROM sync_runs").run();
    db.prepare("DELETE FROM data_sources").run();
    console.log("automation tables cleared");
  }

  // ─── data_sources 投入 ─────────────────────

  const SOURCES = [
    { domain_id: "food-recall", source_name: "消費者庁リコール情報", source_type: "web", source_url: "https://www.recall.caa.go.jp/", fetch_method: "scraper", status: "active", review_policy: "review_required", publish_policy: "manual", run_frequency: "daily", notes: "消費者庁の食品リコール公表ページ" },
    { domain_id: "food-recall", source_name: "厚生労働省食品安全", source_type: "web", source_url: "https://www.mhlw.go.jp/", fetch_method: "manual", status: "active", review_policy: "review_required", publish_policy: "manual", run_frequency: "weekly", notes: "厚生労働省の食品安全情報" },
    { domain_id: "sanpai", source_name: "さんぱいくん（環境省）", source_type: "web", source_url: "https://www.sanpainet.or.jp/", fetch_method: "manual", status: "active", review_policy: "review_required", publish_policy: "manual", run_frequency: "weekly", notes: "環境省運営の産廃情報ネット" },
    { domain_id: "kyoninka", source_name: "国土交通省建設業者検索", source_type: "web", source_url: "https://etsuran.mlit.go.jp/", fetch_method: "manual", status: "active", review_policy: "review_required", publish_policy: "manual", run_frequency: "weekly", notes: "建設業許可業者の検索システム" },
    { domain_id: "kyoninka", source_name: "宅建業者等企業情報", source_type: "web", source_url: "https://etsuran.mlit.go.jp/TAKKEN/", fetch_method: "manual", status: "active", review_policy: "review_required", publish_policy: "auto_publish", run_frequency: "weekly", notes: "宅建業者の登録情報検索" },
    { domain_id: "shitei", source_name: "横浜市公募情報", source_type: "web", source_url: "https://www.city.yokohama.lg.jp/", fetch_method: "manual", status: "active", review_policy: "review_required", publish_policy: "manual", run_frequency: "daily", notes: "横浜市の指定管理者公募ページ" },
    { domain_id: "shitei", source_name: "大阪市指定管理者", source_type: "web", source_url: "https://www.city.osaka.lg.jp/", fetch_method: "manual", status: "active", review_policy: "review_required", publish_policy: "manual", run_frequency: "daily", notes: "大阪市の指定管理者公募情報" },
  ];

  let sourcesInserted = 0;
  for (const s of SOURCES) {
    const existing = db.prepare("SELECT id FROM data_sources WHERE domain_id = ? AND source_name = ?").get(s.domain_id, s.source_name);
    if (!existing) {
      db.prepare(`
        INSERT INTO data_sources (domain_id, source_name, source_type, source_url, fetch_method, status, review_policy, publish_policy, run_frequency, notes, created_at, updated_at)
        VALUES (@domain_id, @source_name, @source_type, @source_url, @fetch_method, @status, @review_policy, @publish_policy, @run_frequency, @notes, datetime('now'), datetime('now'))
      `).run(s);
      sourcesInserted++;
    }
  }
  console.log(`data_sources: ${sourcesInserted}/${SOURCES.length} inserted`);

  // ─── テスト同期実行（DB 直接操作） ─────────────────────

  if (process.argv.includes("--test-sync")) {
    console.log("\n=== テスト同期実行（food-recall） ===");

    const frSource = db.prepare("SELECT id FROM data_sources WHERE domain_id = 'food-recall' LIMIT 1").get();
    const frSourceId = frSource?.id || null;

    // sync_run 開始
    const frRunResult = db.prepare(`
      INSERT INTO sync_runs (domain_id, source_id, run_type, run_status, started_at, created_at)
      VALUES ('food-recall', @sourceId, 'manual', 'running', datetime('now'), datetime('now'))
    `).run({ sourceId: frSourceId });
    const frRunId = frRunResult.lastInsertRowid;
    console.log(`  sync_run #${frRunId} started`);

    // food-recall の既存データで差分テスト
    const frItems = db.prepare("SELECT * FROM food_recall_items LIMIT 3").all();
    let frCreated = 0, frUpdated = 0, frUnchanged = 0, frReview = 0;

    if (frItems.length >= 2) {
      // 1件目: unchanged
      console.log(`  [1] UNCHANGED: ${frItems[0].slug}`);
      frUnchanged++;

      // 2件目: status 変更をシミュレート
      const oldStatus = frItems[1].status;
      const newStatus = oldStatus === "active" ? "completed" : "active";
      db.prepare("UPDATE food_recall_items SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, frItems[1].id);
      db.prepare(`
        INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, field_name, before_value, after_value, requires_review, created_at)
        VALUES ('food-recall', @runId, @sourceId, 'food_recall_item', @entityId, @slug, 'updated', 'status', @before, @after, 1, datetime('now'))
      `).run({ runId: frRunId, sourceId: frSourceId, entityId: frItems[1].id, slug: frItems[1].slug, before: oldStatus, after: newStatus });
      console.log(`  [2] UPDATE: ${frItems[1].slug} (status: ${oldStatus} → ${newStatus})`);
      frUpdated++;
      frReview++;

      // 3件目: 新規アイテム
      const newSlug = "test-sync-food-recall-new-" + Date.now();
      const newResult = db.prepare(`
        INSERT OR IGNORE INTO food_recall_items (slug, product_name, manufacturer, category, recall_type, reason, risk_level, recall_date, status, summary, is_published, created_at, updated_at)
        VALUES (@slug, 'テスト同期用商品', 'テストメーカー株式会社', 'other', 'voluntary', 'quality', 'class3', '2026-03-26', 'active', 'テスト同期で自動追加された仮データ', 1, datetime('now'), datetime('now'))
      `).run({ slug: newSlug });
      if (newResult.changes > 0) {
        db.prepare(`
          INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, requires_review, created_at)
          VALUES ('food-recall', @runId, @sourceId, 'food_recall_item', @entityId, @slug, 'created', 1, datetime('now'))
        `).run({ runId: frRunId, sourceId: frSourceId, entityId: newResult.lastInsertRowid, slug: newSlug });
        console.log(`  [3] CREATE: ${newSlug}`);
        frCreated++;
        frReview++;
      }
    }

    // sync_run 完了
    db.prepare(`
      UPDATE sync_runs SET run_status = 'completed', fetched_count = @fetched, created_count = @created, updated_count = @updated, unchanged_count = @unchanged, review_count = @review, finished_at = datetime('now')
      WHERE id = @runId
    `).run({ runId: frRunId, fetched: frItems.length, created: frCreated, updated: frUpdated, unchanged: frUnchanged, review: frReview });

    // 通知作成
    db.prepare(`
      INSERT INTO admin_notifications (domain_id, notification_type, title, message, related_entity_type, related_entity_id, created_at)
      VALUES ('food-recall', 'warning', '[food-recall] 同期完了: 新規${frCreated}件, 更新${frUpdated}件, 要確認${frReview}件', 'Run #${frRunId}', 'sync_run', @runId, datetime('now'))
    `).run({ runId: frRunId });

    console.log(`  food-recall sync: created=${frCreated} updated=${frUpdated} unchanged=${frUnchanged} review=${frReview}`);

    // ─── shitei テスト ─────────────────────

    console.log("\n=== テスト同期実行（shitei） ===");

    const shSource = db.prepare("SELECT id FROM data_sources WHERE domain_id = 'shitei' LIMIT 1").get();
    const shSourceId = shSource?.id || null;

    const shRunResult = db.prepare(`
      INSERT INTO sync_runs (domain_id, source_id, run_type, run_status, started_at, created_at)
      VALUES ('shitei', @sourceId, 'manual', 'running', datetime('now'), datetime('now'))
    `).run({ sourceId: shSourceId });
    const shRunId = shRunResult.lastInsertRowid;

    const shItems = db.prepare("SELECT * FROM shitei_items LIMIT 2").all();
    let shCreated = 0, shUpdated = 0, shUnchanged = 0, shReview = 0;

    if (shItems.length >= 2) {
      // 1件目: unchanged
      console.log(`  [1] UNCHANGED: ${shItems[0].slug}`);
      shUnchanged++;

      // 2件目: 締切変更
      const oldDeadline = shItems[1].application_deadline;
      const newDeadline = "2026-06-30";
      db.prepare("UPDATE shitei_items SET application_deadline = ?, updated_at = datetime('now') WHERE id = ?").run(newDeadline, shItems[1].id);
      db.prepare(`
        INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, field_name, before_value, after_value, requires_review, created_at)
        VALUES ('shitei', @runId, @sourceId, 'shitei_item', @entityId, @slug, 'updated', 'application_deadline', @before, @after, 1, datetime('now'))
      `).run({ runId: shRunId, sourceId: shSourceId, entityId: shItems[1].id, slug: shItems[1].slug, before: oldDeadline, after: newDeadline });
      console.log(`  [2] UPDATE: ${shItems[1].slug} (deadline: ${oldDeadline} → ${newDeadline})`);
      shUpdated++;
      shReview++;
    }

    db.prepare(`
      UPDATE sync_runs SET run_status = 'completed', fetched_count = @fetched, created_count = @created, updated_count = @updated, unchanged_count = @unchanged, review_count = @review, finished_at = datetime('now')
      WHERE id = @runId
    `).run({ runId: shRunId, fetched: shItems.length, created: shCreated, updated: shUpdated, unchanged: shUnchanged, review: shReview });

    db.prepare(`
      INSERT INTO admin_notifications (domain_id, notification_type, title, message, related_entity_type, related_entity_id, created_at)
      VALUES ('shitei', 'info', '[shitei] 同期完了: 更新${shUpdated}件, 要確認${shReview}件', 'Run #${shRunId}', 'sync_run', @runId, datetime('now'))
    `).run({ runId: shRunId });

    console.log(`  shitei sync: created=${shCreated} updated=${shUpdated} unchanged=${shUnchanged} review=${shReview}`);

    // ─── 結果サマリー ─────────────────────

    const syncRuns = db.prepare("SELECT COUNT(*) as c FROM sync_runs").get().c;
    const changeLogs = db.prepare("SELECT COUNT(*) as c FROM change_logs").get().c;
    const notifications = db.prepare("SELECT COUNT(*) as c FROM admin_notifications").get().c;
    const reviewPending = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL").get().c;
    console.log(`\n=== 結果サマリー ===`);
    console.log(`data_sources: ${db.prepare("SELECT COUNT(*) as c FROM data_sources").get().c}件`);
    console.log(`sync_runs: ${syncRuns}件`);
    console.log(`change_logs: ${changeLogs}件`);
    console.log(`admin_notifications: ${notifications}件`);
    console.log(`review待ち: ${reviewPending}件`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
