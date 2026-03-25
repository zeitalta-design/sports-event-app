#!/usr/bin/env node
const SEED = [
  { slug: "shibuya-designer-apt", title: "渋谷デザイナーズアパートメント", category: "city", area: "東京都渋谷区", property_type: "entire", capacity: 4, price_per_night: 15000, min_nights: 2, host_name: "Yuki", rating: 4.8, review_count: 127, summary: "渋谷駅徒歩5分のスタイリッシュな1LDK。Netflix完備。", status: "active" },
  { slug: "okinawa-ocean-villa", title: "沖縄オーシャンビュー ヴィラ", category: "resort", area: "沖縄県恩納村", property_type: "entire", capacity: 8, price_per_night: 45000, min_nights: 3, host_name: "Takeshi", rating: 4.9, review_count: 89, summary: "プライベートプール付きの一棟貸しヴィラ。目の前がビーチ。", status: "active" },
  { slug: "kyoto-machiya-family", title: "京都町家ファミリーステイ", category: "family", area: "京都府京都市東山区", property_type: "entire", capacity: 6, price_per_night: 25000, min_nights: 2, host_name: "Hanako", rating: 4.7, review_count: 203, summary: "築100年の町家をリノベーション。庭園付き。子連れ歓迎。", status: "active" },
  { slug: "shinjuku-business-room", title: "新宿駅前ビジネスルーム", category: "business", area: "東京都新宿区", property_type: "private_room", capacity: 2, price_per_night: 7500, min_nights: 1, host_name: "Kenji", rating: 4.3, review_count: 456, summary: "新宿駅西口徒歩3分。Wi-Fi・デスク完備のビジネス特化型。", status: "active" },
  { slug: "hakone-luxury-onsen", title: "箱根温泉付きラグジュアリー邸宅", category: "luxury", area: "神奈川県箱根町", property_type: "entire", capacity: 10, price_per_night: 80000, min_nights: 2, host_name: "Rina", rating: 4.95, review_count: 34, summary: "源泉掛け流し露天風呂付き。富士山を望む贅沢な一棟貸し。", status: "active" },
  { slug: "osaka-budget-share", title: "大阪なんばゲストハウス", category: "budget", area: "大阪府大阪市中央区", property_type: "shared_room", capacity: 1, price_per_night: 3000, min_nights: 1, host_name: "Mike", rating: 4.1, review_count: 312, summary: "なんば駅徒歩2分。バックパッカー向けドミトリー。", status: "active" },
  { slug: "karuizawa-forest-cottage", title: "軽井沢フォレストコテージ", category: "resort", area: "長野県軽井沢町", property_type: "entire", capacity: 5, price_per_night: 30000, min_nights: 2, host_name: "Satoshi", rating: 4.6, review_count: 78, summary: "森に囲まれた静かなコテージ。BBQ設備あり。ペット可。", status: "active" },
  { slug: "fukuoka-tenjin-studio", title: "福岡天神コンパクトスタジオ", category: "city", area: "福岡県福岡市中央区", property_type: "entire", capacity: 3, price_per_night: 9000, min_nights: 1, host_name: "Aiko", rating: 4.5, review_count: 167, summary: "天神駅直結。屋台街まで徒歩5分のコンパクトなワンルーム。", status: "active" },
];

async function main() {
  const { getDb } = await import("../lib/db.js");
  const db = getDb();
  if (process.argv.includes("--clear")) { db.prepare("DELETE FROM minpaku_items").run(); console.log("🗑️  cleared"); }
  const insert = db.prepare(`INSERT OR IGNORE INTO minpaku_items (slug, title, category, area, property_type, capacity, price_per_night, min_nights, host_name, rating, review_count, summary, status, is_published, created_at, updated_at) VALUES (@slug, @title, @category, @area, @property_type, @capacity, @price_per_night, @min_nights, @host_name, @rating, @review_count, @summary, @status, 1, datetime('now'), datetime('now'))`);
  let ins = 0, skip = 0;
  for (const row of SEED) { const r = insert.run(row); if (r.changes > 0) { ins++; console.log(`  ✅ ${row.title}`); } else { skip++; console.log(`  ⏭️  ${row.title} (exists)`); } }
  const c = db.prepare("SELECT COUNT(*) as c FROM minpaku_items").get();
  console.log(`\n✅ Done! Inserted: ${ins}, Skipped: ${skip}, Total: ${c.c}`);
}
main().catch(console.error);
