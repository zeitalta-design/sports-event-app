import { registerDomain } from "../core/domain-registry";
import { minpakuConfig } from "../minpaku-config";

registerDomain({
  id: "minpaku",
  name: "民泊ナビ",
  basePath: "/minpaku",
  apiBasePath: "/api/minpaku",
  adminBasePath: "/admin/minpaku",
  categories: minpakuConfig.categories,
  statuses: minpakuConfig.statusOptions,
  filters: [
    { key: "category", label: "カテゴリ", type: "select", source: "categories" },
    { key: "keyword", label: "キーワード", type: "text" },
  ],
  sorts: minpakuConfig.sorts,
  compareFields: minpakuConfig.compareFields,
  terminology: minpakuConfig.terminology,
  favorites: {
    tableName: "minpaku_favorites",
    idColumn: "minpaku_id",
    checkEndpoint: "/api/minpaku-favorites?check=",
    apiEndpoint: "/api/minpaku-favorites",
    deleteEndpoint: "/api/minpaku-favorites/",
  },
  savedSearches: { tableName: "minpaku_saved_searches", apiEndpoint: "/api/minpaku-saved-searches" },
  seo: minpakuConfig.seo,
  db: { mainTable: "minpaku_items", idColumn: "id" },
});
