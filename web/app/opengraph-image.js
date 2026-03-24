import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "スポログ — 全国のスポーツ大会を探す";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  // ロゴ画像をBase64で読み込み
  let logoSrc = null;
  try {
    const logoPath = join(process.cwd(), "public", "logo-banner.png");
    const logoData = readFileSync(logoPath);
    logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  } catch {
    // ロゴが見つからない場合はテキストフォールバック
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        {/* ロゴ */}
        {logoSrc ? (
          <img
            src={logoSrc}
            width={400}
            height={120}
            style={{ objectFit: "contain", marginBottom: 32 }}
          />
        ) : (
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              marginBottom: 32,
              letterSpacing: "0.05em",
            }}
          >
            スポログ
          </div>
        )}

        {/* キャッチコピー */}
        <div
          style={{
            fontSize: 32,
            color: "rgba(255,255,255,0.9)",
            fontWeight: 600,
            marginTop: 8,
          }}
        >
          全国のスポーツ大会を探す・比較する・通知を受け取る
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            marginTop: 32,
            letterSpacing: "0.1em",
          }}
        >
          sportlog.com
        </div>
      </div>
    ),
    { ...size }
  );
}
