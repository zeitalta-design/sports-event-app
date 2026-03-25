/**
 * Domain Registry — 比較サイトOS の中心レジストリ
 *
 * 全ドメイン（sports, saas, ...）の定義を統一インターフェースで登録・参照する。
 * 各ドメインの設定ファイル（lib/domains/*.js）がここに登録する。
 *
 * 設計原則:
 * - 既存コード (sport-config.js, saas-config.js) は変更しない
 * - ドメイン定義は薄いラッパーとして追加し、既存設定をそのまま参照する
 * - 新ドメイン追加は lib/domains/ にファイルを追加 + ここに登録するだけ
 */

const _domains = new Map();

/**
 * ドメインスキーマ（各ドメインが提供すべきインターフェース）
 *
 * @typedef {Object} DomainConfig
 * @property {string} id             - ドメインID（"sports", "saas", ...）
 * @property {string} name           - 表示名（"スポーツ大会", "SaaSナビ"）
 * @property {string} basePath       - URLベースパス（"/marathon", "/saas"）
 * @property {string} apiBasePath    - APIベースパス（"/api/events", "/api/items"）
 * @property {string} adminBasePath  - 管理画面ベースパス（"/admin/events", "/admin/saas-items"）
 *
 * -- カテゴリ --
 * @property {Array<{slug: string, label: string, icon?: string}>} categories
 *
 * -- ステータス --
 * @property {Array<{key: string, label: string, color: string}>} statuses
 *
 * -- フィルタ定義 --
 * @property {Array<FilterDef>} filters
 *
 * -- ソート定義 --
 * @property {Array<{key: string, label: string}>} sorts
 *
 * -- 比較項目 --
 * @property {Array<{key: string, label: string, format?: string}>} compareFields
 *
 * -- 用語 --
 * @property {Object} terminology
 * @property {string} terminology.item      - 単数（"大会", "SaaSツール"）
 * @property {string} terminology.itemPlural - 複数（"大会一覧", "SaaSツール"）
 * @property {string} terminology.provider  - 提供者（"主催者", "ベンダー"）
 * @property {string} terminology.category  - カテゴリ呼称
 * @property {string} terminology.favorite  - お気に入り呼称
 *
 * -- お気に入り --
 * @property {Object} favorites
 * @property {string} favorites.tableName     - テーブル名（"favorites", "item_favorites"）
 * @property {string} favorites.idColumn      - ID列名（"event_id", "item_id"）
 * @property {string} favorites.checkEndpoint - チェックAPI（"/api/favorites?check=", "/api/item-favorites?check="）
 * @property {string} favorites.apiEndpoint   - CRUD API（"/api/favorites", "/api/item-favorites"）
 *
 * -- 保存検索 --
 * @property {Object} savedSearches
 * @property {string} savedSearches.tableName   - テーブル名
 * @property {string} savedSearches.apiEndpoint - API
 *
 * -- SEO --
 * @property {Object} seo
 * @property {string} seo.titleTemplate
 * @property {string} seo.descriptionTemplate
 * @property {string} [seo.jsonLdType]
 *
 * -- DB --
 * @property {Object} db
 * @property {string} db.mainTable            - メインテーブル（"events", "items"）
 * @property {string} db.idColumn             - 主キー列名（"id"）
 * @property {string} [db.detailTable]        - 詳細テーブル（"marathon_details", "saas_details"）
 * @property {string} [db.detailFkColumn]     - 詳細テーブルのFK列（"marathon_id", "item_id"）
 */

/**
 * ドメインを登録する
 * @param {DomainConfig} config
 */
export function registerDomain(config) {
  if (!config.id) throw new Error("Domain config must have an 'id'");
  _domains.set(config.id, Object.freeze(config));
}

/**
 * ドメインIDで設定を取得
 * @param {string} domainId
 * @returns {DomainConfig|undefined}
 */
export function getDomain(domainId) {
  return _domains.get(domainId);
}

/**
 * 全登録ドメインを取得
 * @returns {DomainConfig[]}
 */
export function getAllDomains() {
  return Array.from(_domains.values());
}

/**
 * URLパスからドメインを推定する
 * @param {string} pathname - e.g. "/saas/salesforce", "/marathon/123"
 * @returns {DomainConfig|undefined}
 */
export function getDomainByPath(pathname) {
  for (const domain of _domains.values()) {
    if (pathname.startsWith(domain.basePath)) {
      return domain;
    }
  }
  return undefined;
}

/**
 * ドメインが登録済みか確認
 * @param {string} domainId
 * @returns {boolean}
 */
export function hasDomain(domainId) {
  return _domains.has(domainId);
}

/**
 * ドメイン数を取得
 * @returns {number}
 */
export function getDomainCount() {
  return _domains.size;
}
