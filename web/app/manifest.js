export default function manifest() {
  return {
    name: "大会ナビ",
    short_name: "大会ナビ",
    description: "公開データ / 業務DBカタログ — 行政処分・入札情報・補助金など業務で使える情報を横断検索",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    // アイコン画像を作成後に差し替え
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
