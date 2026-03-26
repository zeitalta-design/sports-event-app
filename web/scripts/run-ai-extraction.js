#!/usr/bin/env node
/**
 * AI構造化抽出実行スクリプト
 *
 * Usage:
 *   node scripts/run-ai-extraction.js food-recall [--limit 3]  # food-recall の詳細ページからAI抽出
 *   node scripts/run-ai-extraction.js shitei [--limit 5]        # shitei の詳細ページからAI抽出
 *   node scripts/run-ai-extraction.js status                     # AI抽出結果の概要表示
 *
 * 環境変数:
 *   LLM_ENABLED=true
 *   LLM_API_KEY=your-api-key
 *   LLM_PROVIDER=gemini (default) | openai
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const limitArg = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1]) : 3;

  const { getDb } = await import("../lib/db.js");
  const db = getDb();

  if (command === "status") {
    showStatus(db);
    return;
  }

  if (!command || !["food-recall", "shitei"].includes(command)) {
    console.log("Usage: run-ai-extraction.js <food-recall|shitei|status> [--limit N]");
    return;
  }

  // LLM設定確認
  const llmEnabled = process.env.LLM_ENABLED === "true";
  const llmKey = process.env.LLM_API_KEY || "";
  console.log(`\nLLM設定: ${llmEnabled ? "有効" : "無効"} | Provider: ${process.env.LLM_PROVIDER || "gemini"}`);

  if (!llmEnabled || !llmKey) {
    console.log("\n📋 LLM未設定。deterministic抽出モードで実行します。");
    console.log("  LLM補完を有効にするには: LLM_ENABLED=true LLM_API_KEY=xxx\n");
  }

  await runExtraction(db, command, limitArg, llmEnabled && !!llmKey);
}

/**
 * 統合抽出モード（deterministic + LLM ハイブリッド）
 * - まず deterministic parser で詳細ページから構造化抽出
 * - LLM有効時は不足項目をLLMで補完
 */
