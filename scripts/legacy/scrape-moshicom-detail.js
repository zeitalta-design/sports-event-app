/**
 * moshicom 詳細ページスクレイプ実行スクリプト
 *
 * Usage:
 *   node scripts/scrape-moshicom-detail.js                      # 全moshicom (デフォルト上限20)
 *   node scripts/scrape-moshicom-detail.js --limit 5            # 上限5件
 *   node scripts/scrape-moshicom-detail.js --id 25              # events.id=25 のみ
 *   node scripts/scrape-moshicom-detail.js --only-missing-races # race未登録のみ
 *   node scripts/scrape-moshicom-detail.js --all                # 全件
 */

const { fetchMoshicomDetails } = require("../scraper/moshicom/fetch-detail");
const { parseMoshicomDetail } = require("../scraper/moshicom/parse-detail");
const { importDetail, getMoshicomEvents } = require("../scraper/moshicom/import-detail");

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
    } else if (args[i] === "--only-missing-races") {
      options.onlyMissingRaces = true;
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

  console.log("=== Moshicom Detail Scraper ===");
  console.log("Options:", JSON.stringify(options));
  console.log("");

  // 1. Get target events
  console.log("[1/3] Getting moshicom target events...");
  const targets = getMoshicomEvents(options);
  console.log(`  Found ${targets.length} moshicom events to process`);

  if (targets.length === 0) {
    console.log("No moshicom events to process. Done.");
    return;
  }

  // 2. Fetch detail pages from moshicom.com
  console.log("\n[2/3] Fetching moshicom.com detail pages...");
  const fetchResults = await fetchMoshicomDetails(targets);

  // 3. Parse and import
  console.log("\n[3/3] Parsing and importing...");
  let successCount = 0;
  let failCount = 0;
  let totalRaces = 0;
  let noRaceCount = 0;

  for (const { event, html, error } of fetchResults) {
    if (!html) {
      console.log(`  SKIP ${event.source_event_id} (${event.title?.substring(0, 30)}): ${error || "no HTML"}`);
      failCount++;
      continue;
    }

    try {
      const parsed = parseMoshicomDetail(html);

      // official_url を設定
      parsed.eventUpdate.official_url = `https://moshicom.com/${event.source_event_id}`;

      const result = importDetail(event.id, parsed.eventUpdate, parsed.races);
      totalRaces += result.racesInserted;
      successCount++;

      if (parsed.races.length === 0) {
        noRaceCount++;
        console.log(`  OK ${event.source_event_id}: ${result.fieldsUpdated} fields, 0 races (no race data found on page)`);
      } else {
        console.log(`  OK ${event.source_event_id}: ${result.fieldsUpdated} fields, ${result.racesInserted} races`);
        parsed.races.forEach((r) => {
          console.log(`    - ${r.race_name} | ${r.race_type} | ${r.distance_km || "-"}km | ¥${r.fee_min || "-"}`);
        });
      }
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
  if (noRaceCount > 0) {
    console.log(`  Events with no race data: ${noRaceCount}`);
  }
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
