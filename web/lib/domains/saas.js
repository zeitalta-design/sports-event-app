/**
 * SaaS ドメイン定義
 *
 * 既存の saas-config.js を参照し、
 * domain-registry の統一インターフェースに合わせる薄いラッパー。
 *
 * 注意: saas-config.js 自体は一切変更しない。
 */

import { registerDomain } from "../core/domain-registry";
import { saasConfig } from "../saas-config";

const saasFilters = [
  { key: "category", label: "カテゴリ", type: "select", source: "categories" },
  {
    key: "price_range",
    label: "月額料金",
    type: "select",
    options: saasConfig.priceRanges,
  },
  {
    key: "company_size",
    label: "企業規模",
    type: "select",
    options: saasConfig.companySizes,
  },
  { key: "has_free_plan", label: "無料プランあり", type: "boolean" },
  { key: "has_free_trial", label: "無料トライアルあり", type: "boolean" },
  { key: "keyword", label: "キーワード", type: "text" },
];

registerDomain({
  id: "saas",
  name: "SaaSナビ",
  basePath: "/saas",
  apiBasePath: "/api/items",
  adminBasePath: "/admin/saas-items",

  categories: saasConfig.categories,
  statuses: saasConfig.statuses,
  filters: saasFilters,
  sorts: saasConfig.sorts,
  compareFields: saasConfig.compareFields,

  terminology: {
    item: saasConfig.terminology.item,
    itemPlural: saasConfig.terminology.itemPlural,
    provider: saasConfig.terminology.provider,
    category: saasConfig.terminology.category,
    favorite: "お気に入り",
    variant: saasConfig.terminology.variant,
  },

  favorites: {
    tableName: "item_favorites",
    idColumn: "item_id",
    checkEndpoint: "/api/item-favorites?check=",
    apiEndpoint: "/api/item-favorites",
    deleteEndpoint: "/api/item-favorites/", // + itemId
  },

  savedSearches: {
    tableName: "item_saved_searches",
    apiEndpoint: "/api/item-saved-searches",
  },

  seo: {
    titleTemplate: saasConfig.seo.titleTemplate,
    descriptionTemplate: saasConfig.seo.descriptionTemplate,
    jsonLdType: saasConfig.seo.jsonLdType,
  },

  db: {
    mainTable: "items",
    idColumn: "id",
    detailTable: "saas_details",
    detailFkColumn: "item_id",
  },

  // saas 固有の追加設定
  extra: {
    supportTypes: saasConfig.supportTypes,
    reviewAxes: saasConfig.reviewAxes,
    priceRanges: saasConfig.priceRanges,
    companySizes: saasConfig.companySizes,
  },
});

export { getDomain } from "../core/domain-registry";