async function runExtraction(db, domainId, limit, useLlm) {
  console.log(`\n=== AI抽出実行: ${domainId} (最大${limit}件, LLM=${useLlm ? "ON" : "OFF"}) ===\n`);

  const { extractFoodRecallDetail, extractShiteiDetail } = await import("../lib/core/automation/detail-extractors.js");

  let items;
  if (domainId === "food-recall") {
    items = db.prepare("SELECT * FROM food_recall_items WHERE source_url IS NOT NULL AND source_url != '' ORDER BY id DESC LIMIT ?").all(limit);
  } else if (domainId === "shitei") {
    items = db.prepare("SELECT * FROM shitei_items WHERE detail_url IS NOT NULL AND detail_url != '' ORDER BY id DESC LIMIT ?").all(limit);
  } else if (domainId === "sanpai") {
    items = db.prepare("SELECT * FROM sanpai_items WHERE source_url IS NOT NULL AND source_url != '' ORDER BY id DESC LIMIT ?").all(limit);
  } else {
    console.log("未対応のドメイン"); return;
  }

  if (items.length === 0) {
    console.log("AI抽出対象のアイテムがありません（detail_url / source_url が必要）");
    return;
  }
  console.log(`対象: ${items.length}件\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = domainId === "food-recall" ? item.source_url : (item.detail_url || item.source_url);
    console.log(`[${i + 1}/${items.length}] ${domainId === "food-recall" ? item.product_name : item.title || item.company_name}`);
    console.log(`  URL: ${url}`);

    // 1. Deterministic 抽出
    let detResult;
    if (domainId === "food-recall") {
      detResult = await extractFoodRecallDetail(url);
    } else if (domainId === "shitei") {
      detResult = await extractShiteiDetail(url);
    } else {
      // sanpai: 汎用テーブル抽出
      detResult = await extractShiteiDetail(url); // 汎用として流用
    }

    if (!detResult.ok) {
      console.log(`  取得失敗: ${detResult.error}`);
      continue;
    }

    console.log(`  deterministic: ${Object.keys(detResult.data).length}項目抽出, confidence=${detResult.confidence.toFixed(2)}`);
    if (detResult.missing.length > 0) console.log(`  不足: ${detResult.missing.join(", ")}`);

    // 2. LLM 補完（有効時かつ不足項目あり）
    let llmModel = "deterministic";
    let llmTokens = 0;
    if (useLlm && detResult.missing.length > 0) {
      try {
        const { callLlm } = await import("../lib/llm-client.js");
        const { fetchHtml, stripTags } = await import("../lib/core/automation/fetch-helper.js");
        const htmlResult = await fetchHtml(url, { timeout: 10000 });
        if (htmlResult.ok) {
          let text = htmlResult.html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
          text = stripTags(text).replace(/\n{3,}/g, "\n\n").trim();
          if (text.length > 6000) text = text.substring(0, 6000);

          const missingStr = detResult.missing.join(", ");
          const llmResult = await callLlm({
            systemPrompt: `次の不足項目を抽出してJSON形式で返してください。不足項目: ${missingStr}。出力: {"data":{...},"confidence":0.7}`,
            userPrompt: text,
          });
          const parsed = parseResult(llmResult.text);
          // deterministic 結果に LLM 結果をマージ（LLMで補完された項目のみ追加）
          if (parsed.data) {
            Object.entries(parsed.data).forEach(([k, v]) => {
              if (v && !detResult.data[k]) detResult.data[k] = v;
            });
            detResult.missing = detResult.missing.filter(f => !parsed.data[f]);
            detResult.confidence = Math.min(1.0, detResult.confidence + 0.1);
          }
          llmModel = llmResult.model || "llm";
          llmTokens = (llmResult.usage?.inputTokens || 0) + (llmResult.usage?.outputTokens || 0);
          console.log(`  LLM補完: +${Object.keys(parsed.data || {}).length}項目, tokens=${llmTokens}`);
        }
      } catch (err) {
        console.log(`  LLM補完失敗: ${err.message}`);
      }
    }

    // 3. DB保存
    const entityType = domainId === "food-recall" ? "food_recall_item" : domainId === "shitei" ? "shitei_item" : "sanpai_item";
    db.prepare(`
      INSERT INTO ai_extractions
        (domain_id, entity_type, entity_id, entity_slug, source_url, extraction_type,
         input_text_length, extracted_json, missing_fields, review_reasons,
         confidence_score, quality_level, summary_text, llm_model, llm_tokens_used, created_at)
      VALUES
        (@domainId, @entityType, @entityId, @entitySlug, @sourceUrl, 'detail_page',
         @inputLength, @extractedJson, @missingFields, @reviewReasons,
         @confidence, @quality, @summary, @model, @tokens, datetime('now'))
    `).run({
      domainId,
      entityType,
      entityId: item.id,
      entitySlug: item.slug,
      sourceUrl: url,
      inputLength: detResult.inputLength || 0,
      extractedJson: JSON.stringify(detResult.data),
      missingFields: JSON.stringify(detResult.missing),
      reviewReasons: JSON.stringify(detResult.missing.length > 0 ? ["一部項目の補完が必要"] : []),
      confidence: detResult.confidence,
      quality: detResult.quality,
      summary: detResult.data.summary || null,
      model: llmModel,
      tokens: llmTokens,
    });

    console.log(`  保存完了: quality=${detResult.quality}\n`);
  }

  console.log("=== 完了 ===");
  showStatus(db);
}

// ─── 旧シミュレーションモード（互換用に残す） ─────────────────────
async function runSimulation(db, domainId, limit) {
  console.log(`\n=== AI抽出シミュレーション: ${domainId} (最大${limit}件) ===\n`);

  const { fetchHtml, stripTags } = await import("../lib/core/automation/fetch-helper.js");

  let items;
  if (domainId === "food-recall") {
    items = db.prepare("SELECT * FROM food_recall_items WHERE source_url IS NOT NULL AND source_url != '' ORDER BY id DESC LIMIT ?").all(limit);
  } else {
    items = db.prepare("SELECT * FROM shitei_items WHERE detail_url IS NOT NULL AND detail_url != '' AND is_published = 1 ORDER BY id DESC LIMIT ?").all(limit);
  }

  if (items.length === 0) {
    console.log("AI抽出対象のアイテムがありません（detail_url / source_url が必要）");
    return;
  }

  console.log(`対象: ${items.length}件\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = domainId === "food-recall" ? item.source_url : item.detail_url;
    const slug = item.slug;
    const name = domainId === "food-recall" ? item.product_name : item.title;

    console.log(`[${i + 1}/${items.length}] ${name}`);
    console.log(`  URL: ${url}`);

    // ページ取得を試みる
    let pageText = null;
    try {
      const result = await fetchHtml(url, { timeout: 10000 });
      if (result.ok) {
        pageText = stripTags(result.html).replace(/\n{3,}/g, "\n\n").trim();
        pageText = pageText.substring(0, 3000);
        console.log(`  取得: ${pageText.length}文字`);
      } else {
        console.log(`  取得失敗: ${result.error}`);
      }
    } catch (err) {
      console.log(`  取得失敗: ${err.message}`);
    }

    // シミュレーション抽出結果を生成
    const simResult = generateSimulationResult(domainId, item, pageText);

    // DB保存
    db.prepare(`
      INSERT INTO ai_extractions
        (domain_id, entity_type, entity_id, entity_slug, source_url, extraction_type,
         input_text_length, extracted_json, missing_fields, review_reasons,
         confidence_score, quality_level, summary_text, llm_model, llm_tokens_used, created_at)
      VALUES
        (@domainId, @entityType, @entityId, @entitySlug, @sourceUrl, 'detail_page',
         @inputLength, @extractedJson, @missingFields, @reviewReasons,
         @confidence, @quality, @summary, 'simulation', 0, datetime('now'))
    `).run({
      domainId,
      entityType: domainId === "food-recall" ? "food_recall_item" : "shitei_item",
      entityId: item.id,
      entitySlug: slug,
      sourceUrl: url,
      inputLength: pageText?.length || 0,
      extractedJson: JSON.stringify(simResult.data),
      missingFields: JSON.stringify(simResult.missingFields),
      reviewReasons: JSON.stringify(simResult.reviewReasons),
      confidence: simResult.confidence,
      quality: simResult.quality,
      summary: simResult.summary,
    });

    console.log(`  保存: confidence=${simResult.confidence} quality=${simResult.quality}`);
    console.log(`  不足項目: ${simResult.missingFields.join(", ") || "なし"}`);
    console.log("");
  }

  console.log("=== 完了 ===");
  showStatus(db);
}

