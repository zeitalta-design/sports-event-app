# kyoninka 取得改善 技術調査メモ

## 現状の問題
国交省建設業者検索システム（etsuran2.mlit.go.jp）はサーバーサイド session に依存する Java ベースのWeb アプリケーション。単純な POST 送信では検索結果のHTMLを取得できない。

## 調査した取得方法

### 1. 単純 POST 送信（現在の実装）
- **結果**: HTML は返るが、検索結果テーブルが空。session が確立されていないため。
- **評価**: ❌ 不十分

### 2. Cookie / session 維持付きリクエスト
- **方法**: まず GET で検索フォームページを取得し、Set-Cookie を保存 → その Cookie を使って POST 送信
- **実装難易度**: 中
- **評価**: ⚠️ 試す価値あり。ただし JSESSIONID の管理が必要
- **実装方針**:
  ```javascript
  // Step 1: GET で session 確立
  const formRes = await fetch(formUrl);
  const cookies = formRes.headers.get('set-cookie');
  // Step 2: Cookie 付きで POST
  const searchRes = await fetch(actionUrl, {
    method: 'POST',
    headers: { 'Cookie': cookies },
    body: formData,
  });
  ```

### 3. ブラウザ自動操作（Puppeteer / Playwright）
- **方法**: ヘッドレスブラウザで検索フォームを操作し、レンダリング後のHTMLを取得
- **実装難易度**: 高（依存パッケージ追加が必要）
- **評価**: ✅ 最も確実だが、リソースコストが高い
- **必要パッケージ**: `puppeteer` or `playwright`
- **注意**: サーバー環境では Chrome/Chromium のインストールが必要

### 4. 代替ソース
- **国交省の説明ページ** (mlit.go.jp/totikensangyo/): 一覧はないが制度説明あり
- **各都道府県の建設業許可業者名簿**: 都道府県によってはHTMLで公開
- **法人番号公表サイト API**: 法人名→法人番号の照合に使える（許可情報は含まない）
- **評価**: △ 補助的に使える

### 5. JS レンダリング経由（render-as-a-service）
- **方法**: Browserless, ScrapingBee 等の外部サービスを利用
- **実装難易度**: 低（API呼び出しのみ）
- **評価**: ⚠️ コスト発生するが手軽
- **注意**: 商用利用の場合は利用規約確認

## 推奨方針

### 短期（次フェーズ）
1. **Cookie 維持付き POST** を試す（追加依存なし）
2. 成功すれば最もコスト効率が良い

### 中期
3. Cookie 方式で不十分なら **Playwright** を導入
4. `npm install playwright` + ヘッドレスChrome

### 長期
5. 都道府県の建設業許可者名簿を補助ソースとして追加
6. 法人番号 API との統合名寄せ

## 環境変数（追加予定）
```
HOUJIN_API_ID=your-app-id  # 法人番号API
```

## 次のアクション
1. Cookie 維持付き POST の実装（`fetchMlitWithSession()`）
2. 成功/失敗の切り分け
3. 失敗時は Playwright 導入を検討
