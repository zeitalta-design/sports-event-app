/**
 * Resolver 本体 — 企業名を canonical entity に解決する
 *
 * 4 層の判定（Layer 1-3 は決定論的、Layer 4 は LLM 予約）:
 *   Layer 1: 法人番号一致（入力側 or gBizINFO から取得）
 *   Layer 2: normalized_key 完全一致
 *   Layer 3: normalized_key の fuzzy 一致（Levenshtein similarity >= threshold）
 *   Layer 4: LLM 判定 ← 未実装（必要になったら追加）
 *
 * 設計:
 *   - 判定ロジック自体は純関数に近づけるため normalize.js に切出し済
 *   - DB アクセスは cache 付きの DataStore オブジェクトに集約
 *   - 全ての判定は resolution_scores に記録（再実行の安定性確認用）
 */
import { getDb } from "@/lib/db";
import {
  canonicalizeCompanyName,
  normalizeCompanyKey,
  similarity,
} from "./normalize.js";
import { lookupCorporateNumber } from "./gbizinfo.js";

/** fuzzy 判定のデフォルト閾値 */
export const DEFAULT_FUZZY_THRESHOLD = 0.90;

/**
 * Resolver の公開 API
 *
 * @param {object} input
 * @param {string}  input.name                入力企業名（raw）
 * @param {string} [input.corporateNumber]    既知の法人番号があれば
 * @param {string} [input.prefecture]         都道府県（同名異社の識別に使用）
 *
 * @param {object} [opts]
 * @param {object} [opts.store]               DataStore（省略時は getDb() から生成）
 * @param {number} [opts.fuzzyThreshold]      0.0〜1.0
 * @param {boolean}[opts.useGbizinfo]         Layer 1 で gBizINFO を叩くか（既定: false）
 * @param {Function}[opts.logger]
 *
 * @returns {Promise<{
 *   entityId: number,
 *   canonicalName: string,
 *   corporateNumber: string|null,
 *   layer: "corp_number"|"normalized"|"fuzzy"|"new",
 *   score: number|null,
 *   created: boolean
 * }>}
 */
