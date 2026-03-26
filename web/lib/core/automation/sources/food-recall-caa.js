/**
 * food-recall Source Adapter — 消費者庁リコール情報サイト
 *
 * Source: https://www.recall.caa.go.jp/result/index.php?screession=food
 * 食品関連のリコール・自主回収情報の一覧を取得する。
 *
 * 構造:
 *   一覧ページ → テーブル形式で案件が並ぶ
 *   各行: 日付, 事業者名, 商品名, カテゴリ, 対象地域, 状態
 */

import { fetchHtml, extractTableRows, stripTags, resolveUrl, extractHrefs } from "../fetch-helper.js";

const SOURCE_URL = "https://www.recall.caa.go.jp/result/index.php?screession=food";
const BASE_URL = "https://www.recall.caa.go.jp";

/**
 * 消費者庁リコールサイトから食品リコール情報を取得
 * @returns {{ items: Array, errors: string[], sourceUrl: string }}
 */
export async function fetchFoodRecallFromCaa() {
  const result = await fetchHtml(SOURCE_URL);
  if (!result.ok) {
    return { items: [], errors: [`取得失敗: ${result.error}`], sourceUrl: SOURCE_URL };
  }

  try {
    const items = parseFoodRecallListPage(result.html);
    return { items, errors: [], sourceUrl: SOURCE_URL };
  } catch (err) {
    return { items: [], errors: [`パース失敗: ${err.message}`], sourceUrl: SOURCE_URL };
  }
}

/**
 * 一覧ページのHTMLをパースしてアイテム配列を返す
 *
 * 実構造: リンク形式
 *   <a href="/result/detail.php?rcl=XXXXX&screenkbn=06">
 *     事業者名「商品名」 - 対応内容
 *   </a>
 *   日付: 2026/03/25
 */
function parseFoodRecallListPage(html) {
  const items = [];
  const seen = new Set();

  // リンクから detail.php を含むものを抽出
  const linkRegex = /<a[^>]*href=["']([^"']*detail\.php\?rcl=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  // 日付を前後のテキストから検出するため、全体テキストも保持
  const plainText = stripTags(html);

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const linkHtml = match[2];
    const linkText = stripTags(linkHtml).trim();

    if (linkText.length < 3) continue;
    // 特集やカテゴリリンクをスキップ
    if (linkText.includes("特集") || linkText.includes("一覧を見る")) continue;

    const detailUrl = resolveUrl(SOURCE_URL, href);
    const rclMatch = href.match(/rcl=(\d+)/);
    const rclId = rclMatch ? rclMatch[1] : null;
    if (!rclId || seen.has(rclId)) continue;
    seen.add(rclId);

    // テキストから事業者名と商品名を分離
    // パターン: "事業者名「商品名」 - 対応内容" or "事業者名「商品名...」 - 対応"
    let manufacturer = null;
    let productName = linkText;
    let recallType = "voluntary";

    const quoteMatch = linkText.match(/^(.+?)「(.+?)」/);
    if (quoteMatch) {
      manufacturer = quoteMatch[1].trim();
      productName = quoteMatch[2].trim();
    }

    // 対応内容から recall_type を推測
    if (linkText.includes("回収命令")) recallType = "recall";
    else if (linkText.includes("注意喚起")) recallType = "alert";
    else recallType = "voluntary";

    // 前後のHTMLから日付を検出
    const surroundingHtml = html.substring(Math.max(0, match.index - 200), match.index + match[0].length + 200);
    const dateMatch = surroundingHtml.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    const recallDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : null;

    // 食品カテゴリは screession=food なので基本食品
    const category = guessCategory(productName + " " + (manufacturer || ""));

    items.push({
      product_name: productName,
      manufacturer,
      recall_date: recallDate,
      category,
      status: "active",
      recall_type: recallType,
      reason: guessReason(productName + " " + (manufacturer || "")),
      risk_level: recallType === "recall" ? "class1" : "unknown",
      affected_area: null,
      source_url: detailUrl,
      detail_url: detailUrl,
      summary: `${manufacturer || ""}${manufacturer ? " " : ""}「${productName}」のリコール・自主回収情報。`,
    });
  }

  return items;
}

/**
 * テキストからカテゴリを推測
 */
