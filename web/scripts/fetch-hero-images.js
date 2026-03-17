#!/usr/bin/env node
/**
 * ヒーロー画像候補取得・選別スクリプト
 *
 * Usage:
 *   node scripts/fetch-hero-images.js                    # 全スライドの候補取得
 *   node scripts/fetch-hero-images.js --slide entry-open # 特定スライドのみ
 *   node scripts/fetch-hero-images.js --dry-run          # 取得のみ、保存しない
 *   node scripts/fetch-hero-images.js --activate         # 最高スコアを active に
 *   node scripts/fetch-hero-images.js --limit 10         # クエリあたりの取得件数
 *   node scripts/fetch-hero-images.js --report           # 現在の状態レポート
 *   node scripts/fetch-hero-images.js --download         # approved 画像をダウンロード
 *
 * 環境変数:
 *   UNSPLASH_ACCESS_KEY — Unsplash API キー（.env.local に設定）
 */

import "dotenv/config";
import { existsSync, mkdirSync, createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";

import { fetchCandidates, ALL_SLIDE_KEYS, SLIDE_SEARCH_THEMES } from "../lib/hero-image-sources.js";
import {
  rankCandidates,
  loadStore,
  saveStore,
  addCandidatesToStore,
  activateBest,
  SCORE_THRESHOLD,
} from "../lib/hero-image-selector.js";

// ─── CLI 引数パース ──────────────────────

const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes("--dry-run"),
  activate: args.includes("--activate"),
  report: args.includes("--report"),
  download: args.includes("--download"),
  slide: getArgValue("--slide"),
  limit: parseInt(getArgValue("--limit") || "5"),
};

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const targetSlides = flags.slide ? [flags.slide] : ALL_SLIDE_KEYS;

// ─── レポート表示 ──────────────────────

