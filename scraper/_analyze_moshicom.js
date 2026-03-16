const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");
const webRequire = createRequire(path.join(__dirname, "..", "web", "package.json"));
const cheerio = webRequire("cheerio");
const html = fs.readFileSync(path.join(__dirname, "_sample_detail_moshicom.html"), "utf-8");
const $ = cheerio.load(html);

console.log("Title:", $("h2").first().text().trim());
console.log("Has #entryDetail:", $("#entryDetail").length);
console.log("Has #entrydMainL:", $("#entrydMainL").length);
console.log("Has .entry-body:", $(".entry-body").length);
console.log("Has .eTabTbl:", $(".eTabTbl").length);

// Look for moshicom link
$("a").each((i, el) => {
  const href = $(el).attr("href") || "";
  if (href.includes("moshicom")) {
    console.log("moshicom link:", href, $(el).text().trim().substring(0, 80));
  }
});

// Check #entryDetail children
console.log("\n#entryDetail children:");
$("#entryDetail").children().each((i, el) => {
  const tag = $(el).prop("tagName");
  const cls = $(el).attr("class") || "";
  const id = $(el).attr("id") || "";
  console.log(`  ${tag} .${cls} #${id}: ${$(el).text().trim().substring(0, 100)}`);
});

// Check #entrydMainL
console.log("\n#entrydMainL items:");
$("#entrydMainL > li").each((i, el) => {
  const title = $(el).find(".entryT").first().text().trim();
  const data = $(el).find(".entryD").first().text().trim().substring(0, 150);
  console.log(`  [${i}] ${title}: ${data}`);
});

// Description
console.log("\nmeta description:", $('meta[name="description"]').attr("content")?.substring(0, 200));
