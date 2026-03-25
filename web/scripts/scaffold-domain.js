#!/usr/bin/env node

/**
 * Domain Scaffold — 新規ドメインを最小工数で追加する自動生成スクリプト
 *
 * 使い方:
 *   node scripts/scaffold-domain.js <key> <name> [options]
 *
 * 例:
 *   node scripts/scaffold-domain.js nyusatsu 入札ナビ --item 案件 --provider 発注機関
 *   node scripts/scaffold-domain.js nyusatsu 入札ナビ --dry-run
 *   npm run scaffold -- nyusatsu 入札ナビ --item 案件 --provider 発注機関
 *
 * オプション:
 *   --item <term>      item 用語 (default: アイテム)
 *   --provider <term>  provider 用語 (default: 提供者)
 *   --param <type>     detail route param: slug or code (default: slug)
 *   --dry-run          ファイル生成せず、出力先プレビューのみ
 *
 * 生成ファイル (7):
 *   lib/{key}-config.js
 *   lib/domains/{key}.js
 *   app/{key}/page.js
 *   app/{key}/compare/page.js
 *   app/{key}/[{param}]/page.js
 *   app/api/{key}-favorites/route.js
 *   app/api/{key}-favorites/[itemId]/route.js
 *
 * 自動追記 (3):
 *   lib/domains/index.js
 *   app/sitemap.js
 *   lib/db.js
 */

const fs = require("fs");
const path = require("path");

// ─── 引数パース ───────────────────────

const args = process.argv.slice(2);
const flags = {};
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dry-run") {
    flags.dryRun = true;
  } else if (args[i] === "--item" && args[i + 1]) {
    flags.item = args[++i];
  } else if (args[i] === "--provider" && args[i + 1]) {
    flags.provider = args[++i];
  } else if (args[i] === "--param" && args[i + 1]) {
    flags.param = args[++i];
  } else if (!args[i].startsWith("--")) {
    positional.push(args[i]);
  }
}

const key = positional[0];
const name = positional[1];
const itemTerm = flags.item || "アイテム";
const providerTerm = flags.provider || "提供者";
const paramType = flags.param || "slug";
const dryRun = !!flags.dryRun;

if (!key || !name) {
  console.error(`
Usage: node scripts/scaffold-domain.js <key> <name> [options]

Example:
  node scripts/scaffold-domain.js nyusatsu 入札ナビ --item 案件 --provider 発注機関

Options:
  --item <term>      item 用語 (default: アイテム)
  --provider <term>  provider 用語 (default: 提供者)
  --param <type>     slug or code (default: slug)
  --dry-run          preview only, no file writes
`);
  process.exit(1);
}

// ─── パス定義 ───────────────────────

const WEB = path.resolve(__dirname, "..");
const rel = (p) => path.join(WEB, p);

const KEY = key;
const NAME = name;
const UPPER = KEY.charAt(0).toUpperCase() + KEY.slice(1);
const PARAM = paramType;
const ITEM = itemTerm;
const PROVIDER = providerTerm;

// ─── 安全チェック ───────────────────────

function fileExists(p) {
  return fs.existsSync(rel(p));
}

function fileContains(p, text) {
  if (!fs.existsSync(rel(p))) return false;
  return fs.readFileSync(rel(p), "utf-8").includes(text);
}

// ─── テンプレート生成 ───────────────────────

