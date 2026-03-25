#!/usr/bin/env node
/**
 * 補助金ナビ seed — 仮データを hojokin_items テーブルに投入
 * Usage: node scripts/seed-hojokin.js [--clear]
 */

const SEED = [
  { slug: "it-hojo-2026", title: "IT導入補助金2026", category: "it", target_type: "corp", provider_name: "中小企業庁", max_amount: 4500000, subsidy_rate: "1/2〜2/3", deadline: "2026-06-30", status: "open", summary: "中小企業・小規模事業者がITツールを導入する際の費用を一部補助。会計ソフト、受発注、決済、ECなど幅広いカテゴリが対象。" },
  { slug: "mono-hojo-2026", title: "ものづくり補助金（第20次）", category: "equipment", target_type: "corp", provider_name: "中小企業庁", max_amount: 12500000, subsidy_rate: "1/2〜2/3", deadline: "2026-09-30", status: "open", summary: "革新的な製品・サービスの開発や生産プロセスの改善に必要な設備投資を支援。" },
  { slug: "shokibo-jizoku-2026", title: "小規模事業者持続化補助金", category: "other", target_type: "sole", provider_name: "日本商工会議所", max_amount: 2000000, subsidy_rate: "2/3", deadline: "2026-05-15", status: "open", summary: "小規模事業者の販路開拓や業務効率化の取り組みを支援する補助金。広報費、ウェブサイト関連費、展示会出展費などが対象。" },
  { slug: "jigyo-saikouchiku-2026", title: "事業再構築補助金（第12回）", category: "startup", target_type: "corp", provider_name: "中小企業庁", max_amount: 75000000, subsidy_rate: "1/2〜3/4", deadline: "2026-07-31", status: "open", summary: "新分野展開、事業転換、業種転換、業態転換、事業再編を行う中小企業を支援。" },
  { slug: "career-up-josei", title: "キャリアアップ助成金", category: "employment", target_type: "corp", provider_name: "厚生労働省", max_amount: 800000, subsidy_rate: null, deadline: null, status: "open", summary: "非正規雇用労働者の正社員化、処遇改善の取り組みを行う事業主に対する助成金。通年で申請可能。" },
  { slug: "kenkyu-kaihatsu-josei", title: "成長型中小企業等研究開発支援事業", category: "rd", target_type: "corp", provider_name: "中小企業庁", max_amount: 45000000, subsidy_rate: "2/3", deadline: "2026-04-30", status: "open", summary: "中小企業が大学・公設試験研究機関と連携して行う研究開発や試作品開発を支援。" },
  { slug: "kaigai-tenkai-hojo", title: "海外ビジネス戦略推進支援事業", category: "export", target_type: "corp", provider_name: "JETRO", max_amount: 5000000, subsidy_rate: "1/2", deadline: "2026-08-31", status: "upcoming", summary: "海外市場への新規参入や販路拡大を目指す中小企業の海外展開を支援。市場調査、展示会出展、商談等が対象。" },
  { slug: "startup-sogyou-hojo", title: "創業助成金（東京都）", category: "startup", target_type: "startup", provider_name: "東京都中小企業振興公社", max_amount: 4000000, subsidy_rate: "2/3", deadline: "2026-04-15", status: "closed", summary: "都内で創業予定の個人または創業から5年未満の中小企業者を対象とした助成金。賃借料、広告費、従業員人件費等が対象。" },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM hojokin_items").run();
    console.log("🗑️  hojokin_items cleared");
  }
  const insert = db.prepare(`
    INSERT OR IGNORE INTO hojokin_items
      (slug, title, category, target_type, provider_name, max_amount, subsidy_rate, deadline, status, summary, is_published, created_at, updated_at)
    VALUES
      (@slug, @title, @category, @target_type, @provider_name, @max_amount, @subsidy_rate, @deadline, @status, @summary, 1, datetime('now'), datetime('now'))
  `);
  let inserted = 0, skipped = 0;
  for (const row of SEED) {
    const r = insert.run(row);
    if (r.changes > 0) { inserted++; console.log(`  ✅ ${row.title}`); }
    else { skipped++; console.log(`  ⏭️  ${row.title} (exists)`); }
  }
  const count = db.prepare("SELECT COUNT(*) as c FROM hojokin_items").get();
  console.log(`\n✅ Done! Inserted: ${inserted}, Skipped: ${skipped}, Total: ${count.c}`);
}
main().catch(console.error);
