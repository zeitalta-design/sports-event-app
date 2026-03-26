/**
 * 詳細ページ deterministic 抽出器
 *
 * HTMLの構造解析で取得可能な情報を最大限抽出する。
 * LLM は補完用であり、この層で取れる情報が基本。
 */

import { fetchHtml, stripTags, extractTableRows } from "./fetch-helper.js";

// ─── food-recall 詳細ページ抽出 ─────────────────────

/**
 * 消費者庁リコール詳細ページから情報を抽出
 * URL例: https://www.recall.caa.go.jp/result/detail.php?rcl=XXXXX
 */
export async function extractFoodRecallDetail(url) {
  const result = await fetchHtml(url, { timeout: 15000 });
  if (!result.ok) return { ok: false, error: result.error, data: {} };

  const html = result.html;
  const data = {};
  const missing = [];

  // テーブル行からキー:値ペアを抽出
  const rows = extractTableRows(html);
  for (const cells of rows) {
    if (cells.length < 2) continue;
    const key = cells[0].trim();
    const val = cells[1].trim();
    if (!val) continue;

    if (key.includes("商品名") || key.includes("製品名") || key.includes("品名")) data.product_name = val;
    else if (key.includes("事業者") || key.includes("届出者") || key.includes("製造")) data.manufacturer = val;
    else if (key.includes("対象")) {
      if (key.includes("地域") || key.includes("範囲")) data.affected_area = val;
      else if (key.includes("ロット") || key.includes("賞味") || key.includes("製造日")) data.lot_number = val;
      else data.affected_area = val;
    }
    else if (key.includes("原因") || key.includes("理由")) data.reason_detail = val;
    else if (key.includes("健康被害") || key.includes("健康影響")) data.health_impact = val;
    else if (key.includes("対応") || key.includes("消費者")) data.consumer_action = val;
    else if (key.includes("問い合わせ") || key.includes("連絡先")) data.contact_info = val;
    else if (key.includes("公表日") || key.includes("届出日") || key.includes("日付")) data.recall_date = extractDate(val);
    else if (key.includes("分類") || key.includes("カテゴリ")) data.category_detail = val;
  }

  // <li> ベースの抽出（消費者庁 detail.php 形式: <ul><li>項目名 値</li></ul>）
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(html)) !== null) {
    const liText = stripTags(liMatch[1]).trim();
    if (liText.startsWith("商品名") && !data.product_name) {
      data.product_name = liText.replace(/^商品名\s*/, "").trim();
    } else if ((liText.startsWith("届出者") || liText.startsWith("事業者")) && !data.manufacturer) {
      data.manufacturer = liText.replace(/^(?:届出者|事業者)\s*/, "").trim();
    } else if (liText.startsWith("連絡先") && !data.contact_info) {
      data.contact_info = liText.replace(/^連絡先\s*/, "").trim();
    } else if ((liText.startsWith("対応方法") || liText.startsWith("対応")) && !data.consumer_action) {
      data.consumer_action = liText.replace(/^対応(?:方法)?\s*/, "").trim();
    } else if ((liText.startsWith("対象の特定") || liText.includes("ロット") || liText.includes("賞味期限")) && !data.lot_number) {
      data.lot_number = liText.replace(/^対象の特定情報\s*/, "").replace(/^対象\s*/, "").trim();
    } else if ((liText.startsWith("危害") || liText.includes("健康被害")) && !data.health_impact) {
      data.health_impact = liText.trim();
    }
  }

  // 本文テキストからの補完抽出（強化版: 消費者庁のJSレンダリング対応）
  const plainText = stripTags(html);

  // 商品名（プレーンテキストから）
  if (!data.product_name) {
    const pnMatch = plainText.match(/商品名\s*[：:]*\s*(.{2,100}?)(?:\n|届出者|連絡先|対応)/);
    if (pnMatch) data.product_name = pnMatch[1].trim();
  }

  // 届出者/事業者名
  if (!data.manufacturer) {
    const mfMatch = plainText.match(/(?:届出者|事業者名?)\s*[：:]*\s*(.{2,100}?)(?:\n|連絡先|対応|商品名)/);
    if (mfMatch) data.manufacturer = mfMatch[1].trim();
  }

  // 連絡先・電話番号
  if (!data.contact_info) {
    // 電話番号パターン（0120-xxx-xxx or 03-xxxx-xxxx 等）
    const phoneMatch = plainText.match(/(0\d{1,4}[-ー]\d{2,4}[-ー]\d{3,4})/);
    if (phoneMatch) {
      // 電話番号の周辺テキストを取得
      const idx = plainText.indexOf(phoneMatch[0]);
      const surrounding = plainText.substring(Math.max(0, idx - 50), idx + phoneMatch[0].length + 20).trim();
      data.contact_info = surrounding;
    } else {
      missing.push("contact_info");
    }
  }

  // 対応方法
  if (!data.consumer_action) {
    const actionPatterns = [
      /対応方法\s*[：:]*\s*(.{5,300}?)(?:\n\n|対象の特定|備考|$)/s,
      /(?:返金|回収|交換|返品|廃棄)[\s\S]{5,200}?(?:ください|お願い|いたします|対応)/,
    ];
    for (const pattern of actionPatterns) {
      const m = plainText.match(pattern);
      if (m) { data.consumer_action = (m[1] || m[0]).trim().substring(0, 300); break; }
    }
    if (!data.consumer_action) missing.push("consumer_action");
  }

  // 対象の特定情報（ロット/賞味期限/JANコード等）
  if (!data.lot_number) {
    const lotPatterns = [
      /対象の特定情報\s*[：:]*\s*(.{5,200}?)(?:\n\n|備考|$)/s,
      /(?:JAN[コード]*|賞味期限|ロット|LOT|製造日)\s*[：:]*\s*(.{3,100})/i,
    ];
    for (const pattern of lotPatterns) {
      const m = plainText.match(pattern);
      if (m) { data.lot_number = (m[1] || m[0]).trim().substring(0, 200); break; }
    }
    if (!data.lot_number) {
      const lotMatch = plainText.match(/(?:ロット|LOT|賞味期限|製造日|対象製品)[\s：:]\s*(.{3,80})/i);
      if (lotMatch) data.lot_number = lotMatch[1].trim();
      else missing.push("lot_number");
    }
  }

  if (!data.health_impact) {
    // 危害内容・健康被害の抽出
    const healthPatterns = [
      /危害の内容\s*[：:]*\s*(.{5,200}?)(?:\n\n|対応|$)/s,
      /健康(?:被害|影響)\s*[：:]*\s*(.{5,200}?)(?:\n\n|$)/s,
      /健康(?:被害|影響)[\s\S]{0,100}?(?:ありません|報告なし|なし|あり|確認され)/,
    ];
    for (const pattern of healthPatterns) {
      const m = plainText.match(pattern);
      if (m) { data.health_impact = (m[1] || m[0]).trim().substring(0, 200); break; }
    }
    if (!data.health_impact) {
      // 脱酸素剤・異物等の問題記述を検出
      const problemMatch = plainText.match(/(?:脱酸素剤|異物|金属片|アレルゲン|細菌|カビ|残留|変色)[\s\S]{5,150}?(?:可能性|おそれ|確認|検出|混入)/);
      if (problemMatch) data.health_impact = problemMatch[0].trim();
      else missing.push("health_impact");
    }
  }

  // 要約生成
  const parts = [data.manufacturer, data.product_name, data.reason_detail].filter(Boolean);
  data.summary = parts.length > 0
    ? `${data.manufacturer || ""}「${data.product_name || "不明"}」${data.reason_detail ? "— " + data.reason_detail.substring(0, 80) : ""}`
    : null;

  const confidence = 1.0 - (missing.length * 0.1);
  return {
    ok: true,
    data,
    missing,
    confidence: Math.max(0.3, Math.min(1.0, confidence)),
    quality: missing.length <= 1 ? "good" : missing.length <= 3 ? "draft" : "minimal",
    inputLength: html.length,
  };
}