function configTemplate() {
  return `/**
 * ${NAME} — 設定 + 仮データ
 * scaffold で自動生成。本番実装時は DB / 外部データソースに移行する。
 */

export const ${KEY}Config = {
  categories: [
    { slug: "cat1", label: "カテゴリ1", icon: "📁" },
    { slug: "cat2", label: "カテゴリ2", icon: "📂" },
    { slug: "cat3", label: "カテゴリ3", icon: "📄" },
  ],

  sorts: [
    { key: "popular", label: "人気順" },
    { key: "newest", label: "新着順" },
  ],

  compareFields: [
    { key: "category_label", label: "カテゴリ" },
    { key: "provider_name", label: "${PROVIDER}" },
    { key: "summary", label: "概要" },
  ],

  terminology: {
    item: "${ITEM}",
    itemPlural: "${ITEM}",
    provider: "${PROVIDER}",
    category: "カテゴリ",
    favorite: "お気に入り",
  },

  seo: {
    titleTemplate: "%s | ${NAME}",
    descriptionTemplate: "%s の情報を掲載。",
    jsonLdType: "Service",
  },
};

/**
 * 仮データ — scaffold 生成。本番では DB から取得する。
 */
export const ${KEY.toUpperCase()}_SEED_DATA = [
  {
    id: 1,
    ${PARAM}: "sample-1",
    title: "サンプル${ITEM}1",
    category: "cat1",
    provider_name: "サンプル${PROVIDER}A",
    summary: "これはサンプルの${ITEM}です。scaffold で自動生成されました。",
    is_published: true,
  },
  {
    id: 2,
    ${PARAM}: "sample-2",
    title: "サンプル${ITEM}2",
    category: "cat2",
    provider_name: "サンプル${PROVIDER}B",
    summary: "これはサンプルの${ITEM}です。scaffold で自動生成されました。",
    is_published: true,
  },
  {
    id: 3,
    ${PARAM}: "sample-3",
    title: "サンプル${ITEM}3",
    category: "cat3",
    provider_name: "サンプル${PROVIDER}C",
    summary: "これはサンプルの${ITEM}です。scaffold で自動生成されました。",
    is_published: true,
  },
];

// ─── ヘルパー ────────────────

export function getCategoryLabel(slug) {
  return ${KEY}Config.categories.find((c) => c.slug === slug)?.label || slug;
}

export function getCategoryIcon(slug) {
  return ${KEY}Config.categories.find((c) => c.slug === slug)?.icon || "📁";
}

export function get${UPPER}ById(id) {
  return ${KEY.toUpperCase()}_SEED_DATA.find((d) => d.id === id) || null;
}

export function get${UPPER}By${PARAM === "slug" ? "Slug" : "Code"}(val) {
  return ${KEY.toUpperCase()}_SEED_DATA.find((d) => d.${PARAM} === val) || null;
}
`;
}

function registryTemplate() {
  return `/**
 * ${NAME} ドメイン定義
 * scaffold で自動生成。
 */

import { registerDomain } from "../core/domain-registry";
import { ${KEY}Config } from "../${KEY}-config";

registerDomain({
  id: "${KEY}",
  name: "${NAME}",
  basePath: "/${KEY}",
  apiBasePath: "/api/${KEY}",
  adminBasePath: "/admin/${KEY}",

  categories: ${KEY}Config.categories,
  statuses: [],
  filters: [
    { key: "category", label: "カテゴリ", type: "select", source: "categories" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],
  sorts: ${KEY}Config.sorts,
  compareFields: ${KEY}Config.compareFields,

  terminology: ${KEY}Config.terminology,

  favorites: {
    tableName: "${KEY}_favorites",
    idColumn: "${KEY}_id",
    checkEndpoint: "/api/${KEY}-favorites?check=",
    apiEndpoint: "/api/${KEY}-favorites",
    deleteEndpoint: "/api/${KEY}-favorites/",
  },

  savedSearches: {
    tableName: "${KEY}_saved_searches",
    apiEndpoint: "/api/${KEY}-saved-searches",
  },

  seo: ${KEY}Config.seo,

  db: {
    mainTable: "${KEY}_items",
    idColumn: "id",
    detailTable: "${KEY}_details",
    detailFkColumn: "${KEY}_id",
  },
});
`;
}

