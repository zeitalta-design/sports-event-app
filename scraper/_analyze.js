const cheerio = require("../web/node_modules/cheerio");
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/_sample_list.html", "utf-8");
const $ = cheerio.load(html);

console.log("=== Page structure ===");
console.log("Title:", $("title").text().trim());

// Look for links containing competitionDetail
const detailLinks = $("a[href*=competitionDetail]");
console.log("\nDetail links count:", detailLinks.length);

if (detailLinks.length > 0) {
  detailLinks.slice(0, 3).each((i, el) => {
    const a = $(el);
    console.log("\n--- Link", i + 1, "---");
    console.log("href:", a.attr("href"));
    console.log("text:", a.text().trim().substring(0, 100));
    // Walk up parents
    let parent = a.parent();
    for (let j = 0; j < 6; j++) {
      if (parent.length) {
        const tag = parent.prop("tagName");
        const cls = parent.attr("class") || "";
        const id = parent.attr("id") || "";
        console.log("  parent" + j + ":", tag, cls ? "." + cls : "", id ? "#" + id : "");
        parent = parent.parent();
      }
    }
  });
}

// Look at surrounding HTML of first detail link
if (detailLinks.length > 0) {
  const firstLink = detailLinks.first();
  // Find the containing block
  let container = firstLink.closest("li, tr, div.race, div.event, article");
  if (!container.length) {
    container = firstLink.parent().parent().parent();
  }
  console.log("\n=== First event container HTML (trimmed) ===");
  const containerHtml = container.html();
  if (containerHtml) {
    console.log(containerHtml.substring(0, 2000));
  }
}

// Look for pagination
const pageLinks = $("a[href*=pageIndex]");
console.log("\n=== Pagination ===");
console.log("Page links:", pageLinks.length);
if (pageLinks.length > 0) {
  pageLinks.slice(0, 5).each((i, el) => {
    console.log("  ", $(el).attr("href"), $(el).text().trim());
  });
}

// Search for race listing wrappers
console.log("\n=== Potential containers ===");
["table", "ul", "ol", "div"].forEach(tag => {
  $(tag).each((i, el) => {
    const cls = $(el).attr("class") || "";
    const id = $(el).attr("id") || "";
    const links = $(el).find("a[href*=competitionDetail]").length;
    if (links >= 3) {
      console.log(`${tag} .${cls} #${id} -> ${links} race links`);
    }
  });
});
