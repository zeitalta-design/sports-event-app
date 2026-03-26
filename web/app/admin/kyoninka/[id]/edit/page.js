"use client";
import { useParams } from "next/navigation";
import AdminFormPage from "@/components/admin/AdminFormPage";
import { kyoninkaConfig } from "@/lib/kyoninka-config";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const FIELDS = [
  { key: "slug", label: "Slug", required: true },
  { key: "entity_name", label: "事業者名", required: true },
  { key: "corporate_number", label: "法人番号" },
  { key: "prefecture", label: "都道府県", type: "select", options: [{ value: "", label: "選択" }, ...PREFECTURES.map((p) => ({ value: p, label: p }))] },
  { key: "city", label: "市区町村" },
  { key: "address", label: "住所" },
  { key: "entity_status", label: "事業者状態", type: "select", options: kyoninkaConfig.entityStatuses.map((s) => ({ value: s.value, label: s.label })) },
  { key: "primary_license_family", label: "主要許認可カテゴリ", type: "select", options: [{ value: "", label: "選択" }, ...kyoninkaConfig.licenseFamilies.map((f) => ({ value: f.slug, label: `${f.icon} ${f.label}` }))] },
  { key: "source_name", label: "情報元名" },
  { key: "source_url", label: "情報元URL" },
  { key: "notes", label: "備考", type: "textarea" },
  { key: "is_published", label: "公開状態", type: "checkbox", checkLabel: "公開する" },
];

export default function KyoninkaEditPage() {
  const { id } = useParams();
  return (
    <AdminFormPage
      title="許認可事業者 編集"
      apiPath="/api/admin/kyoninka"
      basePath="/admin/kyoninka"
      itemId={Number(id)}
      fields={FIELDS}
    />
  );
}
