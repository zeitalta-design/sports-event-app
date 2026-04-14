/**
 * Node.js ESM loader: `@/` alias を `../` (web/) に解決する（全CLIスクリプト共通）。
 *
 * Next.js/Webpack は jsconfig.json の paths で @ を解決するが、
 * Node.js CLIから `lib/*.js` を import すると内部の
 * `import { getDb } from "@/lib/db"` が解決できずエラーになる。
 * このloaderはその問題を回避する。
 *
 * 使用例（scripts配下の mjs スクリプトで）:
 *   import { register } from "node:module";
 *   register("./_alias-loader.mjs", import.meta.url);
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
