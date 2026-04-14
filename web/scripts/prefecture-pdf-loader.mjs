/**
 * Node.js ESM loader: `@/` alias を `../` (web/) に解決する
 *
 * Next.js/Webpack は jsconfig.json の paths で @ を解決するが、
 * Node.js CLIから lib/prefecture-scraper.js を import すると
 * 内部の `import { getDb } from "@/lib/db"` が解決できずエラーになる。
 * このloaderはその問題を回避する。
 *
 * 拡張子は ESM 仕様上必須なので、拡張子未指定なら .js を補う。
 */
const ROOT = new URL("../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let resolved = new URL(specifier.slice(2), ROOT).href;
    // 拡張子補完（.js / .mjs / .json 以外なら .js を付与）
    if (!/\.(m?js|json|node)$/.test(resolved)) {
      resolved += ".js";
    }
    return nextResolve(resolved, context);
  }
  return nextResolve(specifier, context);
}
