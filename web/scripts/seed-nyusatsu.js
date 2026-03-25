#!/usr/bin/env node
/**
 * 入札ナビ seed — 仮データを nyusatsu_items テーブルに投入
 * Usage: node scripts/seed-nyusatsu.js [--clear]
 */

const SEED = [
  { slug: "gov-system-renewal-2026", title: "次期基幹システム更改業務", category: "it", issuer_name: "総務省", target_area: "全国", deadline: "2026-05-31", budget_amount: 500000000, bidding_method: "proposal", status: "open", summary: "省内基幹業務システムの更改に伴う設計・開発・移行・運用保守業務一式。クラウド移行を含む。" },
  { slug: "bridge-repair-kanto-2026", title: "首都圏橋梁補修工事（第3期）", category: "construction", issuer_name: "国土交通省 関東地方整備局", target_area: "関東", deadline: "2026-06-15", budget_amount: 320000000, bidding_method: "open", status: "open", summary: "首都圏内の国道に架かる橋梁5基の補修・耐震補強工事。" },
  { slug: "dx-consulting-2026", title: "自治体DX推進支援業務委託", category: "consulting", issuer_name: "デジタル庁", target_area: "全国", deadline: "2026-07-10", budget_amount: 80000000, bidding_method: "proposal", status: "open", summary: "地方自治体のDX推進を支援するためのコンサルティング業務。現状分析、計画策定、導入支援を含む。" },
  { slug: "school-pc-procurement-2026", title: "教育用端末調達（令和8年度）", category: "goods", issuer_name: "文部科学省", target_area: "全国", deadline: "2026-04-30", budget_amount: 1200000000, bidding_method: "open", status: "open", summary: "GIGAスクール構想に基づく教育用タブレット端末50,000台の調達。" },
  { slug: "park-maintenance-osaka-2026", title: "大阪市公園維持管理業務", category: "service", issuer_name: "大阪市 建設局", target_area: "大阪府", deadline: "2026-08-20", budget_amount: 45000000, bidding_method: "designated", status: "upcoming", summary: "市内主要公園12か所の植栽管理、清掃、施設点検等の年間維持管理業務。" },
  { slug: "cybersecurity-audit-2026", title: "サイバーセキュリティ監査業務", category: "it", issuer_name: "内閣サイバーセキュリティセンター", target_area: "全国", deadline: "2026-09-30", budget_amount: 150000000, bidding_method: "proposal", status: "upcoming", summary: "政府機関のサイバーセキュリティ対策状況の監査及び改善提案業務。" },
  { slug: "disaster-stockpile-2026", title: "防災備蓄品購入（令和8年度）", category: "goods", issuer_name: "東京都 総務局", target_area: "東京都", deadline: "2026-03-31", budget_amount: 25000000, bidding_method: "open", status: "closed", summary: "都内避難所向け防災備蓄品（食料、毛布、簡易トイレ等）の購入。" },
  { slug: "tourism-research-2026", title: "インバウンド観光動向調査業務", category: "consulting", issuer_name: "観光庁", target_area: "全国", deadline: "2026-06-30", budget_amount: 60000000, bidding_method: "proposal", status: "open", summary: "訪日外国人旅行者の動向、消費行動、満足度に関する調査・分析業務。" },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  if (process.argv.includes("--clear")) {
    db.prepare("DELETE FROM nyusatsu_items").run();
    console.log("🗑️  nyusatsu_items cleared");
  }
  const insert = db.prepare(`
    INSERT OR IGNORE INTO nyusatsu_items
      (slug, title, category, issuer_name, target_area, deadline, budget_amount, bidding_method, status, summary, is_published, created_at, updated_at)
    VALUES
      (@slug, @title, @category, @issuer_name, @target_area, @deadline, @budget_amount, @bidding_method, @status, @summary, 1, datetime('now'), datetime('now'))
  `);
  let inserted = 0, skipped = 0;
  for (const row of SEED) {
    const r = insert.run(row);
    if (r.changes > 0) { inserted++; console.log(`  ✅ ${row.title}`); }
    else { skipped++; console.log(`  ⏭️  ${row.title} (exists)`); }
  }
  const count = db.prepare("SELECT COUNT(*) as c FROM nyusatsu_items").get();
  console.log(`\n✅ Done! Inserted: ${inserted}, Skipped: ${skipped}, Total: ${count.c}`);
}
main().catch(console.error);
