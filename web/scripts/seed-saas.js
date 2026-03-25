#!/usr/bin/env node
/**
 * SaaSナビ初期データ投入スクリプト
 *
 * 使い方: cd web && node scripts/seed-saas.js
 */

import { getDb } from "../lib/db.js";

const db = getDb();

// ── プロバイダー ──────────────────────────────
const providers = [
  { name: "Salesforce", slug: "salesforce", url: "https://www.salesforce.com/jp/", description: "クラウドCRMの世界的リーダー" },
  { name: "freee", slug: "freee", url: "https://www.freee.co.jp/", description: "クラウド会計・人事労務のリーディングカンパニー" },
  { name: "SmartHR", slug: "smarthr", url: "https://smarthr.jp/", description: "クラウド人事労務ソフト" },
  { name: "Slack Technologies", slug: "slack", url: "https://slack.com/intl/ja-jp/", description: "ビジネスコミュニケーションプラットフォーム" },
  { name: "Notion Labs", slug: "notion", url: "https://www.notion.so/ja-jp", description: "オールインワンワークスペース" },
  { name: "Cybozu", slug: "cybozu", url: "https://cybozu.co.jp/", description: "kintone / サイボウズ Office の開発元" },
  { name: "Chatwork", slug: "chatwork", url: "https://go.chatwork.com/ja/", description: "国産ビジネスチャット" },
  { name: "Money Forward", slug: "moneyforward", url: "https://biz.moneyforward.com/", description: "クラウド会計・経費精算" },
  { name: "Backlog", slug: "backlog", url: "https://backlog.com/ja/", description: "プロジェクト管理ツール" },
  { name: "Sansan", slug: "sansan", url: "https://jp.sansan.com/", description: "名刺管理・営業DX" },
  { name: "HubSpot", slug: "hubspot", url: "https://www.hubspot.jp/", description: "CRM・マーケティングオートメーション" },
  { name: "Asana", slug: "asana", url: "https://asana.com/ja", description: "ワークマネジメントプラットフォーム" },
];

const insertProvider = db.prepare(
  "INSERT OR IGNORE INTO providers (name, slug, url, description) VALUES (?, ?, ?, ?)"
);

for (const p of providers) {
  insertProvider.run(p.name, p.slug, p.url, p.description);
}

console.log(`Providers: ${providers.length} 件投入完了`);

// プロバイダーIDマップ
const providerMap = {};
db.prepare("SELECT id, slug FROM providers").all().forEach((r) => {
  providerMap[r.slug] = r.id;
});

