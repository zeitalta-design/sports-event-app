/**
 * ドメイン追加テンプレート
 *
 * 新しいドメインを追加する手順:
 * 1. このファイルをコピーして lib/domains/{domain-id}.js を作成
 * 2. 下記の設定を埋める
 * 3. lib/domains/index.js に import "./{domain-id}"; を追加
 * 4. DB テーブルを lib/db.js に追加（{domain}_details テーブル等）
 * 5. API ルートを app/api/ に追加
 * 6. ページを app/{basePath}/ に追加
 * 7. 管理画面を app/admin/{admin-prefix}/ に追加
 * 8. AdminNav.js にタブを追加
 * 9. seed スクリプトを scripts/ に追加
 *
 * --- 以下をコピーして編集 ---
 */

/*
import { registerDomain } from "../core/domain-registry";

registerDomain({
  // === 基本情報 ===
  id: "your-domain-id",           // 例: "shareholder-benefit"
  name: "表示名",                  // 例: "株主優待ナビ"
  basePath: "/your-path",          // 例: "/yutai"
  apiBasePath: "/api/your-items",  // 例: "/api/yutai-items"
  adminBasePath: "/admin/your-items",

  // === カテゴリ ===
  categories: [
    { slug: "cat1", label: "カテゴリ1", icon: "📊" },
    { slug: "cat2", label: "カテゴリ2", icon: "💰" },
  ],

  // === ステータス ===
  statuses: [
    { key: "active", label: "有効", color: "green" },
    { key: "inactive", label: "無効", color: "gray" },
  ],

  // === フィルタ定義 ===
  filters: [
    { key: "category", label: "カテゴリ", type: "select", source: "categories" },
    { key: "keyword", label: "キーワード", type: "text" },
    // type: "select" | "text" | "boolean" | "range"
  ],

  // === ソート定義 ===
  sorts: [
    { key: "popularity", label: "人気順" },
    { key: "newest", label: "新着順" },
  ],

  // === 比較項目 ===
  compareFields: [
    { key: "category", label: "カテゴリ" },
    { key: "price", label: "価格" },
    // format: "boolean" | "trial" | undefined
  ],

  // === 用語定義 ===
  terminology: {
    item: "アイテム",         // 単数
    itemPlural: "アイテム",   // 複数
    provider: "提供者",
    category: "カテゴリ",
    favorite: "お気に入り",
    variant: "バリエーション",
  },

  // === お気に入り ===
  favorites: {
    tableName: "your_favorites",       // DBテーブル名
    idColumn: "item_id",               // FK列名
    checkEndpoint: "/api/your-favorites?check=",
    apiEndpoint: "/api/your-favorites",
    deleteEndpoint: "/api/your-favorites/",
  },

  // === 保存検索 ===
  savedSearches: {
    tableName: "your_saved_searches",
    apiEndpoint: "/api/your-saved-searches",
  },

  // === SEO ===
  seo: {
    titleTemplate: "{title} | あなたのサイト名",
    descriptionTemplate: "{title}の詳細情報。",
    jsonLdType: "Product", // Schema.org タイプ
  },

  // === DB ===
  db: {
    mainTable: "items",                    // or "your_items"
    idColumn: "id",
    detailTable: "your_domain_details",    // ドメイン固有拡張テーブル
    detailFkColumn: "item_id",
  },

  // === ドメイン固有の追加設定（任意） ===
  extra: {
    // ドメイン固有の定数やマッピングをここに
  },
});

export { getDomain } from "../core/domain-registry";
*/