/**
 * 実LLM呼び出しモード
 */
async function runRealExtraction(db, domainId, limit) {
  console.log(`\n=== AI抽出実行: ${domainId} (最大${limit}件) ===\n`);

  // Dynamic import to handle @/ alias in Next.js context
  // For standalone, we import the prompts directly
  const prompts = await getPrompts(domainId);

  const { fetchHtml } = await import("../lib/core/automation/fetch-helper.js");
  const { callLlm } = await import("../lib/llm-client.js");

  let items;
  if (domainId === "food-recall") {
    items = db.prepare("SELECT * FROM food_recall_items WHERE source_url IS NOT NULL AND source_url != '' ORDER BY id DESC LIMIT ?").all(limit);
  } else {
    items = db.prepare("SELECT * FROM shitei_items WHERE detail_url IS NOT NULL AND detail_url != '' AND is_published = 1 ORDER BY id DESC LIMIT ?").all(limit);
  }

  if (items.length === 0) {
    console.log("AI抽出対象のアイテムがありません");
    return;
  }

  console.log(`対象: ${items.length}件\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = domainId === "food-recall" ? item.source_url : item.detail_url;

    console.log(`[${i + 1}/${items.length}] ${domainId === "food-recall" ? item.product_name : item.title}`);
    console.log(`  URL: ${url}`);

    // ページ取得
    const result = await fetchHtml(url, { timeout: 15000 });
    if (!result.ok) {
      console.log(`  取得失敗: ${result.error}`);
      continue;
    }

    // 前処理
    let text = result.html;
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    const { stripTags } = await import("../lib/core/automation/fetch-helper.js");
    text = stripTags(text).replace(/\n{3,}/g, "\n\n").trim();
    if (text.length > 8000) text = text.substring(0, 8000) + "\n[...truncated]";

    console.log(`  テキスト: ${text.length}文字`);

    // LLM呼び出し
    try {
      const llmResult = await callLlm({
        systemPrompt: prompts.system,
        userPrompt: prompts.user.replace("{{CONTENT}}", text),
      });

      const extraction = parseResult(llmResult.text);
      const tokens = (llmResult.usage?.inputTokens || 0) + (llmResult.usage?.outputTokens || 0);

      // DB保存
      db.prepare(`
        INSERT INTO ai_extractions
          (domain_id, entity_type, entity_id, entity_slug, source_url, extraction_type,
           input_text_length, extracted_json, missing_fields, review_reasons,
           confidence_score, quality_level, summary_text, llm_model, llm_tokens_used, created_at)
        VALUES
          (@domainId, @entityType, @entityId, @entitySlug, @sourceUrl, 'detail_page',
           @inputLength, @extractedJson, @missingFields, @reviewReasons,
           @confidence, @quality, @summary, @model, @tokens, datetime('now'))
      `).run({
        domainId,
        entityType: domainId === "food-recall" ? "food_recall_item" : "shitei_item",
        entityId: item.id,
        entitySlug: item.slug,
        sourceUrl: url,
        inputLength: text.length,
        extractedJson: JSON.stringify(extraction.data),
        missingFields: JSON.stringify(extraction.missingFields),
        reviewReasons: JSON.stringify(extraction.reviewReasons),
        confidence: extraction.confidence,
        quality: extraction.quality,
        summary: extraction.summary,
        model: llmResult.model || "unknown",
        tokens,
      });

      console.log(`  抽出成功: confidence=${extraction.confidence} tokens=${tokens}`);
      console.log(`  要約: ${extraction.summary || "—"}`);
      console.log(`  不足: ${extraction.missingFields.join(", ") || "なし"}`);
    } catch (err) {
      console.log(`  LLMエラー: ${err.message}`);
    }
    console.log("");
  }

  console.log("=== 完了 ===");
  showStatus(db);
}

function getPrompts(domainId) {
  if (domainId === "food-recall") {
    return {
      system: `あなたは食品リコール情報の構造化抽出アシスタントです。与えられたテキストから主要項目をJSON形式で抽出してください。出力は {"data":{...},"summary":"...","missing_fields":[...],"review_reasons":[...],"confidence":0.8} の形式で。`,
      user: `以下のリコール情報から構造化データを抽出してください。\n\n{{CONTENT}}`,
    };
  }
  return {
    system: `あなたは自治体公募情報の構造化抽出アシスタントです。与えられたテキストから主要項目をJSON形式で抽出してください。出力は {"data":{...},"summary":"...","missing_fields":[...],"review_reasons":[...],"confidence":0.8} の形式で。`,
    user: `以下の公募情報から構造化データを抽出してください。\n\n{{CONTENT}}`,
  };
}

function parseResult(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return {
        data: parsed.data || parsed,
        missingFields: parsed.missing_fields || [],
        reviewReasons: parsed.review_reasons || [],
        confidence: parsed.confidence || 0.5,
        quality: parsed.confidence >= 0.7 ? "good" : "draft",
        summary: parsed.summary || null,
      };
    } catch { /* fallthrough */ }
  }
  return { data: { raw: text }, missingFields: ["json_parse"], reviewReasons: ["JSON解析失敗"], confidence: 0.3, quality: "raw", summary: text.substring(0, 100) };
}

/**
 * シミュレーション結果生成（LLM未設定時）
 */
function generateSimulationResult(domainId, item, pageText) {
  if (domainId === "food-recall") {
    const missing = [];
    if (!item.lot_number) missing.push("lot_number");
    if (!item.consumer_action) missing.push("consumer_action");
    if (!item.affected_area) missing.push("affected_area");
    return {
      data: {
        product_name: item.product_name,
        manufacturer: item.manufacturer,
        category: item.category,
        reason: item.reason,
        risk_level: item.risk_level,
        recall_date: item.recall_date,
        status: item.status,
        _page_available: !!pageText,
        _page_length: pageText?.length || 0,
      },
      missingFields: missing,
      reviewReasons: missing.length > 0 ? ["詳細ページから追加情報の補完が必要"] : [],
      confidence: pageText ? 0.7 : 0.4,
      quality: pageText ? "draft" : "minimal",
      summary: `${item.manufacturer || ""}「${item.product_name}」の${item.recall_type === "recall" ? "リコール" : "自主回収"}情報。`,
    };
  }
  // shitei
  const missing = [];
  if (!item.application_deadline) missing.push("application_deadline");
  if (!item.eligibility) missing.push("eligibility");
  if (!item.application_method) missing.push("application_method");
  if (!item.facility_name) missing.push("facility_name");
  return {
    data: {
      title: item.title,
      municipality_name: item.municipality_name,
      facility_category: item.facility_category,
      recruitment_status: item.recruitment_status,
      _page_available: !!pageText,
      _page_length: pageText?.length || 0,
    },
    missingFields: missing,
    reviewReasons: missing.length > 0 ? ["公募詳細ページから追加情報の補完が必要"] : [],
    confidence: pageText ? 0.6 : 0.3,
    quality: pageText ? "draft" : "minimal",
    summary: `${item.municipality_name || ""}「${item.title}」の公募情報。`,
  };
}

function showStatus(db) {
  const total = db.prepare("SELECT COUNT(*) as c FROM ai_extractions").get().c;
  const byDomain = db.prepare("SELECT domain_id, COUNT(*) as c, AVG(confidence_score) as avg_conf FROM ai_extractions GROUP BY domain_id").all();
  const byQuality = db.prepare("SELECT quality_level, COUNT(*) as c FROM ai_extractions GROUP BY quality_level").all();

  console.log(`\n=== AI抽出結果サマリー ===`);
  console.log(`総件数: ${total}`);
  if (byDomain.length > 0) {
    console.log(`\nドメイン別:`);
    byDomain.forEach(d => console.log(`  ${d.domain_id}: ${d.c}件 (avg confidence: ${d.avg_conf?.toFixed(2) || "—"})`));
  }
  if (byQuality.length > 0) {
    console.log(`\n品質レベル別:`);
    byQuality.forEach(q => console.log(`  ${q.quality_level}: ${q.c}件`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
