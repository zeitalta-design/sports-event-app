/**
 * サンプル詳細データ投入スクリプト
 * THE CHALLENGE RACE KOBE (id=65) に Moshicom 級の詳細情報を登録する
 *
 * 使い方: node scripts/seed-marathon-detail.js
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "web", "data", "sports-event.db");
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "001_create_tables.sql");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// スキーマ適用（marathon_detailsテーブル作成）
if (fs.existsSync(SCHEMA_PATH)) {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
}

const MARATHON_ID = 65; // THE CHALLENGE RACE KOBE

// 既存データ確認
const existing = db
  .prepare("SELECT id FROM marathon_details WHERE marathon_id = ?")
  .get(MARATHON_ID);

const detailData = {
  marathon_id: MARATHON_ID,
  tagline:
    "神戸で開催の日本陸連公認レース！初心者からサブ3ランナーまで楽しめる6種目",
  summary: `神戸の海沿いを走る爽快なコース。フルマラソンからファンランまで6種目を用意し、幅広いランナーに対応。日本陸連公認コースでの記録は公式記録として認定されます。

ペーサーが各目標タイムに配置され、記録を狙うランナーをサポート。フラットなコースで自己ベスト更新を目指しましょう。

参加者全員にオリジナルTシャツと完走メダルを進呈。ゴール後は神戸グルメのフードコーナーもお楽しみいただけます。`,
  venue_name: "HAT神戸 なぎさ公園",
  venue_address: "〒651-0073 兵庫県神戸市中央区脇浜海岸通1丁目",
  access_info: `JR灘駅 南口より徒歩約12分
阪神岩屋駅 徒歩約10分
阪急王子公園駅 徒歩約18分
新神戸駅 車で約10分
大会専用駐車場はありません。公共交通機関をご利用ください。`,
  application_start_at: "2025-10-01",
  application_end_at: "2026-03-15",
  registration_start_time: "07:30",
  payment_methods_json: JSON.stringify([
    "クレジットカード",
    "コンビニ払い",
    "銀行振込",
  ]),
  agent_entry_allowed: 1,
  entry_url: "https://moshicom.com/137364",
  official_url: "https://moshicom.com/137364",
  cancellation_policy:
    "申込後のキャンセル・返金はできません。大会中止の場合は参加費の70%を返金します。",
  event_scale_label: "500〜1,000人",
  level_labels_json: JSON.stringify(["初心者OK", "中級者向け", "上級者向け"]),
  features_json: JSON.stringify([
    "日本陸連公認",
    "ペーサーあり",
    "チップ計測",
    "完走メダル",
    "オリジナルTシャツ",
    "フードコーナー",
    "フラットコース",
    "記録狙い",
  ]),
  sports_category: "ロードレース",
  event_type_label: "マラソン",
  measurement_method: "チップ計測（ランナーズチップ）",
  notes: `・ゼッケンは大会当日、受付にてお渡しします。
・更衣室・荷物預かりあり（無料）。
・給水所は約3km間隔で設置。
・完走証はゴール後に即時発行します。
・雨天決行、荒天中止。中止判断は前日18時までに公式サイトで告知します。`,
  faq_json: JSON.stringify([
    {
      question: "ゼッケンの受取方法は？",
      answer:
        "大会当日、受付テントにてお渡しします。受付時間は7:30〜8:30です。本人確認書類をお持ちください。",
    },
    {
      question: "更衣室はありますか？",
      answer:
        "会場内に男女別の更衣テントをご用意しています。貴重品は各自で管理をお願いします。",
    },
    {
      question: "荷物預かりはありますか？",
      answer:
        "無料の荷物預かり所をご用意しています。受付時にお渡しする荷物袋に入る範囲でお預かりします。",
    },
    {
      question: "記録証はもらえますか？",
      answer:
        "ゴール後に即時発行の速報記録証をお渡しします。後日、正式記録証をメールでお送りします。",
    },
    {
      question: "駐車場はありますか？",
      answer:
        "大会専用駐車場はございません。近隣のコインパーキングまたは公共交通機関をご利用ください。",
    },
    {
      question: "給水・給食はありますか？",
      answer:
        "約3km間隔で給水所を設置。フルマラソン・30kmの部では約15km地点以降に給食も用意しています。",
    },
  ]),
  schedule_json: JSON.stringify([
    { time: "07:30", label: "受付開始" },
    { time: "08:30", label: "受付終了" },
    { time: "08:45", label: "開会式" },
    { time: "09:00", label: "フルマラソン・30km スタート" },
    { time: "09:10", label: "ハーフマラソン スタート" },
    { time: "09:20", label: "10km スタート" },
    { time: "09:30", label: "5km スタート" },
    { time: "09:40", label: "1マイル スタート" },
    { time: "13:30", label: "フルマラソン 制限時間" },
    { time: "14:00", label: "閉会式・表彰式" },
    { time: "14:30", label: "会場撤収" },
  ]),
  pricing_json: JSON.stringify([
    { name: "フルマラソン", fee: "11,000円", note: "1ヶ月前まで早割10%OFF" },
    { name: "30km", fee: "7,700円", note: "1ヶ月前まで早割10%OFF" },
    { name: "ハーフマラソン", fee: "7,700円", note: "1ヶ月前まで早割10%OFF" },
    { name: "10km", fee: "5,500円", note: "" },
    { name: "5km", fee: "3,300円", note: "" },
    { name: "1マイル", fee: "3,300円", note: "ファンラン" },
  ]),
  time_limits_json: JSON.stringify([
    { name: "フルマラソン", limit: "4時間30分" },
    { name: "30km", limit: "3時間12分" },
    { name: "ハーフマラソン", limit: "2時間30分" },
    { name: "10km", limit: "90分" },
    { name: "5km", limit: "40分" },
    { name: "1マイル", limit: "20分" },
  ]),
  organizer_name: "THE CHALLENGE RACE 実行委員会",
  organizer_contact_name: "大会事務局",
  organizer_email: "info@challenge-race.example.com",
  organizer_phone: "078-XXX-XXXX",
  organizer_description:
    "THE CHALLENGE RACEシリーズは、全国主要都市で展開するランニングイベントです。日本陸連公認コースでの記録測定と、初心者でも楽しめるファンラン部門を併設しています。",
  organizer_review_score: 4.3,
  organizer_review_count: 127,
  series_events_json: JSON.stringify([
    { name: "THE CHALLENGE RACE TOKYO", url: "/marathon/99" },
  ]),
  course_info:
    "HAT神戸なぎさ公園をスタート/ゴールとし、神戸港沿いを走るフラットコース。高低差約5m。",
  map_url:
    "https://www.google.com/maps/place/HAT%E7%A5%9E%E6%88%B8+%E3%81%AA%E3%81%8E%E3%81%95%E5%85%AC%E5%9C%92/",
};

if (existing) {
  // UPDATE
  const cols = Object.keys(detailData).filter((k) => k !== "marathon_id");
  const setClause = cols.map((k) => `${k} = @${k}`).join(", ");
  db.prepare(
    `UPDATE marathon_details SET ${setClause}, updated_at = datetime('now') WHERE marathon_id = @marathon_id`
  ).run(detailData);
  console.log(`Updated marathon_details for marathon_id=${MARATHON_ID}`);
} else {
  // INSERT
  const cols = Object.keys(detailData);
  const placeholders = cols.map((k) => `@${k}`).join(", ");
  db.prepare(
    `INSERT INTO marathon_details (${cols.join(", ")}) VALUES (${placeholders})`
  ).run(detailData);
  console.log(`Inserted marathon_details for marathon_id=${MARATHON_ID}`);
}

db.close();
console.log("Done.");
