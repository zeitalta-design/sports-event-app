# ドメイン取得後 正式公開チェックリスト

本番ドメインを取得し、`http://IP直アクセス` から `https://本番ドメイン` へ切り替えるための手順書です。

---

## 前提

- さくら VPS 上で Docker コンテナが稼働中
- Caddy が `:80` で reverse proxy 中
- `http://133.125.38.92` で暫定公開確認済み
- パケットフィルタで TCP 22 / 80 / 443 は開放済み

関連ドキュメント:
- [deploy-guide.md](./deploy-guide.md) — Docker / Caddy の詳細手順
- [production-env-template.md](./production-env-template.md) — .env 記入ガイド
- [vps-setup-guide.md](./vps-setup-guide.md) — VPS 初期構築

---

## Phase 0: 取得前に決めること

| # | 項目 | 例 | 確認 |
|---|------|---|------|
| 0-1 | ドメイン名 | `nyusatsu-navi.jp` / `nyusatsu.example.com` | [ ] |
| 0-2 | 取得先レジストラ | お名前.com / ムームードメイン / Google Domains | [ ] |
| 0-3 | サブドメイン or 独自ドメイン | `nyusatsu.example.com` or `nyusatsu-navi.jp` | [ ] |
| 0-4 | DNS 管理場所 | レジストラ DNS / Cloudflare / さくら DNS | [ ] |
| 0-5 | 切替作業時間帯 | 深夜帯推奨 / アクセスが少ない時間 | [ ] |

---

## Phase 1: ドメイン取得 + DNS 設定

| # | 作業 | 確認 |
|---|------|------|
| 1-1 | ドメインを取得する | [ ] |
| 1-2 | DNS 管理画面で A レコードを追加する | [ ] |

```
タイプ: A
ホスト: @ (または サブドメイン名)
値:    133.125.38.92
TTL:   300 (短めにして切替を速く)
```

| 1-3 | www が必要なら CNAME も追加する | [ ] |

```
タイプ: CNAME
ホスト: www
値:    ドメイン名
```

---

## Phase 2: DNS 反映確認

| # | 作業 | 確認 |
|---|------|------|
| 2-1 | DNS 反映を確認する（最大48時間、通常は数分〜数時間） | [ ] |

確認コマンド（ローカル PC で実行）:
```
nslookup ドメイン名
```
または:
```
dig ドメイン名 A
```

期待結果: `133.125.38.92` が返ること

| 2-2 | ブラウザで `http://ドメイン名` にアクセスし、IP直アクセスと同じ画面が出ること | [ ] |

**DNS が反映されるまで次に進まないこと。**

---

## Phase 3: Caddy HTTPS 化

| # | 作業 | 確認 |
|---|------|------|
| 3-1 | SSH でサーバーに接続する | [ ] |

```
ssh ubuntu@133.125.38.92
```

| 3-2 | Caddyfile を本番ドメインに書き換える | [ ] |

```
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
ドメイン名 {
    reverse_proxy 127.0.0.1:3000
}
EOF
```

**注意:** `ドメイン名` はドメインそのもの（例: `nyusatsu-navi.jp`）に置き換えること。`:80` は削除する。Caddy はドメイン名を指定するだけで自動的に HTTPS 化する。

| 3-3 | Caddy 設定を検証する | [ ] |

```
sudo caddy validate --config /etc/caddy/Caddyfile
```

| 3-4 | Caddy を再起動する | [ ] |

```
sudo systemctl restart caddy
```

| 3-5 | 証明書取得を確認する | [ ] |

```
sudo caddy list-certificates 2>/dev/null || sudo journalctl -u caddy --no-pager -n 20
```

ログに `certificate obtained successfully` または `managed certificate` の記載があること。

| 3-6 | HTTPS でアクセスできることを確認する | [ ] |

```
curl -I https://ドメイン名
```

期待: `HTTP/2 200` が返ること。

---

