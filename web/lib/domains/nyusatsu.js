/**
 * 入札ナビ ドメイン定義
 * scaffold で自動生成。
 */

import { registerDomain } from "../core/domain-registry";
import { nyusatsuConfig } from "../nyusatsu-config";

registerDomain({
  id: "nyusatsu",
  name: "入札ナビ",
  basePath: "/nyusatsu",
  apiBasePath: "/api/nyusatsu",
  adminBasePath: "/admin/nyusatsu",

  categories: nyusatsuConfig.categories,
  statuses: [],
  filters: [
    { key: "category", label: "カテゴリ", type: "select", source: "categories" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],
  sorts: nyusatsuConfig.sorts,
  compareFields: nyusatsuConfig.compareFields,

  terminology: nyusatsuConfig.terminology,

  favorites: {
    tableName: "nyusatsu_favorites",
    idColumn: "nyusatsu_id",
    checkEndpoint: "/api/nyusatsu-favorites?check=",
    apiEndpoint: "/api/nyusatsu-favorites",
    deleteEndpoint: "/api/nyusatsu-favorites/",
  },

  savedSearches: {
    tableName: "nyusatsu_saved_searches",
    apiEndpoint: "/api/nyusatsu-saved-searches",
  },

  seo: nyusatsuConfig.seo,

  db: {
    mainTable: "nyusatsu_items",
    idColumn: "id",
    detailTable: "nyusatsu_details",
    detailFkColumn: "nyusatsu_id",
  },
});