function listPageTemplate() {
  const getter = `get${UPPER}ById`;
  return `"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import DomainListPage from "@/components/core/DomainListPage";
import DomainCompareBar from "@/components/core/DomainCompareBar";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import {
  ${KEY.toUpperCase()}_SEED_DATA,
  ${KEY}Config,
  getCategoryLabel,
  getCategoryIcon,
} from "@/lib/${KEY}-config";

const ${KEY}Domain = getDomain("${KEY}");

function ${UPPER}Card({ item }) {
  return (
    <div className="card p-4 hover:shadow-md transition-shadow flex gap-4">
      <Link href={\`/${KEY}/\${item.${PARAM}}\`} className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
        {getCategoryIcon(item.category)}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link href={\`/${KEY}/\${item.${PARAM}}\`} className="block min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate hover:text-blue-600">{item.title}</h3>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {${KEY}Domain && <DomainFavoriteButton itemId={item.id} domain={${KEY}Domain} />}
            <DomainCompareButton domainId="${KEY}" itemId={item.id} variant="compact" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.provider_name}</p>
        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.summary}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ${UPPER}ListPage() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    return ${KEY.toUpperCase()}_SEED_DATA.filter((item) => {
      if (!item.is_published) return false;
      if (category && item.category !== category) return false;
      if (keyword) {
        const q = keyword.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [keyword, category]);

  return (
    <DomainListPage
      title="${NAME}"
      subtitle={\`\${filtered.length}件の${ITEM}\`}
      items={filtered}
      loading={false}
      page={1}
      totalPages={1}
      onPageChange={() => {}}
      renderItem={(item) => <${UPPER}Card key={item.id} item={item} />}
      renderFilters={() => (
        <div className="card p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="${ITEM}名で検索..." className="flex-1 border rounded-lg px-4 py-2.5 text-sm" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded-lg px-3 py-2.5 text-sm">
              <option value="">すべてのカテゴリ</option>
              {${KEY}Config.categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      emptyState={
        <div className="card p-8 text-center">
          <p className="text-gray-500">条件に一致する${ITEM}が見つかりません</p>
          <button onClick={() => { setKeyword(""); setCategory(""); }} className="btn-secondary mt-4">フィルタをリセット</button>
        </div>
      }
      bottomBar={<DomainCompareBar domainId="${KEY}" comparePath="/${KEY}/compare" label="${ITEM}" />}
    />
  );
}
`;
}

function comparePageTemplate() {
  const byId = `get${UPPER}ById`;
  return `"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getCompareIdsFromUrlOrStore, clearCompareIds, removeCompareId } from "@/lib/core/compare-store";
import { ${byId}, ${KEY}Config, getCategoryLabel } from "@/lib/${KEY}-config";

const DOMAIN_ID = "${KEY}";

export default function ${UPPER}CompareWrapper() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>}>
      <${UPPER}ComparePage />
    </Suspense>
  );
}

function ${UPPER}ComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const resolved = getCompareIdsFromUrlOrStore(DOMAIN_ID, searchParams);
  const [ids, setIds] = useState(resolved.ids);
  const urlSyncDone = useRef(false);

  useEffect(() => {
    if (urlSyncDone.current) return;
    if (resolved.source === "store" && resolved.ids.length > 0) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("ids", resolved.ids.join(","));
      router.replace(\`/${KEY}/compare?\${p.toString()}\`, { scroll: false });
    }
    urlSyncDone.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onCompareChange(e) {
      if (e.detail && e.detail.domainId !== DOMAIN_ID) return;
      setIds(getCompareIdsFromUrlOrStore(DOMAIN_ID, null).ids);
    }
    window.addEventListener("compare-change", onCompareChange);
    return () => window.removeEventListener("compare-change", onCompareChange);
  }, []);

  const items = ids.map(${byId}).filter(Boolean);

  function remove(id) {
    removeCompareId(DOMAIN_ID, id);
    const next = ids.filter((i) => i !== id);
    setIds(next);
    router.replace(next.length > 0 ? \`/${KEY}/compare?ids=\${next.join(",")}\` : "/${KEY}/compare", { scroll: false });
  }

  function handleClear() {
    clearCompareIds(DOMAIN_ID);
    setIds([]);
    router.replace("/${KEY}/compare", { scroll: false });
  }

  function cell(item, field) {
    switch (field.key) {
      case "category_label": return getCategoryLabel(item.category);
      case "provider_name": return item.provider_name || "—";
      case "summary": return <span className="text-xs">{item.summary}</span>;
      default: return item[field.key] || "—";
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">${NAME} 比較</h1>
      <p className="text-sm text-gray-500 mb-6">最大3件を並べて比較できます</p>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-600 font-bold mb-1">比較中の${ITEM}はありません</p>
          <p className="text-sm text-gray-400 mb-6">一覧ページで「比較」ボタンを押すと、ここで比較できます</p>
          <Link href="/${KEY}" className="btn-primary inline-block">${NAME}一覧へ</Link>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={handleClear} className="text-xs text-gray-500 hover:text-red-500">すべてクリア</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-4 text-left text-gray-500 font-medium w-40">比較項目</th>
                  {items.map((item) => (
                    <th key={item.id} className="p-4 text-center min-w-[200px]">
                      <Link href={\`/${KEY}/\${item.${PARAM}}\`} className="font-bold text-gray-900 hover:text-blue-600">{item.title}</Link>
                      <button onClick={() => remove(item.id)} className="text-xs text-red-500 hover:text-red-700 mt-1 block mx-auto">削除</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {${KEY}Config.compareFields.map((f) => (
                  <tr key={f.key} className="border-b last:border-b-0">
                    <td className="p-4 text-gray-500 font-medium">{f.label}</td>
                    {items.map((item) => (
                      <td key={item.id} className="p-4 text-center text-gray-900">{cell(item, f)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
`;
}

