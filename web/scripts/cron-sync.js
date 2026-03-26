#!/usr/bin/env node
/**
 * 自動同期 cron エントリポイント
 *
 * Usage:
 *   node scripts/cron-sync.js                      # 全ドメイン (active source のみ)
 *   node scripts/cron-sync.js --domain food-recall  # 特定ドメインのみ
 *   node scripts/cron-sync.js --domain shitei       # shitei のみ
 *   node scripts/cron-sync.js --source-id 1         # 特定ソースのみ
 *   node scripts/cron-sync.js --dry-run             # dry run
 *   node scripts/cron-sync.js --status              # 設定確認のみ
 *
 * cron 設定例:
 *   # 日次 (毎朝 7:00)
 *   0 7 * * * cd /path/to/web && node scripts/cron-sync.js >> logs/sync.log 2>&1
 *
 *   # food-recall のみ日次
 *   0 7 * * * cd /path/to/web && node scripts/cron-sync.js --domain food-recall
 *
 *   # shitei のみ平日朝
 *   0 8 * * 1-5 cd /path/to/web && node scripts/cron-sync.js --domain shitei
 *
 * 環境変数:
 *   SLACK_WEBHOOK_URL        — Slack通知 (省略可)
 *   NOTIFICATION_EMAIL_TO    — メール通知先 (省略可)
 *   SMTP_HOST/PORT/USER/PASS — SMTP設定 (省略可)
 */

async function main() {
  const args = process.argv.slice(2);
  const domainFilter = args.includes("--domain") ? args[args.indexOf("--domain") + 1] : null;
  const sourceIdFilter = args.includes("--source-id") ? parseInt(args[args.indexOf("--source-id") + 1]) : null;
  const dryRun = args.includes("--dry-run");
  const statusOnly = args.includes("--status");

  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[cron-sync] ${timestamp} — 自動同期開始`);
  console.log(`${"=".repeat(60)}`);

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  // 通知設定の確認
  const { getNotificationConfig } = await import("../lib/core/automation/notifier.js");
  const notifConfig = getNotificationConfig();
  console.log(`\n通知設定:`);
  console.log(`  Slack: ${notifConfig.slack.enabled ? "有効" : "無効"}`);
  console.log(`  Email: ${notifConfig.email.enabled ? `有効 (${notifConfig.email.to})` : "無効"}`);
  console.log(`  Admin: 有効`);

  if (statusOnly) {
    // ソース一覧と最終実行を表示して終了
    const sources = db.prepare("SELECT * FROM data_sources ORDER BY domain_id, id").all();
    console.log(`\nデータソース一覧 (${sources.length}件):`);
    for (const s of sources) {
      console.log(`  [${s.id}] ${s.domain_id} / ${s.source_name} — ${s.status} (${s.fetch_method}) last: ${s.last_success_at || "never"}`);
    }
    const recentRuns = db.prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 5").all();
    console.log(`\n最近の同期実行 (${recentRuns.length}件):`);
    for (const r of recentRuns) {
      console.log(`  [#${r.id}] ${r.domain_id} — ${r.run_status} (${r.fetched_count}取得, ${r.created_count}新規, ${r.updated_count}更新, ${r.review_count}確認)`);
    }
    return;
  }

  // 対象ソースを取得
  let sources;
  if (sourceIdFilter) {
    sources = db.prepare("SELECT * FROM data_sources WHERE id = ? AND status = 'active'").all(sourceIdFilter);
  } else if (domainFilter) {
    sources = db.prepare("SELECT * FROM data_sources WHERE domain_id = ? AND status = 'active' ORDER BY id").all(domainFilter);
  } else {
    sources = db.prepare("SELECT * FROM data_sources WHERE status = 'active' ORDER BY domain_id, id").all();
  }

  if (sources.length === 0) {
    console.log("\n対象ソースがありません（active なソースが見つかりません）");
    return;
  }

  console.log(`\n対象ソース: ${sources.length}件`);
  sources.forEach((s) => console.log(`  [${s.id}] ${s.domain_id} / ${s.source_name}`));
  console.log("");

  // ドメインごとにグループ化して実行
  const domainGroups = {};
  for (const s of sources) {
    if (!domainGroups[s.domain_id]) domainGroups[s.domain_id] = [];
    domainGroups[s.domain_id].push(s);
  }

  const results = [];

  for (const [domainId, domainSources] of Object.entries(domainGroups)) {
    console.log(`\n--- ${domainId} ---`);

    try {
      const result = await runDomainSync(db, domainId, domainSources, { dryRun });
      results.push(result);
    } catch (err) {
      console.error(`  [ERROR] ${domainId}: ${err.message}`);
      results.push({ domainId, error: err.message, created: 0, updated: 0, failed: 1 });
    }
  }

  // 結果サマリー
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[cron-sync] 完了 (${elapsed}秒)`);
  console.log(`${"=".repeat(60)}`);
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.domainId}: ERROR — ${r.error}`);
    } else {
      console.log(`  ${r.domainId}: 取得${r.fetched} 新規${r.created} 更新${r.updated} 不変${r.unchanged} 確認${r.review} 失敗${r.failed}`);
    }
  }

  // 累計統計
  const totalReview = db.prepare("SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL").get().c;
  const unreadNotifs = db.prepare("SELECT COUNT(*) as c FROM admin_notifications WHERE read_at IS NULL").get().c;
  console.log(`\n累計: review待ち ${totalReview}件, 未読通知 ${unreadNotifs}件`);
}

