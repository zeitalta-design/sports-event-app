# Caddy HTTPS 設定手順

## 本番構成
- VPS: 133.125.38.92（さくらVPS）
- ドメイン: taikainavi.jp
- Caddy v2.11.2（systemd で稼働中）
- アプリは Docker コンテナ `navi-app` で 127.0.0.1:3000 に応答

## 現在の Caddyfile

```
taikainavi.jp {
    reverse_proxy 127.0.0.1:3000

    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

www.taikainavi.jp {
    redir https://taikainavi.jp{uri} permanent
}
```

## リダイレクト動作
- `http://taikainavi.jp` → `https://taikainavi.jp` (Caddy 自動)
- `http://www.taikainavi.jp` → `https://www.taikainavi.jp` → `https://taikainavi.jp`
- `https://www.taikainavi.jp` → `https://taikainavi.jp`

## 証明書
Caddy は Let's Encrypt 証明書を自動取得・自動更新する。

手動確認:
```bash
sudo caddy version
sudo systemctl status caddy
```

## APP_BASE_URL
`https://taikainavi.jp` — deploy-vps.sh のデフォルトとして設定済み。
