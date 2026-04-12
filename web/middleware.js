import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * middleware
 *
 * 1. /admin/ 配下 → セッション認証（未ログインは /login へリダイレクト）
 * 2. メンテナンスパス → 503
 */

// ════════════════════════════════════════
// セッション検証（Edge Runtimeで使える範囲）
// ════════════════════════════════════════

const SESSION_COOKIE = "mvp_session";

function getSessionSecret() {
  return process.env.SESSION_SECRET || "dev-only-insecure-fallback-key-do-not-use-in-production";
}

/**
 * Edge Runtime対応: セッショントークンの署名を検証
 * lib/auth.js の verifySignedToken と同等ロジック
 */
function verifySessionSignature(signedToken) {
  if (!signedToken || typeof signedToken !== "string") return false;

  const lastDot = signedToken.lastIndexOf(".");
  if (lastDot === -1) {
    // 署名なし旧形式 — 開発環境のみ許容
    return process.env.NODE_ENV !== "production";
  }

  const token = signedToken.slice(0, lastDot);
  const sig = signedToken.slice(lastDot + 1);

  const hmac = crypto.createHmac("sha256", getSessionSecret());
  hmac.update(token);
  const expected = hmac.digest("hex").slice(0, 16);

  if (sig.length !== expected.length) return false;
  try {
    const sigBuf = Buffer.from(sig, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ════════════════════════════════════════
// メンテナンスモード
// ════════════════════════════════════════

const MAINTENANCE_ENABLED = true;

const MAINTENANCE_PATHS = new Set([
  "/marathon", "/trail", "/cycling", "/triathlon", "/walking",
  "/golf", "/swimming", "/squash", "/workshop", "/search", "/entry-deadlines",
  "/marathon/theme/beginner", "/marathon/theme/sightseeing", "/marathon/theme/family",
  "/marathon/prefecture/tokyo", "/marathon/prefecture/kanagawa", "/marathon/prefecture/osaka",
  "/marathon/prefecture/chiba", "/marathon/prefecture/saitama",
  "/marathon/distance/full", "/marathon/distance/half", "/marathon/distance/10km",
  "/marathon/month/4", "/marathon/month/5", "/marathon/month/6",
  "/marathon/month/10", "/marathon/month/11",
]);

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>メンテナンス中 | 大海ナビ</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
      background: #f7f8fa; color: #333; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .container { text-align: center; max-width: 520px; padding: 48px 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.8; color: #666; }
    .brand { margin-top: 40px; font-size: 13px; color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>現在メンテナンス中です</h1>
    <p>対象ページは一時的に公開を停止しています。<br>再開までしばらくお待ちください。</p>
    <div class="brand">大海ナビ — taikainavi.jp</div>
  </div>
</body>
</html>`;

// ════════════════════════════════════════
// Middleware 本体
// ════════════════════════════════════════

export function middleware(request) {
  let pathname = request.nextUrl.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // ──── 1. /admin/ 配下の認証保護 ────
  if (pathname.startsWith("/admin")) {
    // /admin/login 自体は除外（ログインページがあれば）
    // API routes（/api/admin/...）は除外（requireAdminApiで保護済み）
    // ここではページのみ保護

    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    if (!sessionCookie || !verifySessionSignature(sessionCookie)) {
      // 未ログイン → /login にリダイレクト（returnToパラメータ付き）
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("denied", "1");
      return NextResponse.redirect(loginUrl);
    }

    // セッションはあるがrole確認はEdge Runtimeでは困難（DB参照不可）
    // → Server Component（admin/layout.js）で role=admin を最終確認
    return NextResponse.next();
  }

  // ──── 2. メンテナンスモード ────
  if (MAINTENANCE_ENABLED && MAINTENANCE_PATHS.has(pathname)) {
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "86400",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return NextResponse.next();
}

// ════════════════════════════════════════
// matcher
// ════════════════════════════════════════

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|hero/|icons/|og/|screenshots/).*)",
  ],
};
