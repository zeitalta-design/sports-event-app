/**
 * 株主優待ナビ ドメイン定義
 *
 * yutai-config.js を参照し、domain-registry の統一インターフェースに登録する。
 * skeleton 実証用。本番では DB 接続・API 設計を追加する。
 */

import { registerDomain } from "../core/domain-registry";
import { yutaiConfig } from "../yutai-config";

const yutaiFilters = [
  { key: "category", label: "優待カテゴリ", type: "select", source: "categories" },
  { key: "confirm_month", label: "権利確定月", type: "select", options: yutaiConfig.confirmMonths },
  { key: "keyword", label: "キーワード", type: "text" },
];

registerDomain({
  id: "yutai",
  name: "株主優待ナビ",
  basePath: "/yutai",
  apiBasePath: "/api/yutai",       // TODO: 本番 API 実装時に作成
  adminBasePath: "/admin/yutai",   // TODO: 管理画面実装時に作成

  categories: yutaiConfig.categories,
  statuses: [],
  filters: yutaiFilters,
  sorts: yutaiConfig.sorts,
  compareFields: yutaiConfig.compareFields,

  terminology: yutaiConfig.terminology,

  favorites: {
    tableName: "yutai_favorites",     // TODO: テーブル作成
    idColumn: "yutai_id",
    checkEndpoint: "/api/yutai-favorites?check=",
    apiEndpoint: "/api/yutai-favorites",
    deleteEndpoint: "/api/yutai-favorites/",
  },

  savedSearches: {
    tableName: "yutai_saved_searches",
    apiEndpoint: "/api/yutai-saved-searches",
  },

  seo: yutaiConfig.seo,

  db: {
    mainTable: "yutai_items",          // TODO: テーブル作成
    idColumn: "id",
    detailTable: "yutai_details",      // TODO: テーブル作成
    detailFkColumn: "yutai_id",
  },

  extra: {
    confirmMonths: yutaiConfig.confirmMonths,
  },
});
