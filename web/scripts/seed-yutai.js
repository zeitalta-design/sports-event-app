#!/usr/bin/env node

/**
 * 株主優待ナビ seed — 仮データを yutai_items テーブルに投入
 *
 * Usage:
 *   node scripts/seed-yutai.js
 *   node scripts/seed-yutai.js --clear  (テーブルをクリアしてから投入)
 */

const path = require("path");

// ESM の yutai-config を直接読めないため、データをここに定義
const SEED = [
  {
    code: "2702", slug: "2702-mcdonalds", title: "日本マクドナルドHD",
    category: "food", confirm_months: "[6,12]", min_investment: 67300,
    benefit_summary: "食事優待券（バーガー類・サイドメニュー・飲物の引換券6枚綴り）",
    dividend_yield: 0.74, benefit_yield: null,
  },
  {
    code: "8267", slug: "8267-aeon", title: "イオン",
    category: "shopping", confirm_months: "[2,8]", min_investment: 37600,
    benefit_summary: "オーナーズカード（買物金額のキャッシュバック3〜7%）",
    dividend_yield: 0.96, benefit_yield: null,
  },
  {
    code: "9202", slug: "9202-ana", title: "ANAホールディングス",
    category: "leisure", confirm_months: "[3,9]", min_investment: 29700,
    benefit_summary: "国内線片道1区間50%割引券",
    dividend_yield: 1.18, benefit_yield: null,
  },
  {
    code: "7412", slug: "7412-aoki", title: "アオキホールディングス",
    category: "shopping", confirm_months: "[3,9]", min_investment: 83200,
    benefit_summary: "AOKI 20%割引券5枚",
    dividend_yield: 2.16, benefit_yield: null,
  },
  {
    code: "3197", slug: "3197-skylark", title: "すかいらーくHD",
    category: "food", confirm_months: "[6,12]", min_investment: 21800,
    benefit_summary: "株主優待カード（年間4,000円分の食事券）",
    dividend_yield: 0.28, benefit_yield: 1.83,
  },
  {
    code: "9861", slug: "9861-yoshinoya", title: "吉野家ホールディングス",
    category: "food", confirm_months: "[2,8]", min_investment: 30100,
    benefit_summary: "食事券（年間4,000円分: 500円券×8枚）",
    dividend_yield: 0.5, benefit_yield: 1.33,
  },
  {
    code: "4661", slug: "4661-olc", title: "オリエンタルランド",
    category: "leisure", confirm_months: "[3,9]", min_investment: 353500,
    benefit_summary: "東京ディズニーリゾート1デーパスポート",
    dividend_yield: 0.15, benefit_yield: null,
  },
  {
    code: "8591", slug: "8591-orix", title: "オリックス",
    category: "other", confirm_months: "[3,9]", min_investment: 33600,
    benefit_summary: "カタログギフト（Bコース: ふるさと優待）",
    dividend_yield: 2.83, benefit_yield: null,
  },
];

async function main() {
  // Dynamic import for ESM db module
  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  const doClear = process.argv.includes("--clear");

  if (doClear) {
    db.prepare("DELETE FROM yutai_items").run();
    console.log("🗑️  yutai_items cleared");
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO yutai_items
      (code, slug, title, category, confirm_months, min_investment, benefit_summary, dividend_yield, benefit_yield, is_published, created_at, updated_at)
    VALUES
      (@code, @slug, @title, @category, @confirm_months, @min_investment, @benefit_summary, @dividend_yield, @benefit_yield, 1, datetime('now'), datetime('now'))
  `);

  let inserted = 0;
  let skipped = 0;
  for (const row of SEED) {
    const result = insert.run(row);
    if (result.changes > 0) {
      inserted++;
      console.log(`  ✅ ${row.code} ${row.title}`);
    } else {
      skipped++;
      console.log(`  ⏭️  ${row.code} ${row.title} (already exists)`);
    }
  }

  console.log(`\n✅ Done! Inserted: ${inserted}, Skipped: ${skipped}`);

  const count = db.prepare("SELECT COUNT(*) as c FROM yutai_items").get();
  console.log(`📊 Total yutai_items: ${count.c}`);
}

main().catch(console.error);
