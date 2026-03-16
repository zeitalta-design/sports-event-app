/**
 * RUNNET 詳細ページスクレイプ実行スクリプト
 *
 * Usage:
 *   node scripts/scrape-runnet-detail.js                  # 全RUNNET (デフォルト上限20)
 *   node scripts/scrape-runnet-detail.js --limit 5        # 上限5件
 *   node scripts/scrape-runnet-detail.js --id 7           # events.id=7 のみ
 *   node scripts/scrape-runnet-detail.js --only-missing   # 詳細未取得のみ
 *   node scripts/scrape-runnet-detail.js --all            # 全件
 */

const { fetchDetails } = require("../scraper/runnet/fetch-detail");
const { parseDetail } = require("../scraper/runnet/parse-detail");
const { importDetail, getTargetEvents } = require("../scraper/runnet/import-detail");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--id" && args[i + 1]) {
      options.id = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--only-missing") {
      options.onlyMissing = true;
    } else if (args[i] === "--all") {
      options.limit = null;
    }
  }

  // Default limit
  if (!options.id && options.limit === undefined) {
    options.limit = 20;
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("=== RUNNET Detail Scraper ===");
  console.log("Options:", JSON.stringify(options));
  console.log("");

  // 1. Get target events
  console.log("[1/3] Getting target events...");
  const targets = getTargetEvents(options);
  console.log(`  Found ${targets.length} events to process`);

  if (targets.length === 0) {
    console.log("No events to process. Done.");
    return;
  }

  // 2. Fetch detail pages
  console.log("\n[2/3] Fetching detail pages...");
  const fetchResults = await fetchDetails(targets);

  // 3. Parse and import
  console.log("\n[3/3] Parsing and importing...");
  let successCount = 0;
  let failCount = 0;
  let totalRaces = 0;

  for (const { event, html, error } of fetchResults) {
    if (!html) {
      console.log(`  SKIP ${event.source_event_id} (${event.title?.substring(0, 30)}): ${error || "no HTML"}`);
      failCount++;
      continue;
    }

    try {
      const parsed = parseDetail(html);
      const result = importDetail(event.id, parsed.eventUpdate, parsed.races);
      totalRaces += result.racesInserted;
      successCount++;
      console.log(`  OK ${event.source_event_id}: ${result.fieldsUpdated} fields, ${result.racesInserted} races`);
    } catch (err) {
      console.error(`  ERROR ${event.source_event_id}: ${err.message}`);
      failCount++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  Processed: ${targets.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total races inserted: ${totalRaces}`);
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