/**
 * ドメイン単位で同期を実行
 */
async function runDomainSync(db, domainId, sources, { dryRun = false } = {}) {
  const { sendSyncNotification } = await import("../lib/core/automation/notifier.js");

  let rawItems = [];
  let sourceErrors = [];
  const primarySource = sources[0];

  // ─── ソースからデータ取得 ─────────────────────

  if (domainId === "food-recall") {
    const { fetchFoodRecallFromCaa, getSampleFoodRecallItems } = await import("../lib/core/automation/sources/food-recall-caa.js");
    console.log(`  取得中: ${primarySource.source_name}...`);
    const result = await fetchFoodRecallFromCaa();
    if (result.items.length > 0) {
      rawItems = result.items;
      console.log(`  実データ取得: ${rawItems.length}件`);
    } else {
      sourceErrors = result.errors;
      console.log(`  実データ取得失敗: ${result.errors.join(", ")}`);
      console.log(`  フォールバック: サンプルデータ`);
      rawItems = getSampleFoodRecallItems();
    }
  } else if (domainId === "shitei") {
    const { fetchShiteiFromMunicipalities, getSampleShiteiItems } = await import("../lib/core/automation/sources/shitei-municipalities.js");
    console.log(`  取得中: 自治体公募情報...`);
    const result = await fetchShiteiFromMunicipalities();
    if (result.items.length > 0) {
      rawItems = result.items;
      result.sources.forEach((s) => console.log(`    - ${s.name}: ${s.count}件`));
    } else {
      sourceErrors = result.errors;
      console.log(`  実データ取得失敗: ${result.errors.join(", ")}`);
      console.log(`  フォールバック: サンプルデータ`);
      rawItems = getSampleShiteiItems();
    }
    sourceErrors = [...sourceErrors, ...result.errors];
  } else if (domainId === "kyoninka") {
    const { fetchKyoninkaFromMlit, getSampleKyoninkaItems } = await import("../lib/core/automation/sources/kyoninka-mlit.js");
    console.log(`  取得中: 国交省系許認可情報...`);
    const result = await fetchKyoninkaFromMlit();
    if (result.items.length > 0) {
      rawItems = result.items;
      result.sources.forEach((s) => console.log(`    - ${s.name}: 事業者${s.itemCount}件, 登録${s.regCount}件`));
      rawItems._registrations = result.registrations;
    } else {
      sourceErrors = result.errors;
      console.log(`  実データ取得失敗: ${result.errors.join(", ")}`);
      console.log(`  フォールバック: サンプルデータ`);
      rawItems = getSampleKyoninkaItems();
    }
    sourceErrors = [...sourceErrors, ...result.errors];
  } else if (domainId === "sanpai") {
    const { fetchSanpaiFromEnvSources, getSampleSanpaiItems } = await import("../lib/core/automation/sources/sanpai-env.js");
    console.log(`  取得中: 環境省系産廃情報...`);
    const result = await fetchSanpaiFromEnvSources();
    if (result.items.length > 0) {
      rawItems = result.items;
      result.sources.forEach((s) => console.log(`    - ${s.name}: 事業者${s.itemCount}件, 処分${s.penaltyCount}件`));
      // penalties を raw items に紐づけ
      rawItems._penalties = result.penalties;
    } else {
      sourceErrors = result.errors;
      console.log(`  実データ取得失敗: ${result.errors.join(", ")}`);
      console.log(`  フォールバック: サンプルデータ`);
      const sampleItems = getSampleSanpaiItems();
      rawItems = sampleItems;
      // サンプルデータには _penalties が含まれる
    }
    sourceErrors = [...sourceErrors, ...result.errors];
  } else {
    console.log(`  [SKIP] ${domainId} — Source Adapter未実装`);
    return { domainId, fetched: 0, created: 0, updated: 0, unchanged: 0, review: 0, failed: 0 };
  }

  if (rawItems.length === 0) {
    console.log(`  取得0件 — スキップ`);
    return { domainId, fetched: 0, created: 0, updated: 0, unchanged: 0, review: 0, failed: 0 };
  }

  // ─── 同期処理（DB直接操作） ─────────────────────

  const runResult = db.prepare(`
    INSERT INTO sync_runs (domain_id, source_id, run_type, run_status, started_at, created_at)
    VALUES (@domainId, @sourceId, 'scheduled', 'running', datetime('now'), datetime('now'))
  `).run({ domainId, sourceId: primarySource.id });
  const runId = runResult.lastInsertRowid;

  const tableMap = { "food-recall": "food_recall_items", "shitei": "shitei_items", "sanpai": "sanpai_items", "kyoninka": "kyoninka_entities" };
  const table = tableMap[domainId] || `${domainId}_items`;
  const entityType = table.replace("_items", "_item").replace("_entities", "_entity");

  const { toSlug: frToSlug } = await import("../lib/importers/food-recall.js");
  const { toSlug: shToSlug } = await import("../lib/importers/shitei.js");
  const { toSlug: spToSlug } = await import("../lib/importers/sanpai.js");
  const { toSlug: kyToSlug } = await import("../lib/importers/kyoninka.js");

  const trackedFieldsMap = {
    "food-recall": ["product_name", "manufacturer", "category", "status", "risk_level", "reason", "recall_date"],
    "shitei": ["title", "municipality_name", "recruitment_status", "application_deadline", "facility_category"],
    "sanpai": ["company_name", "prefecture", "city", "license_type", "status", "risk_level"],
    "kyoninka": ["entity_name", "prefecture", "city", "entity_status", "primary_license_family"],
  };
  const trackedFields = trackedFieldsMap[domainId] || [];

  let created = 0, updated = 0, unchanged = 0, review = 0, failed = 0;

  for (let i = 0; i < rawItems.length; i++) {
    try {
      const raw = rawItems[i];
      let slug;
      if (domainId === "food-recall") {
        slug = raw.slug || frToSlug(raw.product_name, raw.manufacturer);
      } else if (domainId === "sanpai") {
        slug = raw.slug || spToSlug(raw.company_name, raw.prefecture);
      } else if (domainId === "kyoninka") {
        slug = raw.slug || kyToSlug(raw.entity_name, raw.prefecture);
      } else {
        slug = raw.slug || shToSlug(raw.title, raw.municipality_name);
      }
      if (!slug) { failed++; continue; }

      const existing = db.prepare(`SELECT * FROM ${table} WHERE slug = ?`).get(slug);

      if (existing) {
        const changes = [];
        for (const field of trackedFields) {
          const bVal = existing[field] ?? "";
          const aVal = raw[field] ?? "";
          if (String(bVal) !== String(aVal) && String(aVal) !== "") {
            changes.push({ field, before: String(bVal) || null, after: String(aVal) || null });
          }
        }
        if (changes.length === 0) { unchanged++; continue; }

        if (!dryRun) {
          for (const change of changes) {
            try { db.prepare(`UPDATE ${table} SET ${change.field} = ?, updated_at = datetime('now') WHERE id = ?`).run(change.after, existing.id); } catch { }
            db.prepare(`INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, field_name, before_value, after_value, requires_review, created_at) VALUES (@d, @r, @s, @et, @eid, @sl, 'updated', @f, @b, @a, 1, datetime('now'))`).run({ d: domainId, r: runId, s: primarySource.id, et: entityType, eid: existing.id, sl: slug, f: change.field, b: change.before, a: change.after });
          }
        }
        updated++; review++;
      } else {
        if (!dryRun) {
          let insertResult;
          if (domainId === "food-recall") {
            insertResult = db.prepare(`INSERT OR IGNORE INTO food_recall_items (slug, product_name, manufacturer, category, recall_type, reason, risk_level, affected_area, recall_date, status, consumer_action, summary, source_url, is_published, created_at, updated_at) VALUES (@slug, @pn, @mf, @cat, @rt, @rs, @rl, @aa, @rd, @st, @ca, @sm, @su, 1, datetime('now'), datetime('now'))`).run({ slug, pn: raw.product_name || "不明", mf: raw.manufacturer || null, cat: raw.category || "other", rt: raw.recall_type || "voluntary", rs: raw.reason || "other", rl: raw.risk_level || "unknown", aa: raw.affected_area || null, rd: raw.recall_date || null, st: raw.status || "active", ca: raw.consumer_action || null, sm: raw.summary || null, su: raw.source_url || null });
          } else if (domainId === "kyoninka") {
            const { normalizeEntityName } = await import("../lib/kyoninka-config.js");
            insertResult = db.prepare(`INSERT OR IGNORE INTO kyoninka_entities (slug, entity_name, normalized_name, corporate_number, prefecture, city, address, entity_status, primary_license_family, registration_count, source_name, source_url, notes, is_published, created_at, updated_at) VALUES (@slug, @en, @nn, @corp, @pref, @city, @addr, @es, @plf, 0, @sn, @su, @notes, 1, datetime('now'), datetime('now'))`).run({ slug, en: raw.entity_name || "不明", nn: raw.normalized_name || normalizeEntityName(raw.entity_name), corp: raw.corporate_number || null, pref: raw.prefecture || null, city: raw.city || null, addr: raw.address || null, es: raw.entity_status || "active", plf: raw.primary_license_family || "other", sn: raw.source_name || null, su: raw.source_url || null, notes: raw.notes || null });

            // registrations を挿入
            if (insertResult?.changes > 0 && raw._registrations) {
              const entityId = insertResult.lastInsertRowid;
              let regCount = 0;
              for (const r of raw._registrations) {
                db.prepare(`INSERT INTO kyoninka_registrations (entity_id, license_family, license_type, registration_number, authority_name, prefecture, valid_from, valid_to, registration_status, disciplinary_flag, source_name, source_url, detail_url, created_at, updated_at) VALUES (@eid, @lf, @lt, @rn, @an, @pref, @vf, @vt, @rs, @df, @sn, @su, @du, datetime('now'), datetime('now'))`).run({ eid: entityId, lf: r.license_family || "other", lt: r.license_type || null, rn: r.registration_number || null, an: r.authority_name || null, pref: r.prefecture || null, vf: r.valid_from || null, vt: r.valid_to || null, rs: r.registration_status || "active", df: r.disciplinary_flag || 0, sn: r.source_name || null, su: r.source_url || null, du: r.detail_url || null });
                regCount++;
              }
              if (regCount > 0) {
                // primary_license_family と registration_count を更新
                const famCounts = {};
                raw._registrations.forEach((r) => { famCounts[r.license_family] = (famCounts[r.license_family] || 0) + 1; });
                const primaryFam = Object.entries(famCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
                db.prepare("UPDATE kyoninka_entities SET registration_count = ?, primary_license_family = ?, updated_at = datetime('now') WHERE id = ?").run(regCount, primaryFam, entityId);
              }
            }
          } else if (domainId === "sanpai") {
            insertResult = db.prepare(`INSERT OR IGNORE INTO sanpai_items (slug, company_name, corporate_number, prefecture, city, license_type, waste_category, business_area, status, risk_level, penalty_count, latest_penalty_date, source_name, source_url, detail_url, notes, is_published, created_at, updated_at) VALUES (@slug, @cn, @corp, @pref, @city, @lt, @wc, @ba, @st, @rl, 0, NULL, @sn, @su, @du, @notes, 1, datetime('now'), datetime('now'))`).run({ slug, cn: raw.company_name || "不明", corp: raw.corporate_number || null, pref: raw.prefecture || null, city: raw.city || null, lt: raw.license_type || "other", wc: raw.waste_category || "industrial", ba: raw.business_area || null, st: raw.status || "active", rl: raw.risk_level || "none", sn: raw.source_name || null, su: raw.source_url || null, du: raw.detail_url || null, notes: raw.notes || null });

            // penalties を挿入
            if (insertResult?.changes > 0 && raw._penalties) {
              const itemId = insertResult.lastInsertRowid;
              let penaltyCount = 0;
              let latestDate = null;
              for (const p of raw._penalties) {
                db.prepare(`INSERT INTO sanpai_penalties (sanpai_item_id, penalty_date, penalty_type, authority_name, summary, disposition_period, source_url, created_at, updated_at) VALUES (@itemId, @pd, @pt, @an, @sm, @dp, @su, datetime('now'), datetime('now'))`).run({ itemId, pd: p.penalty_date || null, pt: p.penalty_type || "other", an: p.authority_name || null, sm: p.summary || null, dp: p.disposition_period || null, su: p.source_url || null });
                penaltyCount++;
                if (p.penalty_date && (!latestDate || p.penalty_date > latestDate)) latestDate = p.penalty_date;
              }
              // penalty_count と latest_penalty_date を更新
              if (penaltyCount > 0) {
                db.prepare("UPDATE sanpai_items SET penalty_count = ?, latest_penalty_date = ?, updated_at = datetime('now') WHERE id = ?").run(penaltyCount, latestDate, itemId);
              }
            }
          } else {
            insertResult = db.prepare(`INSERT OR IGNORE INTO shitei_items (slug, title, municipality_name, prefecture, facility_category, facility_name, recruitment_status, application_start_date, application_deadline, opening_date, contract_start_date, contract_end_date, summary, eligibility, application_method, detail_url, source_name, source_url, attachment_count, is_published, created_at, updated_at) VALUES (@slug, @title, @mn, @pref, @fc, @fn, @rs, @asd, @ad, @od, @csd, @ced, @sm, @el, @am, @du, @sn, @su, 0, 1, datetime('now'), datetime('now'))`).run({ slug, title: raw.title || "不明", mn: raw.municipality_name || null, pref: raw.prefecture || null, fc: raw.facility_category || "other", fn: raw.facility_name || null, rs: raw.recruitment_status || "unknown", asd: raw.application_start_date || null, ad: raw.application_deadline || null, od: raw.opening_date || null, csd: raw.contract_start_date || null, ced: raw.contract_end_date || null, sm: raw.summary || null, el: raw.eligibility || null, am: raw.application_method || null, du: raw.detail_url || null, sn: raw.source_name || null, su: raw.source_url || null });
          }
          if (insertResult?.changes > 0) {
            db.prepare(`INSERT INTO change_logs (domain_id, sync_run_id, source_id, entity_type, entity_id, entity_slug, change_type, requires_review, created_at) VALUES (@d, @r, @s, @et, @eid, @sl, 'created', 1, datetime('now'))`).run({ d: domainId, r: runId, s: primarySource.id, et: entityType, eid: insertResult.lastInsertRowid, sl: slug });
          }
        }
        created++; review++;
      }
    } catch (err) { failed++; }
  }

  // sync_run 完了
  const runStatus = failed > 0 && created + updated === 0 ? "failed" : "completed";
  const errorSummary = sourceErrors.length > 0 ? sourceErrors.slice(0, 5).join("\n") : null;
  db.prepare(`UPDATE sync_runs SET run_status = @st, fetched_count = @f, created_count = @c, updated_count = @u, unchanged_count = @uc, review_count = @r, failed_count = @fl, finished_at = datetime('now'), error_summary = @es WHERE id = @id`).run({ id: runId, st: runStatus, f: rawItems.length, c: created, u: updated, uc: unchanged, r: review, fl: failed, es: errorSummary });

  // ソース更新
  db.prepare("UPDATE data_sources SET last_checked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(primarySource.id);
  if (runStatus === "completed") db.prepare("UPDATE data_sources SET last_success_at = datetime('now') WHERE id = ?").run(primarySource.id);

  // 通知送信
  const report = { total: rawItems.length, fetched: rawItems.length, created, updated, unchanged, review, failed, errors: [] };
  await sendSyncNotification({ db, domainId, runId, report, sourceName: primarySource.source_name, sourceErrors });

  console.log(`  結果: 取得${rawItems.length} 新規${created} 更新${updated} 不変${unchanged} 確認${review} 失敗${failed}`);
  return { domainId, fetched: rawItems.length, created, updated, unchanged, review, failed };
}

main().catch((err) => { console.error(`[cron-sync] Fatal: ${err.message}`); process.exit(1); });