function detailPageTemplate() {
  const byParam = `get${UPPER}By${PARAM === "slug" ? "Slug" : "Code"}`;
  return `"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import DomainDetailPage from "@/components/core/DomainDetailPage";
import DomainCompareButton from "@/components/core/DomainCompareButton";
import DomainFavoriteButton from "@/components/core/DomainFavoriteButton";
import "@/lib/domains";
import { getDomain } from "@/lib/core/domain-registry";
import { ${byParam}, getCategoryLabel, getCategoryIcon } from "@/lib/${KEY}-config";

const ${KEY}Domain = getDomain("${KEY}");

export default function ${UPPER}DetailPage() {
  const params = useParams();
  const item = ${byParam}(params.${PARAM});

  if (!item) {
    return (
      <DomainDetailPage
        notFound={
          <div className="max-w-4xl mx-auto px-4 py-8 text-center">
            <p className="text-gray-500 mb-4">${ITEM}が見つかりません</p>
            <Link href="/${KEY}" className="btn-primary inline-block">${NAME}一覧へ</Link>
          </div>
        }
      />
    );
  }

  return (
    <DomainDetailPage
      breadcrumb={
        <>
          <Link href="/${KEY}" className="hover:text-blue-600">${NAME}</Link>
          <span>/</span>
          <span>{item.title}</span>
        </>
      }
      icon={getCategoryIcon(item.category)}
      title={item.title}
      subtitle={item.provider_name}
      meta={
        <>
          <span className="badge badge-blue">{getCategoryLabel(item.category)}</span>
        </>
      }
      actions={
        <>
          {${KEY}Domain && <DomainFavoriteButton itemId={item.id} domain={${KEY}Domain} variant="button" />}
          <DomainCompareButton domainId="${KEY}" itemId={item.id} variant="compact" />
        </>
      }
      footerSlot={
        <div className="flex gap-3 mt-2">
          <Link href="/${KEY}" className="btn-secondary text-sm">← 一覧に戻る</Link>
        </div>
      }
    >
      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">概要</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{item.summary}</p>
      </section>

      <section className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">基本情報</h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["${PROVIDER}", item.provider_name],
              ["カテゴリ", <>{getCategoryIcon(item.category)} {getCategoryLabel(item.category)}</>],
            ].map(([label, value], i, arr) => (
              <tr key={label} className={i < arr.length - 1 ? "border-b" : ""}>
                <td className="py-3 text-gray-500 w-40">{label}</td>
                <td className="py-3 text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </DomainDetailPage>
  );
}
`;
}

