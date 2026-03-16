import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "大会ナビ — 全国のスポーツ大会を探す";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 700,
              color: "#2563eb",
              marginRight: 20,
            }}
          >
            大
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "white",
            }}
          >
            大会ナビ
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.85)",
            marginTop: 8,
          }}
        >
          全国のスポーツ大会を探す・比較する・通知を受け取る
        </div>
        <div
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.6)",
            marginTop: 24,
          }}
        >
          taikainavi.com
        </div>
      </div>
    ),
    { ...size }
  );
}
