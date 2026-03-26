"use client";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { foodRecallConfig } from "@/lib/food-recall-config";

const FIELDS = [
  { key: "slug", label: "Slug", required: true, placeholder: "例: maker-product-recall-2026" },
  { key: "product_name", label: "商品名", required: true },
  { key: "manufacturer", label: "製造者", placeholder: "例: 株式会社〇〇食品" },
  { key: "category", label: "食品カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...foodRecallConfig.categories.map((c) => ({ value: c.slug, label: `${c.icon} ${c.label}` }))] },
  { key: "recall_type", label: "リコール種別", type: "select", options: foodRecallConfig.recallTypes.map((t) => ({ value: t.value, label: t.label })) },
  { key: "reason", label: "原因", type: "select", options: [{ value: "", label: "選択" }, ...foodRecallConfig.reasons.map((r) => ({ value: r.value, label: r.label }))] },
  { key: "risk_level", label: "リスクレベル", type: "select", options: foodRecallConfig.riskLevels.map((r) => ({ value: r.value, label: r.label })) },
  { key: "affected_area", label: "対象地域", placeholder: "例: 全国" },
  { key: "lot_number", label: "ロット番号", placeholder: "例: LOT2026-001" },
  { key: "recall_date", label: "リコール日", placeholder: "例: 2026-03-25" },
  { key: "summary", label: "概要", type: "textarea" },
  { key: "consumer_action", label: "消費者への対応", type: "textarea", placeholder: "例: 商品を購入された方は食べずに返品してください" },
  { key: "source_url", label: "情報元URL", placeholder: "https://..." },
  { key: "manufacturer_url", label: "製造者URL", placeholder: "https://..." },
  { key: "status", label: "状態", type: "select", options: foodRecallConfig.statusOptions.map((s) => ({ value: s.value, label: s.label })) },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function FoodRecallNewPage() {
  return (
    <AdminFormPage
      title="食品リコール 新規作成"
      apiPath="/api/admin/food-recall"
      basePath="/admin/food-recall"
      fields={FIELDS}
      defaults={{ is_published: 1, category: "other", status: "active", recall_type: "voluntary", risk_level: "unknown", reason: "other" }}
    />
  );
}