function favoritesRouteTemplate() {
  const byId = `get${UPPER}ById`;
  return `import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ${byId} } from "@/lib/${KEY}-config";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ favorites: [], ids: [], total: 0 });
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const checkId = searchParams.get("check");

    if (checkId) {
      const fav = db.prepare("SELECT id FROM ${KEY}_favorites WHERE user_key = ? AND ${KEY}_id = ?").get(user.userKey, checkId);
      return NextResponse.json({ isFavorite: !!fav });
    }

    const rows = db.prepare("SELECT ${KEY}_id, created_at FROM ${KEY}_favorites WHERE user_key = ? ORDER BY created_at DESC").all(user.userKey);
    const favorites = rows.map((r) => { const item = ${byId}(r.${KEY}_id); return item ? { ...item, favorited_at: r.created_at } : null; }).filter(Boolean);
    return NextResponse.json({ favorites, ids: rows.map((r) => r.${KEY}_id), total: favorites.length });
  } catch (error) {
    console.error("GET /api/${KEY}-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const db = getDb();
    const body = await request.json();
    const id = body.${KEY}_id;
    if (!id) return NextResponse.json({ error: "${KEY}_id is required" }, { status: 400 });
    if (!${byId}(Number(id))) return NextResponse.json({ error: "item not found" }, { status: 404 });

    try {
      db.prepare("INSERT INTO ${KEY}_favorites (user_key, ${KEY}_id, created_at) VALUES (?, ?, datetime('now'))").run(user.userKey, id);
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ message: "already favorited" });
      throw err;
    }
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/${KEY}-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;
}

function favoritesDeleteTemplate() {
  return `import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    const { itemId } = await params;
    const db = getDb();
    db.prepare("DELETE FROM ${KEY}_favorites WHERE user_key = ? AND ${KEY}_id = ?").run(user.userKey, itemId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("DELETE /api/${KEY}-favorites error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;
}

// ─── Admin API テンプレート（guard + audit 付き）───

function adminApiRouteTemplate() {
  return `import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import { getDb } from "@/lib/db";

export async function GET(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = 50;
    const where = [];
    const params = {};
    if (keyword) { where.push("(title LIKE @kw OR slug LIKE @kw)"); params.kw = \`%\${keyword}%\`; }
    const wc = where.length > 0 ? \`WHERE \${where.join(" AND ")}\` : "";
    const total = db.prepare(\`SELECT COUNT(*) as c FROM ${KEY}_items \${wc}\`).get(params).c;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (Math.max(1, page) - 1) * pageSize;
    const items = db.prepare(\`SELECT * FROM ${KEY}_items \${wc} ORDER BY id DESC LIMIT @limit OFFSET @offset\`).all({ ...params, limit: pageSize, offset });
    return NextResponse.json({ items, total, totalPages });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const db = getDb();
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    if (!body.slug) return NextResponse.json({ error: "slug は必須です" }, { status: 400 });
    // TODO: Insert columns to match your ${KEY}_items schema
    const result = db.prepare(
      "INSERT INTO ${KEY}_items (slug, title, is_published, created_at, updated_at) VALUES (@slug, @title, @is_published, datetime('now'), datetime('now'))"
    ).run({ slug: body.slug, title: body.title, is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1 });
    const { ipAddress, userAgent } = extractRequestInfo(request);
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_CREATED, targetType: "${KEY}_item", targetId: String(result.lastInsertRowid), details: { domain: "${KEY}", slug: body.slug, title: body.title }, ipAddress, userAgent });
    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;
}

function adminApiIdRouteTemplate() {
  return `import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { writeAuditLog, AUDIT_ACTIONS, extractRequestInfo } from "@/lib/audit-log";
import { getDb } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const item = getDb().prepare("SELECT * FROM ${KEY}_items WHERE id = ?").get(Number(id));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request, { params }) {
  try {
    const guard = await requireAdminApi();
    if (guard.error) return guard.error;
    const { id } = await params;
    const numId = Number(id);
    const db = getDb();
    const before = db.prepare("SELECT * FROM ${KEY}_items WHERE id = ?").get(numId);
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title は必須です" }, { status: 400 });
    // TODO: Update columns to match your ${KEY}_items schema
    db.prepare(
      "UPDATE ${KEY}_items SET slug = @slug, title = @title, is_published = @is_published, updated_at = datetime('now') WHERE id = @id"
    ).run({ slug: body.slug || "", title: body.title, is_published: body.is_published != null ? (body.is_published ? 1 : 0) : 1, id: numId });
    const { ipAddress, userAgent } = extractRequestInfo(request);
    const details = { domain: "${KEY}", slug: body.slug, title: body.title };
    if (before && before.is_published !== (body.is_published ? 1 : 0)) details.is_published_changed = \`\${before.is_published} → \${body.is_published ? 1 : 0}\`;
    writeAuditLog({ userId: guard.user.id, action: AUDIT_ACTIONS.ADMIN_ITEM_UPDATED, targetType: "${KEY}_item", targetId: String(numId), details, ipAddress, userAgent });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return NextResponse.json({ error: "slug が重複しています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;
}

// ─── Admin ページテンプレート ─────────────

function adminListPageTemplate() {
  return `"use client";
import AdminListPage from "@/components/admin/AdminListPage";

export default function ${UPPER}AdminListPage() {
  return <AdminListPage title="${NAME} 管理" apiPath="/api/admin/${KEY}" basePath="/admin/${KEY}" publicPath="/${KEY}" columns={[
    { key: "title", label: "タイトル" },
    { key: "slug", label: "Slug" },
    { key: "is_published", label: "公開", render: (i) => i.is_published ? "公開" : "非公開" },
    { key: "updated_at", label: "更新日", render: (i) => i.updated_at?.substring(0, 10) || "—" },
  ]} />;
}
`;
}

function adminNewPageTemplate() {
  return `"use client";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "title", label: "タイトル", required: true },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
  // TODO: ドメイン固有の項目を追加
];

export default function ${UPPER}NewPage() {
  return <AdminFormPage title="${NAME} 新規作成" apiPath="/api/admin/${KEY}" basePath="/admin/${KEY}" fields={FIELDS} defaults={{ is_published: 1 }} />;
}
`;
}

function adminEditPageTemplate() {
  return `"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "title", label: "タイトル", required: true },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
  // TODO: ドメイン固有の項目を追加
];

export default function ${UPPER}EditPage() {
  const { id } = useParams();
  return <AdminFormPage title="${NAME} 編集" apiPath="/api/admin/${KEY}" basePath="/admin/${KEY}" itemId={Number(id)} fields={FIELDS} />;
}
`;
}

// ─── ファイル生成 ───────────────────────

const filesToCreate = [
  { path: `lib/${KEY}-config.js`, content: configTemplate },
  { path: `lib/domains/${KEY}.js`, content: registryTemplate },
  { path: `app/${KEY}/page.js`, content: listPageTemplate },
  { path: `app/${KEY}/compare/page.js`, content: comparePageTemplate },
  { path: `app/${KEY}/[${PARAM}]/page.js`, content: detailPageTemplate },
  { path: `app/api/${KEY}-favorites/route.js`, content: favoritesRouteTemplate },
  { path: `app/api/${KEY}-favorites/[itemId]/route.js`, content: favoritesDeleteTemplate },
  // Admin API (guard + audit 付き)
  { path: `app/api/admin/${KEY}/route.js`, content: adminApiRouteTemplate },
  { path: `app/api/admin/${KEY}/[id]/route.js`, content: adminApiIdRouteTemplate },
  // Admin ページ
  { path: `app/admin/${KEY}/page.js`, content: adminListPageTemplate },
  { path: `app/admin/${KEY}/new/page.js`, content: adminNewPageTemplate },
  { path: `app/admin/${KEY}/[id]/edit/page.js`, content: adminEditPageTemplate },
];

// ─── 追記処理定義 ───────────────────────

const appendOps = [
  {
    file: "lib/domains/index.js",
    check: `"./${KEY}"`,
    marker: "// 将来のドメイン追加テンプレート:",
    insert: `import "./${KEY}";\n`,
    desc: `import "./${KEY}" を追加`,
  },
  {
    file: "app/sitemap.js",
    check: `/${KEY}`,
    marker: "  return [",
    insertBefore: true,
    insert: `  // ${NAME}: 静的ページ\n  const ${KEY}StaticPages = [\n    { url: \`\${baseUrl}/${KEY}\`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },\n    { url: \`\${baseUrl}/${KEY}/compare\`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },\n  ];\n\n`,
    desc: `${KEY}StaticPages 定義を追加`,
  },
  {
    file: "app/sitemap.js",
    check: `...${KEY}StaticPages`,
    // Use a unique pattern that only matches the final return array's closing
    customAppend: true,
    desc: `${KEY}StaticPages を return 配列に追加`,
  },
  {
    file: "lib/db.js",
    check: `${KEY}_favorites`,
    marker: "  }\n  return _db;",
    insertBefore: true,
    insert: `\n    // ${KEY}_favorites: ${NAME}お気に入り\n    _db.exec(\`\n      CREATE TABLE IF NOT EXISTS ${KEY}_favorites (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_key TEXT NOT NULL,\n        ${KEY}_id INTEGER NOT NULL,\n        created_at TEXT NOT NULL DEFAULT (datetime('now')),\n        UNIQUE(user_key, ${KEY}_id)\n      )\n    \`);\n    _db.exec(\`CREATE INDEX IF NOT EXISTS idx_${KEY}_favorites_user ON ${KEY}_favorites(user_key)\`);\n    _db.exec(\`CREATE INDEX IF NOT EXISTS idx_${KEY}_favorites_item ON ${KEY}_favorites(${KEY}_id)\`);\n`,
    desc: `${KEY}_favorites テーブル作成を追加`,
  },
];

