"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { REGIONS, MONTHS } from "@/lib/constants";
import AuthGuard from "@/components/AuthGuard";

const DISTANCES = [
  { key: "", label: "指定なし" },
  { key: "5", label: "〜5km" },
  { key: "10", label: "〜10km" },
  { key: "half", label: "ハーフ" },
  { key: "full", label: "フル" },
  { key: "ultra", label: "ウルトラ" },
];

function formatCondition(search) {
  const parts = [];
  if (search.prefecture) parts.push(search.prefecture);
  if (search.keyword) parts.push(`「${search.keyword}」`);
  if (search.event_month) parts.push(`${search.event_month}月`);
  if (search.filters_json) {
    try {
      const f = JSON.parse(search.filters_json);
      if (f.distance) {
        const labels = { "5": "〜5km", "10": "〜10km", half: "ハーフ", full: "フル", ultra: "ウルトラ" };
        parts.push(labels[f.distance] || f.distance);
      }
    } catch {}
  }
  return parts.length > 0 ? parts.join(" / ") : "条件なし";
}

function buildSearchUrl(search) {
  const params = new URLSearchParams();
  if (search.keyword) params.set("keyword", search.keyword);
  if (search.prefecture) params.set("prefecture", search.prefecture);
  if (search.event_month) params.set("month", search.event_month);
  if (search.filters_json) {
    try {
      const f = JSON.parse(search.filters_json);
      if (f.distance) params.set("distance", f.distance);
    } catch {}
  }
  const qs = params.toString();
  return `/marathon${qs ? `?${qs}` : ""}`;
}

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    keyword: "",
    prefecture: "",
    event_month: "",
    distance: "",
  });

  useEffect(() => {
    fetchSearches();
  }, []);

  async function fetchSearches() {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-searches");
      const data = await res.json();
      setSearches(data.searches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.keyword && !form.prefecture && !form.event_month && !form.distance) {
      setMessage("少なくとも1つの条件を指定してください");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage("保存しました");
        setForm({ keyword: "", prefecture: "", event_month: "", distance: "" });
        fetchSearches();
      } else {
        const data = await res.json();
        setMessage(data.error || "保存に失敗しました");
      }
    } catch (err) {
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSearches((s) => s.filter((x) => x.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  }

  const allPrefectures = REGIONS.flatMap((r) => r.prefectures);

  return (
    <AuthGuard>
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">保存検索</h1>
      <p className="text-sm text-gray-500 mb-6">よく使う検索条件を保存して、すぐに検索できます</p>

      {/* 新規保存フォーム */}
      <div className="card p-5 mb-8">
        <h2 className="font-bold text-gray-900 mb-3">新規保存</h2>
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">キーワード</label>
              <input
                type="text"
                placeholder="大会名"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">都道府県</label>
              <select
                value={form.prefecture}
                onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">指定なし</option>
                {allPrefectures.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">開催月</label>
              <select
                value={form.event_month}
                onChange={(e) => setForm({ ...form, event_month: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">指定なし</option>
                {MONTHS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">距離</label>
              <select
                value={form.distance}
                onChange={(e) => setForm({ ...form, distance: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DISTANCES.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "この条件を保存"}
            </button>
            {message && (
              <span className={`text-sm ${message.includes("失敗") || message.includes("少なくとも") ? "text-red-500" : "text-green-600"}`}>
                {message}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 保存済み一覧 */}
      <h2 className="font-bold text-gray-900 mb-3">保存済み ({searches.length}件)</h2>
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : searches.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">保存された検索条件はありません</p>
          <p className="text-gray-400 text-xs mt-1">上のフォームから条件を保存するか、一覧ページで「この条件を保存」を使ってください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((s) => (
            <div key={s.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{formatCondition(s)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  保存日: {new Date(s.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={buildSearchUrl(s)}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  この条件で検索
                </Link>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