if (flags.report) {
  const store = loadStore();
  console.log("\n📊 ヒーロー画像ステータスレポート");
  console.log("=".repeat(60));
  console.log(`更新日時: ${store.updatedAt || "未取得"}\n`);

  for (const key of ALL_SLIDE_KEYS) {
    const slide = store.slides[key];
    const theme = SLIDE_SEARCH_THEMES[key];
    console.log(`\n🖼  ${theme.label} (${key})`);
    console.log("-".repeat(50));

    if (slide.active) {
      console.log(`  ✅ Active: ${slide.active.id}`);
      console.log(`     スコア: ${slide.active.score}点`);
      console.log(`     撮影者: ${slide.active.photographer}`);
      console.log(`     パス: ${slide.active.localPath}`);
      console.log(`     採用日: ${slide.active.activatedAt}`);
    } else {
      console.log("  ⬜ Active: なし（グラデーションフォールバック中）");
    }

    const approved = slide.candidates.filter((c) => c.status === "approved");
    const candidates = slide.candidates.filter((c) => c.status === "candidate");
    console.log(`  📋 候補: ${slide.candidates.length}件 (approved: ${approved.length}, below: ${candidates.length})`);

    if (approved.length > 0) {
      console.log("  上位 approved:");
      for (const c of approved.slice(0, 3)) {
        const dl = c.localPath ? "✅" : "⬜";
        console.log(`    ${dl} ${c.score}点 | ${c.id} | ${c.photographer}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  process.exit(0);
}

// ─── メイン処理 ──────────────────────

async function main() {
  console.log("\n🔍 ヒーロー画像候補取得");
  console.log(`   対象: ${targetSlides.join(", ")}`);
  console.log(`   モード: ${flags.dryRun ? "dry-run" : "保存"}${flags.activate ? " + activate" : ""}${flags.download ? " + download" : ""}`);
  console.log(`   クエリあたり取得数: ${flags.limit}`);
  console.log("");

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.error("❌ UNSPLASH_ACCESS_KEY が未設定です。");
    console.error("   .env.local に以下を追加してください:");
    console.error("   UNSPLASH_ACCESS_KEY=your_access_key_here");
    console.error("   https://unsplash.com/developers で取得可能です。");
    process.exit(1);
  }

  const store = flags.dryRun ? loadStore() : loadStore();

  for (const slideKey of targetSlides) {
    const theme = SLIDE_SEARCH_THEMES[slideKey];
    if (!theme) {
      console.warn(`⚠ Unknown slide: ${slideKey}`);
      continue;
    }

    console.log(`\n${"─".repeat(50)}`);
    console.log(`🖼  ${theme.label} (${slideKey})`);
    console.log(`${"─".repeat(50)}`);

    // 1. 候補取得
    console.log("\n  📡 候補取得中...");
    let candidates;
    try {
      candidates = await fetchCandidates(slideKey, { perQuery: flags.limit });
      console.log(`  → ${candidates.length}件の候補を取得`);
    } catch (err) {
      console.error(`  ❌ 取得失敗: ${err.message}`);
      continue;
    }

    if (candidates.length === 0) {
      console.log("  → 候補なし。スキップ。");
      continue;
    }

    // 2. スコアリング
    console.log("\n  🎯 スコアリング...");
    const result = rankCandidates(candidates, slideKey);

    console.log(`  → 候補 ${result.totalCandidates}件`);
    console.log(`  → 採用可能 ${result.approvedCount}件 (≥${SCORE_THRESHOLD}点)`);
    console.log(`  → 除外 ${result.rejected.length}件`);
    console.log(`  → 最高スコア ${result.bestScore}点`);

    // 上位表示
    if (result.approved.length > 0) {
      console.log("\n  📋 上位候補:");
      for (const r of result.approved.slice(0, 5)) {
        console.log(`    ${r.score}点 | ${r.candidate.id}`);
        console.log(`         ${r.candidate.photographer} | ${r.candidate.width}x${r.candidate.height}`);
        console.log(`         理由: ${r.reasons.slice(0, 3).join(", ")}`);
      }
    }

    if (result.belowThreshold.length > 0) {
      console.log(`\n  ⚠ 閾値未満 (上位${Math.min(3, result.belowThreshold.length)}件):`);
      for (const r of result.belowThreshold.slice(0, 3)) {
        console.log(`    ${r.score}点 | ${r.candidate.id} | ${r.reasons.slice(0, 2).join(", ")}`);
      }
    }

    // 3. ストアに保存
    if (!flags.dryRun) {
      addCandidatesToStore(store, slideKey, [...result.approved, ...result.belowThreshold]);
      console.log(`\n  💾 ${result.approved.length + result.belowThreshold.length}件をストアに保存`);
    }
  }

  // 4. ダウンロード
  if (flags.download && !flags.dryRun) {
    console.log("\n\n📥 画像ダウンロード");
    console.log("=".repeat(50));

    const generatedDir = join(process.cwd(), "public", "hero", "generated");
    if (!existsSync(generatedDir)) mkdirSync(generatedDir, { recursive: true });

    for (const slideKey of targetSlides) {
      const slide = store.slides[slideKey];
      const best = slide.candidates.find(
        (c) => c.status === "approved" && c.score >= SCORE_THRESHOLD
      );
      if (!best) {
        console.log(`  ⬜ ${slideKey}: 採用可能な候補なし`);
        continue;
      }

      const filename = `${slideKey}.jpg`;
      const localPath = join(generatedDir, filename);
      const relativePath = `/hero/generated/${filename}`;

      console.log(`  ⬇ ${slideKey}: ${best.id} (${best.score}点)`);
      try {
        const res = await fetch(best.downloadUrl || best.remoteUrl, {
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fileStream = createWriteStream(localPath);
        await pipeline(res.body, fileStream);

        best.localPath = relativePath;
        console.log(`    ✅ 保存: ${relativePath}`);
      } catch (err) {
        console.error(`    ❌ ダウンロード失敗: ${err.message}`);
      }

      // API レートリミット対策
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 5. アクティベーション
  if (flags.activate && !flags.dryRun) {
    console.log("\n\n🔄 アクティベーション");
    console.log("=".repeat(50));

    for (const slideKey of targetSlides) {
      const activated = activateBest(store, slideKey);
      if (activated) {
        console.log(`  ✅ ${slideKey}: ${activated.id} (${activated.score}点) → active`);
      } else {
        console.log(`  ⬜ ${slideKey}: 採用可能な候補なし（ダウンロード済みが必要）`);
      }
    }
  }

  // 6. ストア保存
  if (!flags.dryRun) {
    saveStore(store);
    console.log("\n💾 データ保存完了: data/hero-images.json");
  }

  console.log("\n✅ 完了\n");
}

main().catch((err) => {
  console.error("\n❌ エラー:", err.message);
  process.exit(1);
});