// ─── 実行 ───────────────────────

console.log(`\n🏗️  Domain Scaffold: ${KEY} (${NAME})`);
console.log(`   item: ${ITEM} | provider: ${PROVIDER} | param: ${PARAM}`);
console.log(`   mode: ${dryRun ? "DRY RUN (preview only)" : "GENERATE"}\n`);

// 重複チェック
if (fileExists(`lib/domains/${KEY}.js`)) {
  console.error(`❌ Domain "${KEY}" already exists (lib/domains/${KEY}.js found). Aborting.`);
  process.exit(1);
}

let created = 0;
let skipped = 0;
let appended = 0;

// ファイル生成
console.log("📄 Files to create:");
for (const f of filesToCreate) {
  const fullPath = rel(f.path);
  if (fs.existsSync(fullPath)) {
    console.log(`   SKIP (exists): ${f.path}`);
    skipped++;
    continue;
  }
  console.log(`   CREATE: ${f.path}`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, f.content(), "utf-8");
  }
  created++;
}

// 追記
console.log("\n📝 Files to append:");
for (const op of appendOps) {
  if (fileContains(op.file, op.check)) {
    console.log(`   SKIP (already present): ${op.file} — ${op.desc}`);
    skipped++;
    continue;
  }
  console.log(`   APPEND: ${op.file} — ${op.desc}`);
  if (!dryRun) {
    const content = fs.readFileSync(rel(op.file), "utf-8");

    if (op.customAppend) {
      // sitemap return 配列の最後の ];  の直前に挿入
      // 最後の "  ];" を探す（return 配列の閉じ）
      const lastClose = content.lastIndexOf("  ];");
      if (lastClose === -1) {
        console.error(`   ⚠️  Could not find return array closing in ${op.file}`);
        continue;
      }
      const insertText = `    // ${NAME}\n    ...${KEY}StaticPages,\n`;
      const newContent = content.slice(0, lastClose) + insertText + content.slice(lastClose);
      fs.writeFileSync(rel(op.file), newContent, "utf-8");
    } else {
      const idx = content.indexOf(op.marker);
      if (idx === -1) {
        console.error(`   ⚠️  Marker not found in ${op.file}: "${op.marker.substring(0, 40)}..."`);
        continue;
      }
      let newContent;
      if (op.insertBefore) {
        newContent = content.slice(0, idx) + op.insert + content.slice(idx);
      } else {
        const end = idx + op.marker.length;
        newContent = content.slice(0, end) + "\n" + op.insert + content.slice(end);
      }
      fs.writeFileSync(rel(op.file), newContent, "utf-8");
    }
  }
  appended++;
}

console.log(`\n✅ Done! Created: ${created}, Appended: ${appended}, Skipped: ${skipped}`);

if (dryRun) {
  console.log("\n💡 This was a dry run. Run without --dry-run to generate files.");
} else {
  console.log(`\n🚀 Next steps:`);
  console.log(`   1. Edit lib/${KEY}-config.js — カテゴリ、仮データ、compareFields をカスタマイズ`);
  console.log(`   2. Edit app/${KEY}/page.js — カード表示項目をカスタマイズ`);
  console.log(`   3. Edit app/${KEY}/[${PARAM}]/page.js — 詳細ページの情報テーブルをカスタマイズ`);
  console.log(`   4. Edit app/api/admin/${KEY}/*.js — admin API の INSERT/UPDATE カラムを合わせる`);
  console.log(`   5. Edit app/admin/${KEY}/*.js — admin 一覧 columns / フォーム fields をカスタマイズ`);
  console.log(`   6. Add ${KEY} to app/admin/page.js DOMAINS 配列`);
  console.log(`   7. Run: npx next build`);
  console.log(`   8. Verify: http://localhost:3001/${KEY}`);
}