## Phase 4: APP_BASE_URL 更新 + Docker 再起動

| # | 作業 | 確認 |
|---|------|------|
| 4-1 | `.env` の `APP_BASE_URL` を更新する | [ ] |

```
sudo sed -i 's|APP_BASE_URL=.*|APP_BASE_URL=https://ドメイン名|' /opt/app/web/.env
```

確認:
```
grep APP_BASE_URL /opt/app/web/.env
```

| 4-2 | Docker コンテナを再起動する | [ ] |

```
sudo docker restart navi-app
```

| 4-3 | コンテナが正常起動したことを確認する | [ ] |

```
sudo docker logs navi-app --tail 5
```

`✓ Ready` が表示されること。

---

## Phase 5: スモーク確認

| # | 確認項目 | URL | 期待 | 確認 |
|---|---------|-----|------|------|
| 5-1 | ルートページ | `https://ドメイン名/` | 200 | [ ] |
| 5-2 | マラソン一覧 | `https://ドメイン名/marathon` | 200 | [ ] |
| 5-3 | SaaS一覧 | `https://ドメイン名/saas` | 200 | [ ] |
| 5-4 | 入札ナビ一覧 | `https://ドメイン名/nyusatsu` | 200 | [ ] |
| 5-5 | 入札ナビ詳細 | `https://ドメイン名/nyusatsu/任意のslug` | 200 | [ ] |
| 5-6 | 公開API | `https://ドメイン名/api/nyusatsu` | JSON | [ ] |
| 5-7 | Admin API 保護 | `https://ドメイン名/api/admin/nyusatsu` | 401 | [ ] |
| 5-8 | HTTP→HTTPS リダイレクト | `http://ドメイン名/` | 301→HTTPS | [ ] |

---

## Phase 6: 事後確認

| # | 確認項目 | 確認 |
|---|---------|------|
| 6-1 | IP直アクセス `http://133.125.38.92` はドメインへリダイレクトまたは無応答でよい | [ ] |
| 6-2 | SSL 証明書の有効期限を確認する | [ ] |

```
echo | openssl s_client -servername ドメイン名 -connect ドメイン名:443 2>/dev/null | openssl x509 -noout -dates
```

| 6-3 | Caddy は証明書を自動更新するため、手動更新は不要であることを確認 | [ ] |

---

## ロールバック手順

問題が発生した場合、以下の順で切り戻す。

### Level 1: Caddy を IP 直アクセスに戻す

```
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
:80 {
    reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl restart caddy
```

### Level 2: APP_BASE_URL を IP に戻す

```
sudo sed -i 's|APP_BASE_URL=.*|APP_BASE_URL=http://133.125.38.92|' /opt/app/web/.env
sudo docker restart navi-app
```

### Level 3: DNS を元に戻す

DNS 管理画面で A レコードを削除または変更する。反映に時間がかかるため、Level 1-2 を先に行うこと。

---

## トラブルシューティング

| 症状 | 原因候補 | 確認方法 |
|------|---------|---------|
| ドメインでアクセスできない | DNS 未反映 | `nslookup ドメイン名` |
| HTTP はつながるが HTTPS がエラー | 証明書未取得 | `sudo journalctl -u caddy -n 30` |
| 証明書取得失敗 | 443 ブロック | パケットフィルタで TCP 443 が許可されているか |
| 503 エラー | Docker コンテナ停止 | `sudo docker ps` |
| 500 エラー | APP_BASE_URL 不整合 | `grep APP_BASE_URL /opt/app/web/.env` |
| admin にアクセスできてしまう | guard 異常 | `curl -s -o /dev/null -w '%{http_code}' https://ドメイン名/api/admin/nyusatsu` |

---

## 対象外（別タスク）

以下は本チェックリストの対象外です:
- source URL 本番投入
- cron import 設定
- Cloudflare CDN 設定
- 監視設定
- バックアップ強化
- sitemap の URL 更新
