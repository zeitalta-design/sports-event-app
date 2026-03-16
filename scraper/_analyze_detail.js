/**
 * RUNNET 詳細ページの HTML 構造を調査
 */
const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const cheerio = webRequire("cheerio");

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchAndAnalyze(url, label) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Fetching ${label}: ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "ja,en;q=0.9",
    },
  });

  if (!res.ok) {
    console.log(`HTTP ${res.status}`);
    return;
  }

  const html = await res.text();
  console.log(`HTML size: ${html.length} bytes`);

  // Save for reference
  fs.writeFileSync(path.join(__dirname, `_sample_detail_${label}.html`), html);

  const $ = cheerio.load(html);

  console.log("\nTitle:", $("title").text().trim());

  // Look for race/event title
  console.log("\n--- Event Title ---");
  ["h1", "h2", ".race-title", ".event-title", "#raceName", ".raceName", ".title"].forEach(sel => {
    const el = $(sel);
    if (el.length) console.log(`  ${sel}: "${el.first().text().trim().substring(0, 80)}"`);
  });

  // Look for tables (race info)
  console.log("\n--- Tables ---");
  $("table").each((i, el) => {
    const cls = $(el).attr("class") || "";
    const id = $(el).attr("id") || "";
    const rows = $(el).find("tr").length;
    const headerText = $(el).find("th").map((j, th) => $(th).text().trim()).get().join(" | ");
    console.log(`  table[${i}] .${cls} #${id} rows=${rows}`);
    if (headerText) console.log(`    headers: ${headerText.substring(0, 200)}`);
  });

  // Look for description / overview
  console.log("\n--- Description area ---");
  [".outline", ".description", ".overview", ".detail", "#outline", ".race-outline", ".tourDetail", ".comment", ".raceInfo"].forEach(sel => {
    const el = $(sel);
    if (el.length) console.log(`  ${sel}: "${el.first().text().trim().substring(0, 200)}"`);
  });

  // Look for entry period / dates
  console.log("\n--- Entry info ---");
  const bodyText = $("body").text();
  ["エントリー", "受付期間", "申込期間", "申込締切", "entry", "参加費", "定員"].forEach(keyword => {
    const idx = bodyText.indexOf(keyword);
    if (idx > -1) {
      console.log(`  "${keyword}" found at ${idx}: ...${bodyText.substring(idx, idx + 100).replace(/\s+/g, " ")}...`);
    }
  });

  // Look for venue / location
  console.log("\n--- Venue ---");
  [".place", ".venue", ".location", ".area"].forEach(sel => {
    const el = $(sel);
    if (el.length) console.log(`  ${sel}: "${el.first().text().trim().substring(0, 100)}"`);
  });

  // Look for images
  console.log("\n--- Images ---");
  $("img").each((i, el) => {
    const src = $(el).attr("src") || "";
    if (src.includes("race") || src.includes("event") || src.includes("hero") || src.includes("main")) {
      console.log(`  img: ${src}`);
    }
  });

  // Look for official URL
  console.log("\n--- Links ---");
  $("a").each((i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (text.includes("公式") || text.includes("official") || text.includes("ホームページ") || text.includes("大会HP")) {
      console.log(`  link: "${text}" -> ${href}`);
    }
  });

  // Dump key sections
  console.log("\n--- Main content structure ---");
  ["#contents", "#main", ".contents", ".main", "#content", ".content-area"].forEach(sel => {
    const el = $(sel);
    if (el.length) {
      console.log(`  ${sel} found, children:`);
      el.children().each((i, child) => {
        const tag = $(child).prop("tagName");
        const cls = $(child).attr("class") || "";
        const id = $(child).attr("id") || "";
        const text = $(child).text().trim().substring(0, 80);
        if (i < 20) console.log(`    ${tag} .${cls} #${id}: "${text}"`);
      });
    }
  });
}

async function main() {
  // competition type
  await fetchAndAnalyze(
    "https://runnet.jp/entry/runtes/user/pc/competitionDetailAction.do?raceId=382214&div=1",
    "competition"
  );

  // moshicom type
  await fetchAndAnalyze(
    "https://runnet.jp/entry/runtes/user/pc/moshicomDetailAction.do?raceId=139753&div=1",
    "moshicom"
  );
}

main().catch(console.error);
