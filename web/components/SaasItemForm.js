"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saasConfig } from "@/lib/saas-config";

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SaasItemForm({ itemId }) {
  const router = useRouter();
  const isEdit = !!itemId;
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);

  const [form, setForm] = useState({
    title: "", slug: "", category: "", subcategory: "", status: "active",
    description: "", summary: "", url: "", hero_image_url: "",
    price_min: "", price_max: "", provider_id: "", is_published: false,
  });

  const [saas, setSaas] = useState({
    price_monthly: "", price_display: "",
    has_free_plan: false, has_free_trial: false, trial_days: "",
    company_size_min: "", company_size_max: "", company_size_label: "",
    api_available: false, mobile_app: false,
    support_type: "", deployment_type: "cloud",
  });

  const [variants, setVariants] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);

  // プロバイダー読み込み
  useEffect(() => {
    fetch("/api/admin/providers").then((r) => r.json()).then((d) => setProviders(d.providers || []));
  }, []);

  // 編集時のデータ読み込み
  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/admin/items/${itemId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.item) {
          setForm({
            title: d.item.title || "", slug: d.item.slug || "",
            category: d.item.category || "", subcategory: d.item.subcategory || "",
            status: d.item.status || "active", description: d.item.description || "",
            summary: d.item.summary || "", url: d.item.url || "",
            hero_image_url: d.item.hero_image_url || "",
            price_min: d.item.price_min ?? "", price_max: d.item.price_max ?? "",
            provider_id: d.item.provider_id ?? "", is_published: !!d.item.is_published,
          });
        }
        if (d.saas) {
          setSaas({
            price_monthly: d.saas.price_monthly ?? "",
            price_display: d.saas.price_display || "",
            has_free_plan: !!d.saas.has_free_plan,
            has_free_trial: !!d.saas.has_free_trial,
            trial_days: d.saas.trial_days ?? "",
            company_size_min: d.saas.company_size_min ?? "",
            company_size_max: d.saas.company_size_max ?? "",
            company_size_label: d.saas.company_size_label || "",
            api_available: !!d.saas.api_available,
            mobile_app: !!d.saas.mobile_app,
            support_type: d.saas.support_type || "",
            deployment_type: d.saas.deployment_type || "cloud",
          });
        }
        if (d.variants) {
          setVariants(d.variants.map((v) => ({
            name: v.name,
            attributes: JSON.parse(v.attributes_json || "{}"),
          })));
        }
        if (d.tags) {
          setTags(d.tags.map((t) => ({ tag: t.tag, tag_group: t.tag_group })));
        }
      });
  }, [isEdit, itemId]);

  function updateForm(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !isEdit) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  function addVariant() {
    setVariants((prev) => [...prev, { name: "", attributes: {} }]);
  }
  function removeVariant(i) {
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateVariant(i, key, value) {
    setVariants((prev) => prev.map((v, idx) =>
      idx === i ? { ...v, [key]: value } : v
    ));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.some((x) => x.tag === t)) return;
    setTags((prev) => [...prev, { tag: t, tag_group: "feature" }]);
    setTagInput("");
  }
  function removeTag(tag) {
    setTags((prev) => prev.filter((t) => t.tag !== tag));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        item: {
          ...form,
          price_min: form.price_min !== "" ? Number(form.price_min) : null,
          price_max: form.price_max !== "" ? Number(form.price_max) : null,
          provider_id: form.provider_id ? Number(form.provider_id) : null,
        },
        saas: {
          ...saas,
          price_monthly: saas.price_monthly !== "" ? Number(saas.price_monthly) : null,
          trial_days: saas.trial_days !== "" ? Number(saas.trial_days) : null,
          company_size_min: saas.company_size_min !== "" ? Number(saas.company_size_min) : null,
          company_size_max: saas.company_size_max !== "" ? Number(saas.company_size_max) : null,
        },
        variants,
        tags,
      };

      const url = isEdit ? `/api/admin/items/${itemId}` : "/api/admin/items";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "保存に失敗しました");
        return;
      }

      router.push("/admin/saas-items");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm";
  const labelCls = "block text-xs font-bold text-gray-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本情報 */}
      <fieldset className="card p-6">
        <legend className="section-title mb-4">基本情報</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>ツール名 *</label>
            <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>スラッグ</label>
            <input value={form.slug} onChange={(e) => updateForm("slug", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>ベンダー</label>
            <select value={form.provider_id} onChange={(e) => updateForm("provider_id", e.target.value)} className={inputCls}>
              <option value="">選択...</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>カテゴリ *</label>
            <select value={form.category} onChange={(e) => updateForm("category", e.target.value)} className={inputCls} required>
              <option value="">選択...</option>
              {saasConfig.categories.map((c) => <option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>ステータス</label>
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className={inputCls}>
              {saasConfig.statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>概要（短文）</label>
            <input value={form.summary} onChange={(e) => updateForm("summary", e.target.value)} className={inputCls} maxLength={100} placeholder="100文字以内" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>詳細説明</label>
            <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} className={inputCls} rows={5} />
          </div>
          <div>
            <label className={labelCls}>公式サイトURL</label>
            <input type="url" value={form.url} onChange={(e) => updateForm("url", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>画像URL</label>
            <input value={form.hero_image_url} onChange={(e) => updateForm("hero_image_url", e.target.value)} className={inputCls} />
          </div>
        </div>
      </fieldset>

      {/* SaaS情報 */}
      <fieldset className="card p-6">
        <legend className="section-title mb-4">SaaS情報</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>月額最低料金（円）</label>
            <input type="number" value={saas.price_monthly} onChange={(e) => setSaas({ ...saas, price_monthly: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>料金表示テキスト</label>
            <input value={saas.price_display} onChange={(e) => setSaas({ ...saas, price_display: e.target.value })} className={inputCls} placeholder="例: 980円/月〜" />
          </div>
          <div>
            <label className={labelCls}>企業規模ラベル</label>
            <input value={saas.company_size_label} onChange={(e) => setSaas({ ...saas, company_size_label: e.target.value })} className={inputCls} placeholder="例: 1〜300名" />
          </div>
          <div>
            <label className={labelCls}>サポート体制</label>
            <select value={saas.support_type} onChange={(e) => setSaas({ ...saas, support_type: e.target.value })} className={inputCls}>
              <option value="">未設定</option>
              {Object.entries(saasConfig.supportTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-4 md:col-span-2">
            {[
              ["has_free_plan", "無料プラン"],
              ["has_free_trial", "無料トライアル"],
              ["api_available", "API連携"],
              ["mobile_app", "モバイルアプリ"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={saas[key]} onChange={(e) => setSaas({ ...saas, [key]: e.target.checked })} className="rounded" />
                {label}
              </label>
            ))}
          </div>
          {saas.has_free_trial && (
            <div>
              <label className={labelCls}>トライアル日数</label>
              <input type="number" value={saas.trial_days} onChange={(e) => setSaas({ ...saas, trial_days: e.target.value })} className={inputCls} />
            </div>
          )}
        </div>
      </fieldset>

      {/* プラン */}
      <fieldset className="card p-6">
        <legend className="section-title mb-4">料金プラン</legend>
        {variants.map((v, i) => (
          <div key={i} className="border rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>プラン名</label>
              <button type="button" onClick={() => removeVariant(i)} className="text-xs text-red-500">削除</button>
            </div>
            <input value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} className={inputCls} placeholder="例: Professional" />
          </div>
        ))}
        <button type="button" onClick={addVariant} className="btn-secondary text-xs">+ プラン追加</button>
      </fieldset>

      {/* タグ */}
      <fieldset className="card p-6">
        <legend className="section-title mb-4">タグ・特徴</legend>
        <div className="flex gap-2 mb-3">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            className={inputCls}
            placeholder="タグを入力してEnter..."
          />
          <button type="button" onClick={addTag} className="btn-secondary text-xs whitespace-nowrap">追加</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t.tag} className="badge badge-blue flex items-center gap-1">
              {t.tag}
              <button type="button" onClick={() => removeTag(t.tag)} className="text-blue-400 hover:text-blue-700">×</button>
            </span>
          ))}
        </div>
      </fieldset>

      {/* 公開設定 & 保存 */}
      <div className="card p-6 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => updateForm("is_published", e.target.checked)}
            className="rounded"
          />
          <span className="font-bold">公開する</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/admin/saas-items")} className="btn-secondary">キャンセル</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "保存中..." : isEdit ? "更新" : "登録"}</button>
        </div>
      </div>
    </form>
  );
}
