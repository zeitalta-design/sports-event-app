#!/usr/bin/env node
/**
 * shitei 公開判定・review補助スクリプト
 *
 * Usage:
 *   node scripts/review-shitei.js summary          # 概要表示
 *   node scripts/review-shitei.js auto-publish      # 自動公開候補を表示
 *   node scripts/review-shitei.js hold              # 保留候補を表示
 *   node scripts/review-shitei.js publish-ready     # 公開可能な件を is_published=1 に
 *   node scripts/review-shitei.js mark-reviewed     # review済みマーク（change_logs）
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "summary";

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  const allItems = db.prepare("SELECT * FROM shitei_items ORDER BY id DESC").all();
  const reviewLogs = db.prepare("SELECT * FROM change_logs WHERE domain_id = 'shitei' AND requires_review = 1 AND reviewed_at IS NULL").all();

  if (command === "summary") {
    console.log("\n=== shitei 公開判定サマリー ===\n");
    console.log(`総件数: ${allItems.length}`);
    console.log(`公開中 (is_published=1): ${allItems.filter(i => i.is_published).length}`);
    console.log(`非公開 (is_published=0): ${allItems.filter(i => !i.is_published).length}`);
    console.log(`review待ち change_logs: ${reviewLogs.length}`);

    // 募集状態別
    const statusCounts = {};
    allItems.forEach(i => { statusCounts[i.recruitment_status] = (statusCounts[i.recruitment_status] || 0) + 1; });
    console.log(`\n募集状態別:`);
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c}件`));

    // 自治体別
    const munCounts = {};
    allItems.forEach(i => { if (i.municipality_name) munCounts[i.municipality_name] = (munCounts[i.municipality_name] || 0) + 1; });
    console.log(`\n自治体別:`);
    Object.entries(munCounts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => console.log(`  ${m}: ${c}件`));

    // 施設カテゴリ別
    const catCounts = {};
    allItems.forEach(i => { catCounts[i.facility_category] = (catCounts[i.facility_category] || 0) + 1; });
    console.log(`\n施設カテゴリ別:`);
    Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}件`));

    // 公開判定分類
    const { autoPublish, reviewRequired, hold } = classifyItems(allItems);
    console.log(`\n=== 公開判定分類 ===`);
    console.log(`✅ 自動公開候補: ${autoPublish.length}件`);
    console.log(`⚠️ 要確認: ${reviewRequired.length}件`);
    console.log(`❌ 保留: ${hold.length}件`);
    return;
  }

  if (command === "auto-publish") {
    const { autoPublish } = classifyItems(allItems);
    console.log(`\n=== 自動公開候補 (${autoPublish.length}件) ===\n`);
    autoPublish.slice(0, 20).forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.title.substring(0, 60)}`);
      console.log(`     自治体: ${item.municipality_name} | 期限: ${item.application_deadline || "—"} | 状態: ${item.recruitment_status}`);
    });
    if (autoPublish.length > 20) console.log(`  ... 他 ${autoPublish.length - 20}件`);
    return;
  }

  if (command === "hold") {
    const { hold } = classifyItems(allItems);
    console.log(`\n=== 保留候補 (${hold.length}件) ===\n`);
    hold.slice(0, 20).forEach((item, i) => {
      console.log(`  [${i + 1}] ${item.title.substring(0, 60)}`);
      console.log(`     理由: ${item._holdReason}`);
    });
    if (hold.length > 20) console.log(`  ... 他 ${hold.length - 20}件`);
    return;
  }

  if (command === "publish-ready") {
    const { autoPublish } = classifyItems(allItems);
    const unpublished = autoPublish.filter(i => !i.is_published);
    if (unpublished.length === 0) {
      console.log("公開可能な未公開アイテムはありません");
      return;
    }
    console.log(`${unpublished.length}件を公開状態に更新中...`);
    for (const item of unpublished) {
      db.prepare("UPDATE shitei_items SET is_published = 1 WHERE id = ?").run(item.id);
    }
    console.log("完了");
    return;
  }

  if (command === "reclassify-hold") {
    console.log("\n=== 保留案件の AI 再分類 ===\n");
    const holdItems = allItems.filter(i => !i.is_published);
    console.log(`保留案件: ${holdItems.length}件\n`);

    // 施設名を含むタイトルの案件を再評価
    // 大阪市データは施設名のみのリンクが多いが、指定管理に関連する施設名もある
    const facilityKeywords = ["体育館","プール","公園","ホール","図書館","センター","住宅","福祉","保育","介護","美術","博物","駐車","温水","競技","会館","広場","庭園","球場","テニス","武道","アイス","弓道","相撲","陸上"];
    let reclassified = 0;
    for (const item of holdItems) {
      const isFacility = facilityKeywords.some(kw => item.title && item.title.includes(kw));
      if (isFacility && item.municipality_name) {
        // 施設名として妥当 → 指定管理の施設一覧として公開候補に
        db.prepare("UPDATE shitei_items SET recruitment_status = 'unknown', facility_name = ?, is_published = 1 WHERE id = ?").run(item.title, item.id);
        reclassified++;
      }
    }
    console.log(`再分類: ${reclassified}件を公開候補に引き上げ`);
    console.log(`残り保留: ${holdItems.length - reclassified}件`);
    return;
  }

  if (command === "mark-reviewed") {
    if (reviewLogs.length === 0) {
      console.log("review待ちの change_logs はありません");
      return;
    }
    console.log(`${reviewLogs.length}件の change_logs を reviewed に更新中...`);
    for (const log of reviewLogs) {
      db.prepare("UPDATE change_logs SET reviewed_at = datetime('now'), reviewed_by = 'script' WHERE id = ?").run(log.id);
    }
    console.log("完了");
    return;
  }

  console.log("Usage: review-shitei.js [summary|auto-publish|hold|publish-ready|mark-reviewed]");
}

/**
 * 公開判定分類
 */
function classifyItems(items) {
  const autoPublish = [];
  const reviewRequired = [];
  const hold = [];

  for (const item of items) {
    // 保留条件
    if (!item.title || item.title.length < 5) {
      item._holdReason = "タイトルが短すぎる/欠損";
      hold.push(item);
      continue;
    }
    if (!item.municipality_name) {
      item._holdReason = "自治体名欠損";
      hold.push(item);
      continue;
    }
    // 指定管理・公募に無関係そうなものを保留
    if (!item.title.match(/指定管理|公募|募集|委託|選定|管理者|運営/)) {
      item._holdReason = "指定管理・公募に関連しないタイトル";
      hold.push(item);
      continue;
    }

    // 自動公開候補条件
    const hasDeadline = !!item.application_deadline;
    const hasStatus = item.recruitment_status && item.recruitment_status !== "unknown";
    const hasDetailUrl = !!item.detail_url;
    const titleOk = item.title.length >= 10;

    if (titleOk && hasDeadline && hasStatus) {
      autoPublish.push(item);
    } else if (titleOk) {
      reviewRequired.push(item);
    } else {
      item._holdReason = "主要項目不足";
      hold.push(item);
    }
  }

  return { autoPublish, reviewRequired, hold };
}

main().catch((err) => { console.error(err); process.exit(1); });
