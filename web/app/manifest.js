export default function manifest() {
  return {
    name: "スポ活",
    short_name: "スポ活",
    description: "全国のスポーツ大会を探せる検索・通知サービス",
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
