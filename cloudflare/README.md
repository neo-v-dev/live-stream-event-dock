# YouTube CORS Proxy (Cloudflare Workers)

YouTubeへのリクエストを中継し、CORSヘッダーを付与するプロキシ。

## デプロイ方法

### 方法1: Cloudflareダッシュボード（簡単）

1. [Cloudflare](https://dash.cloudflare.com/) にログイン（アカウントがなければ作成）
2. 左メニュー「Workers & Pages」をクリック
3. 「Create application」→「Create Worker」
4. 名前を入力（例: `youtube-cors-proxy`）
5. 「Deploy」をクリック
6. 「Edit code」をクリック
7. `worker.js` の内容を貼り付けて「Save and Deploy」

デプロイ後のURL:
```
https://youtube-cors-proxy.<your-subdomain>.workers.dev
```

### 方法2: Wrangler CLI

```bash
# Wranglerインストール
npm install -g wrangler

# ログイン
wrangler login

# デプロイ
cd cloudflare
wrangler deploy
```

## 使用方法

デプロイ後、`js/youtube-chat.js` の `PROXY_URL` を設定:

```javascript
const PROXY_URL = 'https://youtube-cors-proxy.<your-subdomain>.workers.dev';
```

## 料金

| プラン | リクエスト数 | 料金 |
|--------|-------------|------|
| Free | 10万/日 | 無料 |
| Paid | 1000万/月含む | $5/月〜 |

通常の配信利用（3秒間隔ポーリング）では無料枠で十分です。