export async function resolveEntity(input, opts = {}) {
  if (!input || !input.name) {
    throw new TypeError("resolveEntity: input.name is required");
  }
  const store = opts.store || createDataStore();
  const threshold = opts.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
  const logger = opts.logger || (() => {});

  const rawName = String(input.name).trim();
  const prefecture = input.prefecture || null;
  const canonicalName = canonicalizeCompanyName(rawName);
  const normalizedKey = normalizeCompanyKey(rawName);
  if (!normalizedKey) {
    throw new Error("resolveEntity: name is empty after normalization");
  }

  let corporateNumber = input.corporateNumber || null;

  // ─── Layer 1: 法人番号一致 ──────────────────────
  // (a) 既知の法人番号が渡されていればそれで lookup
  if (corporateNumber) {
    const hit = store.findByCorporateNumber(corporateNumber);
    if (hit) {
      store.recordAlias(hit.id, rawName, normalizedKey);
      store.logScore({ queryName: rawName, queryCorpNumber: corporateNumber, entityId: hit.id, layer: "corp_number", score: 1.0, detail: { via: "provided" } });
      return { entityId: hit.id, canonicalName: hit.canonical_name, corporateNumber: hit.corporate_number, layer: "corp_number", score: 1.0, created: false };
    }
  }

  // (b) gBizINFO で会社名→法人番号を取得（オプション）
  if (opts.useGbizinfo && !corporateNumber) {
    try {
      const g = await lookupCorporateNumber(rawName);
      if (g && g.corporateNumber) {
        corporateNumber = g.corporateNumber;
        const hit = store.findByCorporateNumber(corporateNumber);
        if (hit) {
          store.recordAlias(hit.id, rawName, normalizedKey);
          store.logScore({ queryName: rawName, queryCorpNumber: corporateNumber, entityId: hit.id, layer: "corp_number", score: 1.0, detail: { via: "gbizinfo" } });
          return { entityId: hit.id, canonicalName: hit.canonical_name, corporateNumber: hit.corporate_number, layer: "corp_number", score: 1.0, created: false };
        }
      }
    } catch (e) {
      logger(`[resolver] gbizinfo lookup failed: ${e.message}`);
    }
  }

  // ─── Layer 2: normalized_key 完全一致 ──────────
  const exact = store.findByNormalizedKey(normalizedKey, prefecture);
  if (exact) {
    // 既知法人番号が無ければ、この機に entity へ補完
    if (corporateNumber && !exact.corporate_number) {
      store.updateCorporateNumber(exact.id, corporateNumber);
    }
    store.recordAlias(exact.id, rawName, normalizedKey);
    store.logScore({ queryName: rawName, queryCorpNumber: corporateNumber, entityId: exact.id, layer: "normalized", score: 1.0, detail: { key: normalizedKey } });
    return { entityId: exact.id, canonicalName: exact.canonical_name, corporateNumber: exact.corporate_number || corporateNumber, layer: "normalized", score: 1.0, created: false };
  }

  // ─── Layer 3: fuzzy 一致 ────────────────────────
  const candidates = store.listCandidatesByPrefix(normalizedKey, prefecture);
  let best = null;
  for (const c of candidates) {
    const s = similarity(normalizedKey, c.normalized_key);
    if (s >= threshold && (!best || s > best.score)) best = { entity: c, score: s };
  }
  if (best) {
    if (corporateNumber && !best.entity.corporate_number) {
      store.updateCorporateNumber(best.entity.id, corporateNumber);
    }
    store.recordAlias(best.entity.id, rawName, normalizedKey);
    store.logScore({ queryName: rawName, queryCorpNumber: corporateNumber, entityId: best.entity.id, layer: "fuzzy", score: best.score, detail: { threshold, matched: best.entity.normalized_key } });
    return { entityId: best.entity.id, canonicalName: best.entity.canonical_name, corporateNumber: best.entity.corporate_number || corporateNumber, layer: "fuzzy", score: best.score, created: false };
  }

  // ─── 新規 entity 作成 ──────────────────────────
  const newId = store.createEntity({
    corporateNumber,
    canonicalName: canonicalName || rawName,
    normalizedKey,
    prefecture,
    source: corporateNumber ? "corp_number" : "normalized",
  });
  store.recordAlias(newId, rawName, normalizedKey);
  store.logScore({ queryName: rawName, queryCorpNumber: corporateNumber, entityId: newId, layer: "new", score: null, detail: { threshold } });
  return {
    entityId: newId,
    canonicalName: canonicalName || rawName,
    corporateNumber,
    layer: "new",
    score: null,
    created: true,
  };
}

// ─── DataStore: DB 操作 + in-memory cache ─────────────────────

/**
 * DataStore ファクトリ
 * 同一プロセス内の複数 resolveEntity 呼出しで共有するとキャッシュが効く。
 */
