const cheerio = require("../web/node_modules/cheerio");
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/_sample_list.html", "utf-8");
const $ = cheerio.load(html);

// Parse each event item
const items = $("#listGroup > li.item");
console.log("Total items:", items.length);

items.slice(0, 3).each((i, el) => {
  const item = $(el);
  console.log("\n===== Event", i + 1, "=====");

  // Title & URL
  const titleLink = item.find(".item-title a");
  console.log("Title:", titleLink.text().trim());
  const href = titleLink.attr("href") || "";
  console.log("URL:", href);
  const raceIdMatch = href.match(/raceId=(\d+)/);
  console.log("RaceID:", raceIdMatch ? raceIdMatch[1] : "N/A");

  // Place
  console.log("Place:", item.find("p.place").text().trim());

  // Date
  console.log("Date:", item.find("p.date").text().trim());

  // Description
  console.log("Description:", item.find("p.tourDetail").text().trim().substring(0, 100));

  // Image
  const img = item.find(".photo img");
  console.log("Image:", img.attr("src") || "N/A");

  // Entry status
  const entryBtns = item.find("p.entryBtns");
  console.log("EntryBtns HTML:", entryBtns.html()?.substring(0, 200) || "N/A");

  // Entry period
  const entryPeriod = item.find(".entry-period, .entryPeriod, .term");
  console.log("Entry period:", entryPeriod.text().trim().substring(0, 100));

  // Tags / icons
  const icons = item.find(".title_icon_area span");
  const iconClasses = [];
  icons.each((j, ic) => iconClasses.push($(ic).attr("class")));
  console.log("Icons:", iconClasses.join(", "));

  // All text content for debugging
  console.log("--- Full text ---");
  console.log(item.text().replace(/\s+/g, " ").trim().substring(0, 300));
});

// Check entry status patterns
console.log("\n\n===== Entry status patterns =====");
items.each((i, el) => {
  const item = $(el);
  const title = item.find(".item-title a").text().trim();
  const btnText = item.find("p.entryBtns").text().trim();
  const statusText = item.find(".entry-status, .status, .entryStatus").text().trim();
  if (i < 10) {
    console.log(`[${i}] "${title.substring(0, 30)}" -> btns: "${btnText.substring(0, 50)}" status: "${statusText}"`);
  }
});
