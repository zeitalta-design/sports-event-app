/**
 * RUNNET 共通HTTPクライアント
 * Cookie/セッション管理、ヘッダー設定を集約
 */

const path = require("path");
const fs = require("fs");

const BASE_URL = "https://runnet.jp";
const LIST_URL = `${BASE_URL}/entry/runtes/user/pc/RaceSearchZZSDetailAction.do`;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ja,en;q=0.9",
  Referer: `${BASE_URL}/runtes/`,
};

const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * .env.local から Cookie を読み込む
 * RUNNET_COOKIE=... の形式
 */
function loadCookieFromEnv() {
  // 環境変数から
  if (process.env.RUNNET_COOKIE) {
    return process.env.RUNNET_COOKIE;
  }

  // .env.local ファイルから
  const envPaths = [
    path.join(__dirname, "..", "..", ".env.local"),
    path.join(__dirname, "..", "..", "web", ".env.local"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^RUNNET_COOKIE=(.+)$/m);
      if (match) return match[1].trim();
    }
  }

  return null;
}

/**
 * セッション管理クラス
 * 1ページ目のレスポンスからCookieを自動取得し、後続ページに使用
 */
class RunnetSession {
  constructor(options = {}) {
    this.cookies = {};
    this.manualCookie = options.cookie || loadCookieFromEnv();
    this.headers = { ...DEFAULT_HEADERS, ...options.headers };
    this.verbose = options.verbose || false;
  }

  /**
   * Set-Cookie ヘッダーからCookieを抽出・保存
   */
  extractCookies(response) {
    const setCookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [];

    for (const cookieStr of setCookies) {
      const [nameValue] = cookieStr.split(";");
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx > -1) {
        const name = nameValue.substring(0, eqIdx).trim();
        const value = nameValue.substring(eqIdx + 1).trim();
        this.cookies[name] = value;
      }
    }

    if (this.verbose && setCookies.length > 0) {
      console.log(`    Received ${setCookies.length} cookies: ${Object.keys(this.cookies).join(", ")}`);
    }
  }

  /**
   * Cookie文字列を構築
   */
  getCookieString() {
    if (this.manualCookie) return this.manualCookie;

    const entries = Object.entries(this.cookies);
    if (entries.length === 0) return null;

    return entries.map(([k, v]) => `${k}=${v}`).join("; ");
  }

  /**
   * セッションが有効か（Cookieがあるか）
   */
  hasSession() {
    return !!this.manualCookie || Object.keys(this.cookies).length > 0;
  }

  /**
   * HTTP GET リクエスト
   */
  async get(url) {
    const headers = { ...this.headers };
    const cookieStr = this.getCookieString();
    if (cookieStr) {
      headers.Cookie = cookieStr;
    }

    const response = await fetch(url, { headers });

    // 自動Cookie抽出（手動Cookie未設定時のみ）
    if (!this.manualCookie) {
      this.extractCookies(response);
    }

    return response;
  }
}

module.exports = {
  RunnetSession,
  LIST_URL,
  BASE_URL,
  DELAY_MS,
  sleep,
  loadCookieFromEnv,
};
