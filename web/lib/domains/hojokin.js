/**
 * 補助金ナビ ドメイン定義
 * skeleton 実証用。本番では DB 接続・API 設計を追加する。
 */

import { registerDomain } from "../core/domain-registry";
import { hojokinConfig } from "../hojokin-config";

registerDomain({
  id: "hojokin",
  name: "補助金ナビ",
  basePath: "/hojokin",
  apiBasePath: "/api/hojokin",
  adminBasePath: "/admin/hojokin",

  categories: hojokinConfig.categories,
  statuses: hojokinConfig.statusOptions,
  filters: [
    { key: "category", label: "支援カテゴリ", type: "select", source: "categories" },
    { key: "target", label: "対象者", type: "select", options: hojokinConfig.targetTypes },
    { key: "keyword", label: "キーワード", type: "text" },
  ],
  sorts: hojokinConfig.sorts,
  compareFields: hojokinConfig.compareFields,

  terminology: hojokinConfig.terminology,

  favorites: {
    tableName: "hojokin_favorites",
    idColumn: "hojokin_id",
    checkEndpoint: "/api/hojokin-favorites?check=",
    apiEndpoint: "/api/hojokin-favorites",
    deleteEndpoint: "/api/hojokin-favorites/",
  },

  savedSearches: {
    tableName: "hojokin_saved_searches",
    apiEndpoint: "/api/hojokin-saved-searches",
  },

  seo: hojokinConfig.seo,

  db: {
    mainTable: "hojokin_items",
    idColumn: "id",
    detailTable: "hojokin_details",
    detailFkColumn: "hojokin_id",
  },

  extra: {
    targetTypes: hojokinConfig.targetTypes,
    statusOptions: hojokinConfig.statusOptions,
  },
});
