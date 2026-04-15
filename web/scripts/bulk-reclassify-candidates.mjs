#!/usr/bin/env node
/**
 * registry の candidate を一括再分類するスクリプト。
 *
 * 入力: ID と新ステータスのマッピング
 * 処理: lib/gyosei-shobun-source-registry.js 内の該当 entry の
 *       discoveryStatus を書き換える（notes の末尾に決定日時を追記）。
 *
 * 使い方:
 *   node scripts/bulk-reclassify-candidates.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const FILE = path.resolve(process.cwd(), "lib/gyosei-shobun-source-registry.js");
const TODAY = "2026-04-16";

// ─── 再分類マッピング ─────────────────────
//
// 各IDの決定根拠はregistry内のnotesに既に記載されているため、ここでは「→ 手動運用」のみ。

const TO_MANUAL_REVIEW = [
  // ─ 第1バッチ（ノート既記載で手動運用確定）─
  { id: "iwate_takken", reason: "公表枠組みあり・事例掲載なしのためMLIT補完前提で固定" },
  { id: "ishikawa_takken", reason: "処分基準PDFのみ・Web一覧なし" },
  { id: "yamanashi_takken", reason: "専用ページあるが処分実績一覧なし" },
  { id: "shimane_takken", reason: "公表方針のみ・事例ページなし" },
  { id: "okayama_takken", reason: "県独自Web一覧なし・MLIT誘導" },
  { id: "yamaguchi_takken", reason: "処分基準PDFのみ・事例なし" },
  { id: "kumamoto_takken", reason: "処分基準のみ・MLIT誘導" },
  { id: "oita_takken", reason: "処分基準PDFのみ・MLIT誘導" },
  { id: "miyazaki_takken", reason: "県はMLIT一元化方式" },
  { id: "kagoshima_takken", reason: "案内ページのみ・MLIT誘導" },
  { id: "okinawa_takken", reason: "処分基準PDFのみ・MLIT誘導" },
  { id: "akita_kensetsu", reason: "案内ページ+県庁閲覧のみ・Web一覧なし" },
  { id: "yamagata_kensetsu", reason: "press release 多数404化・集約なし" },
  { id: "ibaraki_kensetsu", reason: "専用サイトに処分基準のみ・実績データなし" },
  { id: "tochigi_kensetsu", reason: "処分基準ページのみ・MLIT誘導" },
  { id: "gunma_kensetsu", reason: "処分基準ページのみ・MLIT誘導" },
  { id: "toyama_kensetsu", reason: "情報ページ+閲覧制度のみ・Webデータなし" },
  { id: "yamanashi_kensetsu", reason: "専用ページ+閲覧制度のみ・Webデータなし" },
  { id: "yamaguchi_kensetsu", reason: "処分基準PDFのみ・MLIT誘導" },
  { id: "nagasaki_kensetsu", reason: "press release 404化・常設一覧なし" },
  { id: "ishikawa_kensetsu", reason: "年度別press releaseはあるが常設一覧なし・現状fetcher未実装のため手動運用" },
  { id: "aomori_architect_office", reason: "専用一覧ページなし・MLITで補完" },
  { id: "iwate_architect_office", reason: "個別press releaseのみ・継続性なし" },
  { id: "env_sanpai_portal", reason: "制度的根拠のみ・直接スクレイプ対象外" },
  { id: "sanpainet_gyosha", reason: "許可情報中心・取消はsanpainet_torikeshiで取得中のため重複" },
  { id: "sanpainet_yuryo", reason: "優良認定情報・行政処分の取得対象外" },

  // ─ 第2バッチ（URL実態確認後の判定）─
  { id: "hokkaido_architect_office", reason: "告示PDFのみ・一覧テーブルなし。件数少・スクレイピング価値低" },
  { id: "nara_architect_office", reason: "建築士審査会の議事録サマリのみ・処分レジストリではない" },
  { id: "niigata_architect_office", reason: "処分基準PDFダウンロードページのみ・実処分事例なし" },
  { id: "hyogo_kensetsu_architect_office", reason: "既存 hyogo_kensetsu の建設業ページと実質重複（別URL）" },
  { id: "fukushima_architect_office", reason: "URL が fukushima_kensetsu と同一。建築士専用一覧なし" },
  { id: "shimane_architect_office", reason: "報道発表全件検索プラットフォーム・処分常設リストなし" },
  { id: "aichi_sanpai", reason: "URL 403/404。処分一覧ページを特定不可" },
  { id: "hyogo_sanpai", reason: "URL 403。別URLまたは手動調査要" },
  { id: "nara_sanpai", reason: "PDF URL が404リンク切れ・現行PDF未特定" },
  { id: "tottori_sanpai", reason: "URL 404・現行処分一覧URLを特定不可" },
];

// ─── 本体 ─────────────────────

let src = fs.readFileSync(FILE, "utf8");
const original = src;
let changed = 0, skipped = 0;

for (const { id, reason } of TO_MANUAL_REVIEW) {
  // 該当 entry の discoveryStatus: "candidate" を "manual_review" に書き換え。
  // entry は prefSource({...}) または {...} 形式で1行または複数行。
  // id: "xxx" を手がかりに、その entry 内の discoveryStatus のみをピンポイントで変更。
  const idPattern = new RegExp(`(id:\\s*"${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}")`);
  const idMatch = src.match(idPattern);
  if (!idMatch) {
    console.warn(`[skip] id not found: ${id}`);
    skipped++;
    continue;
  }

  const idStart = idMatch.index;
  // この entry の範囲を特定する。prefSource() は1行、その他は複数行だが、
  // id から次の '}' または次の entry の開始 ',\n  prefSource(' まで検索する。
  const afterIdPart = src.slice(idStart);

  // 候補entry内の discoveryStatus: "candidate" を探す（最初の1箇所だけ対象）
  const statusPattern = /discoveryStatus:\s*"candidate"/;
  const statusMatch = afterIdPart.match(statusPattern);
  if (!statusMatch) {
    console.warn(`[skip] discoveryStatus: "candidate" not found for ${id}`);
    skipped++;
    continue;
  }

  // 置換
  const absPos = idStart + statusMatch.index;
  src = src.slice(0, absPos) + `discoveryStatus: "manual_review"` + src.slice(absPos + statusMatch[0].length);

  // notesに「[${TODAY}] 手動運用確定: ${reason}」を追記
  // 以下の中から最初に見つかる notes: "...", を対象
  const sliceFromId = src.slice(idStart);
  const notesMatch = sliceFromId.match(/notes:\s*"((?:[^"\\]|\\.)*)"/);
  if (notesMatch) {
    const oldNotes = notesMatch[1];
    const newNotes = `[${TODAY}手動運用確定/${reason}] ${oldNotes}`;
    const notesAbsPos = idStart + notesMatch.index;
    src = src.slice(0, notesAbsPos) + `notes: "${newNotes}"` + src.slice(notesAbsPos + notesMatch[0].length);
  }

  changed++;
  console.log(`[ok] ${id} → manual_review`);
}

console.log();
console.log(`変更: ${changed}件 / スキップ: ${skipped}件`);

if (dryRun) {
  console.log("(--dry-run なので書き込みなし)");
} else if (src !== original) {
  fs.writeFileSync(FILE, src, "utf8");
  console.log(`✓ ${FILE} を更新しました`);
} else {
  console.log("(変更なし)");
}