// ─── shitei 詳細ページ抽出 ─────────────────────

/**
 * 自治体公募詳細ページから情報を抽出
 */
export async function extractShiteiDetail(url) {
  const result = await fetchHtml(url, { timeout: 15000 });
  if (!result.ok) return { ok: false, error: result.error, data: {} };

  const html = result.html;
  const data = {};
  const missing = [];

  // テーブル行からキー:値ペアを抽出
  const rows = extractTableRows(html);
  for (const cells of rows) {
    if (cells.length < 2) continue;
    const key = cells[0].trim();
    const val = cells[1].trim();
    if (!val) continue;

    if (key.match(/施設名|対象施設/)) data.facility_name = val;
    else if (key.match(/応募資格|参加資格|要件/)) data.eligibility = val;
    else if (key.match(/提出|応募方法|申請/)) data.application_method = val;
    else if (key.match(/期間|指定期間|管理期間|委託期間/)) {
      const dateRange = extractDateRange(val);
      if (dateRange.start) data.contract_start_date = dateRange.start;
      if (dateRange.end) data.contract_end_date = dateRange.end;
    }
    else if (key.match(/募集期間|公募期間|受付期間/)) {
      const dateRange = extractDateRange(val);
      if (dateRange.start) data.application_start_date = dateRange.start;
      if (dateRange.end) data.application_deadline = dateRange.end;
    }
    else if (key.match(/締切|期限|〆切/)) data.application_deadline = extractDate(val);
    else if (key.match(/説明会/)) data.opening_date = extractDate(val);
    else if (key.match(/問[いい]合わせ|連絡先|担当/)) data.contact_info = val;
  }

  // 本文テキストからの補完
  const plainText = stripTags(html);

  if (!data.application_deadline) {
    const deadlineMatch = plainText.match(/(?:締切|期限|〆切|まで)[\s：:]*(\d{4}年\d{1,2}月\d{1,2}日|\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
    if (deadlineMatch) data.application_deadline = extractDate(deadlineMatch[1]);
    else missing.push("application_deadline");
  }

  if (!data.eligibility) {
    const eligMatch = plainText.match(/(?:応募資格|参加条件|参加要件)[\s：:]*(.{10,200}?)(?:\n|。)/);
    if (eligMatch) data.eligibility = eligMatch[1].trim();
    else missing.push("eligibility");
  }

  if (!data.application_method) {
    const methodMatch = plainText.match(/(?:提出方法|応募方法|申請方法)[\s：:]*(.{10,200}?)(?:\n|。)/);
    if (methodMatch) data.application_method = methodMatch[1].trim();
    else missing.push("application_method");
  }

  if (!data.facility_name) missing.push("facility_name");

  const confidence = 1.0 - (missing.length * 0.12);
  return {
    ok: true,
    data,
    missing,
    confidence: Math.max(0.3, Math.min(1.0, confidence)),
    quality: missing.length <= 1 ? "good" : missing.length <= 3 ? "draft" : "minimal",
    inputLength: html.length,
  };
}

// ─── ユーティリティ ─────────────────────

function extractDate(text) {
  if (!text) return null;
  const m = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日]?/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function extractDateRange(text) {
  if (!text) return { start: null, end: null };
  const dates = [];
  const regex = /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日]?/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    dates.push(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
  }
  return { start: dates[0] || null, end: dates[1] || null };
}