// ── アイテム（SaaSツール） ──────────────────────
const items = [
  {
    title: "Salesforce Sales Cloud",
    slug: "salesforce-sales-cloud",
    category: "crm",
    provider: "salesforce",
    summary: "世界シェアNo.1のCRM/SFAプラットフォーム",
    description: "Salesforce Sales Cloudは、リード管理、商談管理、売上予測、レポート・ダッシュボードなど営業プロセス全体を支援するCRMプラットフォームです。",
    url: "https://www.salesforce.com/jp/products/sales/",
    saas: { price_monthly: 3000, price_display: "3,000円/ユーザー/月〜", has_free_plan: false, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: null, company_size_label: "全規模対応", api_available: true, mobile_app: true, support_type: "phone" },
    variants: [
      { name: "Essentials", attributes: { price_display: "3,000円/月", key_features: ["リード管理", "商談管理", "メール連携"] } },
      { name: "Professional", attributes: { price_display: "9,600円/月", key_features: ["リード管理", "商談管理", "売上予測", "ワークフロー"], is_recommended: true } },
      { name: "Enterprise", attributes: { price_display: "19,800円/月", key_features: ["全Professional機能", "高度なレポート", "API連携", "カスタムオブジェクト"] } },
    ],
    tags: ["CRM", "SFA", "営業支援", "AI搭載", "モバイル対応", "API連携"],
  },
  {
    title: "HubSpot CRM",
    slug: "hubspot-crm",
    category: "crm",
    provider: "hubspot",
    summary: "無料から始められるCRM・MA統合プラットフォーム",
    description: "HubSpot CRMは、マーケティング、セールス、カスタマーサービスを統合したプラットフォーム。無料プランから利用可能で、中小企業に人気。",
    url: "https://www.hubspot.jp/products/crm",
    saas: { price_monthly: 0, price_display: "無料〜", has_free_plan: true, has_free_trial: true, trial_days: 14, company_size_min: 1, company_size_max: 500, company_size_label: "1〜500名", api_available: true, mobile_app: true, support_type: "chat" },
    variants: [
      { name: "無料", attributes: { price_display: "0円", key_features: ["コンタクト管理", "取引管理", "タスク管理"] } },
      { name: "Starter", attributes: { price_display: "2,160円/月", key_features: ["メールマーケ", "フォーム", "広告管理"], is_recommended: true } },
      { name: "Professional", attributes: { price_display: "96,000円/月", key_features: ["MA", "ABM", "カスタムレポート", "ワークフロー"] } },
    ],
    tags: ["CRM", "MA", "無料プランあり", "マーケティング", "インバウンド"],
  },
  {
    title: "Sansan",
    slug: "sansan",
    category: "crm",
    provider: "sansan",
    summary: "名刺管理から始まる営業DXプラットフォーム",
    description: "Sansanは名刺をスキャンしてデータ化し、全社で名刺情報を共有・活用できる営業DXサービスです。",
    url: "https://jp.sansan.com/",
    saas: { price_monthly: null, price_display: "要問い合わせ", has_free_plan: false, has_free_trial: true, trial_days: 30, company_size_min: 10, company_size_max: null, company_size_label: "10名〜", api_available: true, mobile_app: true, support_type: "dedicated" },
    variants: [],
    tags: ["名刺管理", "営業DX", "CRM連携", "データ化"],
  },
  {
    title: "freee会計",
    slug: "freee-accounting",
    category: "accounting",
    provider: "freee",
    summary: "クラウド会計ソフトシェアNo.1。個人〜中小企業向け",
    description: "freee会計は、銀行口座やクレジットカードと連携し、経理業務を自動化するクラウド会計ソフトです。確定申告にも対応。",
    url: "https://www.freee.co.jp/accounting/",
    saas: { price_monthly: 1980, price_display: "1,980円/月〜", has_free_plan: false, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: 300, company_size_label: "1〜300名", api_available: true, mobile_app: true, support_type: "chat" },
    variants: [
      { name: "ミニマム", attributes: { price_display: "1,980円/月", key_features: ["確定申告", "請求書", "経費精算"] } },
      { name: "ベーシック", attributes: { price_display: "3,980円/月", key_features: ["ミニマム全機能", "経費精算", "振込", "月次推移"], is_recommended: true } },
      { name: "プロフェッショナル", attributes: { price_display: "39,800円/月", key_features: ["ベーシック全機能", "部門別会計", "予実管理", "電帳法対応"] } },
    ],
    tags: ["クラウド会計", "確定申告", "経理自動化", "銀行連携", "インボイス対応"],
  },
  {
    title: "マネーフォワード クラウド会計",
    slug: "moneyforward-accounting",
    category: "accounting",
    provider: "moneyforward",
    summary: "バックオフィス業務を一元管理するクラウド会計",
    description: "マネーフォワード クラウド会計は、銀行・カード連携による自動仕訳、決算書作成、経費精算など経理業務を効率化するクラウドサービスです。",
    url: "https://biz.moneyforward.com/accounting/",
    saas: { price_monthly: 2980, price_display: "2,980円/月〜", has_free_plan: false, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: 500, company_size_label: "1〜500名", api_available: true, mobile_app: true, support_type: "chat" },
    variants: [
      { name: "スモールビジネス", attributes: { price_display: "2,980円/月", key_features: ["自動仕訳", "請求書", "経費精算"] } },
      { name: "ビジネス", attributes: { price_display: "4,980円/月", key_features: ["スモール全機能", "部門管理", "予実管理", "ワークフロー"], is_recommended: true } },
    ],
    tags: ["クラウド会計", "経費精算", "請求書", "給与計算", "インボイス対応"],
  },
  {
    title: "SmartHR",
    slug: "smarthr",
    category: "hr",
    provider: "smarthr",
    summary: "人事・労務手続きをクラウドで効率化",
    description: "SmartHRは、入退社手続き、年末調整、マイナンバー管理など人事労務業務をペーパーレスで効率化するクラウドサービスです。",
    url: "https://smarthr.jp/",
    saas: { price_monthly: null, price_display: "要問い合わせ", has_free_plan: true, has_free_trial: false, company_size_min: 1, company_size_max: null, company_size_label: "全規模対応", api_available: true, mobile_app: true, support_type: "chat" },
    variants: [
      { name: "¥0プラン", attributes: { price_display: "0円", key_features: ["従業員情報管理", "マイナンバー管理"] } },
      { name: "スタンダード", attributes: { price_display: "要問い合わせ", key_features: ["入退社手続き", "年末調整", "社会保険", "電子申請"], is_recommended: true } },
    ],
    tags: ["人事労務", "ペーパーレス", "年末調整", "電子申請", "マイナンバー"],
  },
  {
    title: "freee人事労務",
    slug: "freee-hr",
    category: "hr",
    provider: "freee",
    summary: "給与計算・勤怠管理・年末調整をオールインワンで",
    description: "freee人事労務は、給与計算、勤怠管理、年末調整、入退社手続きなどを一元管理できるクラウド人事労務ソフトです。",
    url: "https://www.freee.co.jp/hr/",
    saas: { price_monthly: 2000, price_display: "2,000円/月〜", has_free_plan: false, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: 300, company_size_label: "1〜300名", api_available: true, mobile_app: true, support_type: "chat" },
    variants: [],
    tags: ["給与計算", "勤怠管理", "人事労務", "年末調整"],
  },
  {
    title: "Slack",
    slug: "slack",
    category: "communication",
    provider: "slack",
    summary: "世界中で使われるビジネスチャット・コラボレーションツール",
    description: "Slackは、チャンネルベースのメッセージング、ファイル共有、ビデオ通話、外部ツール連携などを提供するビジネスコミュニケーションプラットフォームです。",
    url: "https://slack.com/intl/ja-jp/",
    saas: { price_monthly: 0, price_display: "無料〜", has_free_plan: true, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: null, company_size_label: "全規模対応", api_available: true, mobile_app: true, support_type: "chat" },
    variants: [
      { name: "フリー", attributes: { price_display: "0円", key_features: ["チャンネル", "1対1メッセージ", "音声/ビデオ通話"] } },
      { name: "Pro", attributes: { price_display: "925円/月", key_features: ["無制限メッセージ履歴", "外部連携", "グループ通話"], is_recommended: true } },
      { name: "Business+", attributes: { price_display: "1,600円/月", key_features: ["Pro全機能", "SSO", "コンプライアンス", "99.99% SLA"] } },
    ],
    tags: ["ビジネスチャット", "コラボレーション", "リモートワーク", "API連携", "無料プランあり"],
  },
  {
    title: "Chatwork",
    slug: "chatwork",
    category: "communication",
    provider: "chatwork",
    summary: "国産ビジネスチャット。中小企業に人気",
    description: "Chatworkは、グループチャット、タスク管理、ファイル管理、ビデオ通話を提供する国産ビジネスチャットツールです。",
    url: "https://go.chatwork.com/ja/",
    saas: { price_monthly: 0, price_display: "無料〜", has_free_plan: true, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: 300, company_size_label: "1〜300名", api_available: true, mobile_app: true, support_type: "email" },
    variants: [
      { name: "フリー", attributes: { price_display: "0円", key_features: ["グループチャット", "タスク管理", "ファイル共有"] } },
      { name: "ビジネス", attributes: { price_display: "700円/月", key_features: ["フリー全機能", "無制限グループ", "広告非表示", "API連携"], is_recommended: true } },
    ],
    tags: ["ビジネスチャット", "タスク管理", "国産", "無料プランあり"],
  },
  {
    title: "Notion",
    slug: "notion",
    category: "project",
    provider: "notion",
    summary: "ドキュメント・Wiki・プロジェクト管理のオールインワン",
    description: "Notionは、ドキュメント作成、データベース、プロジェクト管理、Wikiを一つのワークスペースで統合するツールです。",
    url: "https://www.notion.so/ja-jp",
    saas: { price_monthly: 0, price_display: "無料〜", has_free_plan: true, has_free_trial: true, trial_days: 14, company_size_min: 1, company_size_max: null, company_size_label: "全規模対応", api_available: true, mobile_app: true, support_type: "email" },
    variants: [
      { name: "フリー", attributes: { price_display: "0円", key_features: ["個人利用", "ページ無制限", "5MB添付"] } },
      { name: "プラス", attributes: { price_display: "1,650円/月", key_features: ["チーム利用", "無制限添付", "ゲスト招待"], is_recommended: true } },
      { name: "ビジネス", attributes: { price_display: "2,500円/月", key_features: ["プラス全機能", "SAML SSO", "高度な権限管理"] } },
    ],
    tags: ["プロジェクト管理", "Wiki", "ドキュメント", "データベース", "無料プランあり", "AI搭載"],
  },
  {
    title: "Backlog",
    slug: "backlog",
    category: "project",
    provider: "backlog",
    summary: "チームのタスク・プロジェクト管理をシンプルに",
    description: "Backlogは、タスク管理、課題追跡、Wiki、Git連携などプロジェクト管理に必要な機能を備えた国産ツールです。",
    url: "https://backlog.com/ja/",
    saas: { price_monthly: 2970, price_display: "2,970円/月〜", has_free_plan: true, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: 300, company_size_label: "1〜300名", api_available: true, mobile_app: true, support_type: "email" },
    variants: [
      { name: "フリー", attributes: { price_display: "0円", key_features: ["ユーザー10人", "プロジェクト1", "100MB"] } },
      { name: "スタンダード", attributes: { price_display: "17,600円/月", key_features: ["ユーザー無制限", "プロジェクト100", "Git連携", "ガントチャート"], is_recommended: true } },
    ],
    tags: ["プロジェクト管理", "課題管理", "Git連携", "ガントチャート", "国産"],
  },
  {
    title: "Asana",
    slug: "asana",
    category: "project",
    provider: "asana",
    summary: "チームの仕事を整理・追跡するワークマネジメントツール",
    description: "Asanaは、タスク管理、プロジェクト管理、ゴール設定、ポートフォリオ管理などを提供するワークマネジメントプラットフォームです。",
    url: "https://asana.com/ja",
    saas: { price_monthly: 0, price_display: "無料〜", has_free_plan: true, has_free_trial: true, trial_days: 30, company_size_min: 1, company_size_max: null, company_size_label: "全規模対応", api_available: true, mobile_app: true, support_type: "email" },
    variants: [
      { name: "Basic", attributes: { price_display: "0円", key_features: ["タスク管理", "リストビュー", "カレンダービュー"] } },
      { name: "Premium", attributes: { price_display: "1,475円/月", key_features: ["タイムライン", "ワークフロー", "ダッシュボード"], is_recommended: true } },
    ],
    tags: ["ワークマネジメント", "タスク管理", "無料プランあり", "ワークフロー自動化"],
  },
  {
    title: "kintone",
    slug: "kintone",
    category: "project",
    provider: "cybozu",
    summary: "ノーコードで業務アプリを作成できるプラットフォーム",
    description: "kintoneは、プログラミング不要で業務アプリケーションを作成・運用できるクラウドサービスです。顧客管理、案件管理、日報など多彩な用途に対応。",
    url: "https://kintone.cybozu.co.jp/",
    saas: { price_monthly: 1650, price_display: "1,650円/ユーザー/月〜", has_free_plan: false, has_free_trial: true, trial_days: 30, company_size_min: 5, company_size_max: null, company_size_label: "5名〜", api_available: true, mobile_app: true, support_type: "phone" },
    variants: [
      { name: "ライトコース", attributes: { price_display: "1,000円/月", key_features: ["アプリ作成200個", "スペース", "ゲスト招待"] } },
      { name: "スタンダードコース", attributes: { price_display: "1,650円/月", key_features: ["ライト全機能", "JavaScript/CSSカスタマイズ", "プラグイン", "API"], is_recommended: true } },
    ],
    tags: ["ノーコード", "業務アプリ", "ワークフロー", "国産", "カスタマイズ"],
  },
];

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO items (title, slug, category, status, description, summary, url, provider_id, is_published, popularity_score)
  VALUES (?, ?, ?, 'active', ?, ?, ?, ?, 1, ?)