export function createDataStore(db = null) {
  const database = db || getDb();

  // キャッシュ: normalized_key 先頭2文字 -> 候補 entity 配列
  const candidateCache = new Map();

  const selectByCorp = database.prepare(
    "SELECT * FROM resolved_entities WHERE corporate_number = ?"
  );
  // 正規化キー完全一致（都道府県は最後に JS 側で絞り込む）
  const selectByKeyExact = database.prepare(
    "SELECT * FROM resolved_entities WHERE normalized_key = ?"
  );
  // 正規化キー前方一致で候補を取得（prefecture は JS 側でフィルタ）
  const selectCandidatesByPrefix = database.prepare(
    "SELECT * FROM resolved_entities WHERE normalized_key LIKE ?"
  );
  const insertEntity = database.prepare(`
    INSERT INTO resolved_entities (corporate_number, canonical_name, normalized_key, prefecture, source, created_at, updated_at)
    VALUES (@corporate_number, @canonical_name, @normalized_key, @prefecture, @source, datetime('now'), datetime('now'))
  `);
  const updateCorp = database.prepare(
    "UPDATE resolved_entities SET corporate_number = ?, updated_at = datetime('now') WHERE id = ? AND corporate_number IS NULL"
  );
  const selectAlias = database.prepare(
    "SELECT id FROM resolution_aliases WHERE raw_name = ?"
  );
  const insertAlias = database.prepare(`
    INSERT INTO resolution_aliases (entity_id, raw_name, normalized, first_seen, last_seen, seen_count)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)
  `);
  const bumpAlias = database.prepare(
    "UPDATE resolution_aliases SET seen_count = seen_count + 1, last_seen = datetime('now') WHERE id = ?"
  );
  const insertScore = database.prepare(`
    INSERT INTO resolution_scores (query_name, query_corp_number, entity_id, layer, score, detail, resolved_at)
    VALUES (@queryName, @queryCorpNumber, @entityId, @layer, @score, @detail, datetime('now'))
  `);

  return {
    findByCorporateNumber(corp) {
      if (!corp) return null;
      return selectByCorp.get(corp) || null;
    },

    findByNormalizedKey(key, pref = null) {
      if (!key) return null;
      const rows = selectByKeyExact.all(key);
      if (rows.length === 0) return null;
      if (rows.length === 1) return rows[0];
      // 複数 entity が同じ key を持つ場合のみ pref を tiebreak として使う
      if (pref) {
        const sameP = rows.find((r) => r.prefecture === pref);
        if (sameP) return sameP;
        const nullP = rows.find((r) => !r.prefecture);
        if (nullP) return nullP;
      }
      return rows[0];
    },

    /**
     * 正規化キーの先頭2文字でざっくり絞って返す（fuzzy の枝刈り）
     * 同一企業が複数県にまたがる前提で pref フィルタはかけない
     * （pref は最終判定の tiebreak として上位で使う）
     */
    listCandidatesByPrefix(key /* , pref */) {
      if (!key) return [];
      const prefix = (key.slice(0, 2) || "").replace(/[%_]/g, "") + "%";
      if (candidateCache.has(prefix)) return candidateCache.get(prefix);
      const rows = selectCandidatesByPrefix.all(prefix);
      candidateCache.set(prefix, rows);
      return rows;
    },

    createEntity({ corporateNumber, canonicalName, normalizedKey, prefecture, source }) {
      const r = insertEntity.run({
        corporate_number: corporateNumber || null,
        canonical_name:   canonicalName,
        normalized_key:   normalizedKey,
        prefecture:       prefecture || null,
        source:           source || null,
      });
      // キャッシュ無効化（当該 prefix のみ）
      const prefix = (normalizedKey.slice(0, 2) || "") + "%";
      for (const k of candidateCache.keys()) {
        if (k.startsWith(prefix.slice(0, prefix.length - 1))) candidateCache.delete(k);
      }
      return Number(r.lastInsertRowid);
    },

    updateCorporateNumber(entityId, corp) {
      updateCorp.run(corp, entityId);
    },

    recordAlias(entityId, rawName, normalized) {
      const existing = selectAlias.get(rawName);
      if (existing) {
        bumpAlias.run(existing.id);
      } else {
        insertAlias.run(entityId, rawName, normalized);
      }
    },

    logScore({ queryName, queryCorpNumber, entityId, layer, score, detail }) {
      try {
        insertScore.run({
          queryName,
          queryCorpNumber: queryCorpNumber || null,
          entityId: entityId ?? null,
          layer,
          score: score ?? null,
          detail: detail ? JSON.stringify(detail) : null,
        });
      } catch { /* log テーブル未マイグレなら無視 */ }
    },
  };
}
