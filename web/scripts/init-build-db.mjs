/**
 * Docker ビルド時に SSG に必要な空 DB を初期化するスクリプト
 * getDb() を呼ぶだけで全テーブルが作成される
 */
import { getDb } from "../lib/db.js";
const db = getDb();
console.log("Build DB initialized");