`);

const insertSaas = db.prepare(`
  INSERT OR IGNORE INTO saas_details (item_id, price_monthly, price_display, has_free_plan, has_free_trial,
    trial_days, company_size_min, company_size_max, company_size_label,
    api_available, mobile_app, support_type, deployment_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cloud')
`);

const insertVariant = db.prepare(
  "INSERT INTO item_variants (item_id, name, attributes_json, sort_order) VALUES (?, ?, ?, ?)"
);

const insertTag = db.prepare(
  "INSERT OR IGNORE INTO item_tags (item_id, tag, tag_group) VALUES (?, ?, 'feature')"
);

let count = 0;
for (const item of items) {
  const providerId = providerMap[item.provider];
  const popularity = 50 + Math.floor(Math.random() * 50);

  const existing = db.prepare("SELECT id FROM items WHERE slug = ?").get(item.slug);
  if (existing) {
    console.log(`  skip: ${item.title} (既存)`);
    continue;
  }

  const result = insertItem.run(
    item.title, item.slug, item.category, item.description, item.summary,
    item.url, providerId, popularity
  );

  const itemId = result.lastInsertRowid;

  if (item.saas) {
    const s = item.saas;
    insertSaas.run(
      itemId, s.price_monthly, s.price_display, s.has_free_plan ? 1 : 0,
      s.has_free_trial ? 1 : 0, s.trial_days || null,
      s.company_size_min || null, s.company_size_max || null, s.company_size_label || null,
      s.api_available ? 1 : 0, s.mobile_app ? 1 : 0, s.support_type || null
    );
  }

  if (item.variants) {
    item.variants.forEach((v, i) => {
      insertVariant.run(itemId, v.name, JSON.stringify(v.attributes || {}), i);
    });
  }

  if (item.tags) {
    item.tags.forEach((t) => insertTag.run(itemId, t));
  }

  count++;
  console.log(`  added: ${item.title}`);
}

console.log(`\nSaaSナビ初期データ: ${count} 件投入完了`);
console.log(`プロバイダー: ${providers.length} 件`);
process.exit(0);