function guessCategory(text) {
  if (!text) return "other";
  const t = text.trim();
  if (t.includes("菓子") || t.includes("チョコ") || t.includes("スナック")) return "confectionery";
  if (t.includes("飲料") || t.includes("ドリンク") || t.includes("ジュース")) return "beverage";
  if (t.includes("乳") || t.includes("牛乳") || t.includes("ヨーグルト")) return "dairy";
  if (t.includes("冷凍")) return "frozen";
  if (t.includes("調味") || t.includes("ソース") || t.includes("醤油")) return "seasoning";
  if (t.includes("健康") || t.includes("サプリ")) return "supplement";
  if (t.includes("生鮮") || t.includes("野菜") || t.includes("果物") || t.includes("魚")) return "fresh";
  if (t.includes("加工")) return "processed";
  return "other";
}

/**
 * テキストから原因を推測
 */
function guessReason(text) {
  if (!text) return "other";
  const t = text.trim();
  if (t.includes("異物")) return "foreign_matter";
  if (t.includes("菌") || t.includes("微生物") || t.includes("カビ")) return "microbe";
  if (t.includes("アレルゲン") || t.includes("アレルギー")) return "allergen";
  if (t.includes("化学") || t.includes("農薬") || t.includes("残留")) return "chemical";
  if (t.includes("表示")) return "labeling";
  if (t.includes("品質") || t.includes("変色") || t.includes("異臭")) return "quality";
  return "other";
}

// ─── テスト/フォールバック用サンプルデータ ─────────────────────
// 実サイトにアクセスできない場合に使用

export function getSampleFoodRecallItems() {
  return [
    {
      product_name: "〇〇チョコレート（ミルク味）200g",
      manufacturer: "〇〇製菓株式会社",
      category: "confectionery",
      recall_type: "voluntary",
      reason: "allergen",
      risk_level: "class1",
      affected_area: "全国",
      recall_date: "2026-03-25",
      status: "active",
      consumer_action: "アレルギー（落花生）のある方は召し上がらないでください。",
      summary: "落花生の表示漏れにより自主回収。アレルギー表示に「落花生」を含む原材料の記載が欠落。",
      source_url: "https://www.recall.caa.go.jp/",
    },
    {
      product_name: "△△プレミアムヨーグルト 400g",
      manufacturer: "△△乳業株式会社",
      category: "dairy",
      recall_type: "voluntary",
      reason: "microbe",
      risk_level: "class2",
      affected_area: "関東・甲信越",
      recall_date: "2026-03-24",
      status: "active",
      consumer_action: "該当商品を購入された方は販売店にご返品ください。",
      summary: "一般生菌数が基準値を超過。製造ラインの温度管理に一時的な不備が発覚。",
      source_url: "https://www.recall.caa.go.jp/",
    },
    {
      product_name: "□□ペットボトル緑茶 500ml",
      manufacturer: "□□飲料株式会社",
      category: "beverage",
      recall_type: "voluntary",
      reason: "quality",
      risk_level: "class3",
      affected_area: "全国",
      recall_date: "2026-03-22",
      status: "active",
      consumer_action: "変色が確認された場合は飲用をお控えください。",
      summary: "一部ロットで保管温度の逸脱により沈殿が発生。健康被害の報告なし。",
      source_url: "https://www.recall.caa.go.jp/",
    },
    {
      product_name: "◇◇冷凍えびフライ 10本入",
      manufacturer: "◇◇食品工業株式会社",
      category: "frozen",
      recall_type: "recall",
      reason: "foreign_matter",
      risk_level: "class2",
      affected_area: "全国",
      recall_date: "2026-03-20",
      status: "active",
      consumer_action: "お手元にある商品は食べずに販売店へお戻しください。",
      summary: "製造設備の部品が破損し、金属片（ステンレス）が混入した可能性。",
      source_url: "https://www.recall.caa.go.jp/",
    },
    {
      product_name: "☆☆プロテインバー ココア味 12本入",
      manufacturer: "☆☆ヘルスケア株式会社",
      category: "supplement",
      recall_type: "voluntary",
      reason: "labeling",
      risk_level: "class3",
      affected_area: "全国",
      recall_date: "2026-03-18",
      status: "completed",
      consumer_action: "正しい栄養成分表示は弊社HPをご確認ください。",
      summary: "エネルギー値の表記に誤りがあり、実測値との乖離が確認されたため自主回収。回収完了。",
      source_url: "https://www.recall.caa.go.jp/",
    },
  ];
}
