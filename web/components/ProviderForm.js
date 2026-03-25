"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ProviderForm({ providerId }) {
  const router = useRouter();
  const isEdit = !!providerId;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", url: "", logo_url: "", description: "",
  });

  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/admin/providers/${providerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) setForm(d.provider);
      });
  }, [isEdit, providerId]);

  function update(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !isEdit) next.slug = slugify(value);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/providers/${providerId}` : "/api/admin/providers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "保存に失敗しました");
        return;
      }
      router.push("/admin/saas-providers");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">ベンダー名 *</label>
        <input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputCls} required />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">スラッグ</label>
        <input value={form.slug} onChange={(e) => update("slug", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">企業サイトURL</label>
        <input type="url" value={form.url || ""} onChange={(e) => update("url", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">ロゴURL</label>
        <input value={form.logo_url || ""} onChange={(e) => update("logo_url", e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">説明</label>
        <textarea value={form.description || ""} onChange={(e) => update("description", e.target.value)} className={inputCls} rows={3} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => router.push("/admin/saas-providers")} className="btn-secondary">キャンセル</button>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "保存中..." : isEdit ? "更新" : "登録"}</button>
      </div>
    </form>
  );
}
