# オーバーレイ作成マニュアル

コメントドックからイベントを受信して表示するカスタムオーバーレイの作成方法です。

---

## 目次

1. [クイックスタート](#クイックスタート)
2. [基本構造](#基本構造)
3. [イベントの受信方法](#イベントの受信方法)
4. [受信できるデータ](#受信できるデータ)
5. [実装例](#実装例)
6. [OBSへの追加方法](#obsへの追加方法)
7. [テンプレート](#テンプレート)

---

## クイックスタート

最短でオーバーレイを作成する手順です。

### Step 1: フォルダ作成

`overlays` フォルダ内に新しいフォルダを作成します。

```
stream_manager/
└── overlays/
    └── my-overlay/    ← 新規作成
```

### Step 2: HTMLファイル作成

`my-overlay/index.html` を作成し、以下をコピペ:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>My Overlay</title>
  <style>
    body { background: transparent; margin: 0; font-family: sans-serif; }
    .alert {
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: #667eea;
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-size: 24px;
      display: none;
    }
    .alert.show { display: block; animation: fadeIn 0.3s; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body>
  <div id="alert" class="alert"></div>

  <script>
    // ========== 設定 ==========
    // 受信するイベント名（ルール設定の「イベント名」と一致させる）
    const EVENT_NAME = 'my-event';

    // OBS WebSocket接続先（ドックと同じ設定を自動取得）
    const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
    const OBS_ADDRESS = settings.obsAddress || 'ws://localhost:4455';
    const OBS_PASSWORD = settings.obsPassword || '';

    // ========== 表示処理 ==========
    const alertEl = document.getElementById('alert');

    function showAlert(payload) {
      // payload にはコメント情報が入っている
      alertEl.textContent = `${payload.user}: ${payload.message}`;
      alertEl.classList.add('show');
      setTimeout(() => alertEl.classList.remove('show'), 5000);
    }

    // ========== OBS WebSocket接続 ==========
    let obsSocket = null;

    async function connectToOBS() {
      console.log('OBS接続中:', OBS_ADDRESS);
      obsSocket = new WebSocket(OBS_ADDRESS);

      obsSocket.onopen = () => console.log('WebSocket接続成功');

      obsSocket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.op === 0) {
          // Hello -> 認証
          const auth = msg.d.authentication && OBS_PASSWORD
            ? await generateAuth(OBS_PASSWORD, msg.d.authentication.salt, msg.d.authentication.challenge)
            : null;
          obsSocket.send(JSON.stringify({
            op: 1,
            d: { rpcVersion: 1, eventSubscriptions: 1, authentication: auth }
          }));
        } else if (msg.op === 2) {
          console.log('OBS認証成功 - イベント待機中');
        } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
          // カスタムイベント受信
          const { type, payload } = msg.d.eventData;
          console.log('イベント受信:', type, payload);

          // 指定したイベント名の場合に処理
          if (type === EVENT_NAME) {
            showAlert(payload);
          }
        }
      };

      obsSocket.onclose = () => {
        console.log('OBS切断 - 5秒後に再接続');
        setTimeout(connectToOBS, 5000);
      };

      obsSocket.onerror = (err) => console.error('WebSocketエラー:', err);
    }

    async function generateAuth(password, salt, challenge) {
      const encoder = new TextEncoder();
      const step1 = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
      const step1B64 = btoa(String.fromCharCode(...new Uint8Array(step1)));
      const step2 = await crypto.subtle.digest('SHA-256', encoder.encode(step1B64 + challenge));
      return btoa(String.fromCharCode(...new Uint8Array(step2)));
    }

    // 起動
    connectToOBS();
  </script>
</body>
</html>
```

### Step 3: イベント名を変更

HTMLファイル内の `EVENT_NAME` を、使いたいイベント名に変更:

```javascript
const EVENT_NAME = 'my-event';  // ← ここを変更
```

### Step 4: OBSにブラウザソースを追加

1. OBS → ソース → + → **ブラウザ**
2. 設定:
   - **URL**: `file:///C:/path/to/stream_manager/overlays/my-overlay/index.html`
   - **幅**: 1920
   - **高さ**: 1080

### Step 5: ドック側でルールを設定

1. コメントドックの「ルール」タブを開く
2. 「+ 追加」をクリック
3. 設定:
   - **ルール名**: 任意
   - **条件**: キーワード、コマンド等
   - **アクション**: 「オーバーレイへ送信」
   - **イベント名**: `my-event`（Step 3で設定した名前）
4. 保存

### Step 6: 動作確認

1. オーバーレイのブラウザソースを右クリック → 「対話」
2. 右クリック → 「検証」でコンソールを開く
3. 「OBS認証成功 - イベント待機中」が表示されていることを確認
4. YouTubeでルール条件に合うコメントを投稿
5. オーバーレイに表示されれば成功！

---

## 基本構造

オーバーレイは以下の3ファイルで構成します：

```
overlays/
└── your-overlay/
    ├── index.html    # メインHTML
    ├── style.css     # スタイル
    └── app.js        # JavaScript
```

### 最小構成のHTML

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>オーバーレイ名</title>
  <style>
    body {
      /* OBSブラウザソースで透過させるため */
      background: transparent;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <!-- 表示コンテンツ -->
  <div id="container"></div>

  <script>
    // イベント受信コード（後述）
  </script>
</body>
</html>
```

---

## イベントの受信方法

コメントドックからのイベントは **OBS WebSocket** 経由で受信します。
ドックとオーバーレイの両方がOBS WebSocketに接続し、`BroadcastCustomEvent` でイベントを共有します。

### 基本コード

```javascript
// OBS WebSocket接続
let obsSocket = null;

async function connectToOBS() {
  // 接続先（ドックと同じ設定を使用）
  const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
  const address = settings.obsAddress || 'ws://localhost:4455';
  const password = settings.obsPassword || '';

  obsSocket = new WebSocket(address);

  obsSocket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    await handleOBSMessage(message, password);
  };

  obsSocket.onclose = () => {
    // 5秒後に再接続
    setTimeout(connectToOBS, 5000);
  };
}

async function handleOBSMessage(message, password) {
  const { op, d } = message;

  switch (op) {
    case 0: // Hello - 認証開始
      await identify(d, password);
      break;

    case 2: // Identified - 認証成功
      console.log('OBS接続完了');
      break;

    case 5: // Event
      if (d.eventType === 'CustomEvent') {
        // カスタムイベントを受信！
        const { type, payload, timestamp } = d.eventData;
        console.log('イベント受信:', type, payload);

        // ここで処理を分岐
        switch (type) {
          case 'your-event-name':
            // 処理を書く
            break;
        }
      }
      break;
  }
}

// OBS認証
async function identify(helloData, password) {
  const identifyData = {
    rpcVersion: 1,
    eventSubscriptions: 1 // General events (CustomEvent含む)
  };

  if (helloData.authentication && password) {
    identifyData.authentication = await generateAuth(
      password,
      helloData.authentication.salt,
      helloData.authentication.challenge
    );
  }

  obsSocket.send(JSON.stringify({ op: 1, d: identifyData }));
}

// SHA-256認証文字列生成
async function generateAuth(password, salt, challenge) {
  const encoder = new TextEncoder();

  const step1Data = encoder.encode(password + salt);
  const step1Hash = await crypto.subtle.digest('SHA-256', step1Data);
  const step1Base64 = btoa(String.fromCharCode(...new Uint8Array(step1Hash)));

  const step2Data = encoder.encode(step1Base64 + challenge);
  const step2Hash = await crypto.subtle.digest('SHA-256', step2Data);
  return btoa(String.fromCharCode(...new Uint8Array(step2Hash)));
}

// 起動時に接続
connectToOBS();
```

---

## 受信できるデータ

### イベントデータの構造

```javascript
// d.eventData の内容
{
  type: "イベント名",           // ルール設定の「イベント名」
  payload: { ... },            // 詳細データ（下記参照）
  timestamp: 1234567890123     // 送信時刻
}
```

### payload の内容

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `message` | string | コメント本文 |
| `user` | string | ユーザー表示名 |
| `userId` | string | YouTubeチャンネルID (UCxxxx) |
| `profileImage` | string | プロフィール画像URL |
| `isOwner` | boolean | 配信者かどうか |
| `isModerator` | boolean | モデレーターかどうか |
| `isMember` | boolean | メンバーかどうか |
| `isFirstComment` | boolean | この配信での初コメントかどうか |
| `amount` | string | スパチャ金額（表示用: "¥1,000"） |
| `amountValue` | number | スパチャ金額（数値: 1000） |
| `currency` | string | 通貨コード（"JPY"など） |
| `isNewSponsor` | boolean | 新規メンバー加入かどうか |
| `membershipGiftCount` | number | メンバーシップギフト数 |
| `ruleName` | string | トリガーしたルール名 |
| `timestamp` | number | イベント発生時刻 |

### payload の例

**通常コメントの場合:**
```javascript
{
  message: "こんにちは！",
  user: "視聴者A",
  userId: "UCxxxxxxxxxx",
  profileImage: "https://yt3.ggpht.com/...",
  isOwner: false,
  isModerator: false,
  isMember: true,
  isFirstComment: true,
  amount: "",
  amountValue: 0,
  currency: "",
  isNewSponsor: false,
  membershipGiftCount: 0,
  ruleName: "キーワード反応",
  timestamp: 1705234567890
}
```

**スーパーチャットの場合:**
```javascript
{
  message: "応援してます！",
  user: "スパチャさん",
  userId: "UCyyyyyyyyyy",
  profileImage: "https://yt3.ggpht.com/...",
  isOwner: false,
  isModerator: false,
  isMember: false,
  isFirstComment: false,
  amount: "¥1,000",
  amountValue: 1000,
  currency: "JPY",
  isNewSponsor: false,
  membershipGiftCount: 0,
  ruleName: "スパチャアラート",
  timestamp: 1705234567890
}
```

---

## 実装例

### 例1: シンプルなアラート表示

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body { background: transparent; }
    .alert {
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: #667eea;
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-size: 24px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .alert.show { opacity: 1; }
  </style>
</head>
<body>
  <div id="alert" class="alert"></div>
  <script>
    const alertEl = document.getElementById('alert');
    let obsSocket = null;

    function showAlert(message) {
      alertEl.textContent = message;
      alertEl.classList.add('show');
      setTimeout(() => alertEl.classList.remove('show'), 3000);
    }

    async function connectToOBS() {
      const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
      const address = settings.obsAddress || 'ws://localhost:4455';
      const password = settings.obsPassword || '';

      obsSocket = new WebSocket(address);
      obsSocket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.op === 0) {
          // Hello -> Identify
          const auth = msg.d.authentication && password
            ? await generateAuth(password, msg.d.authentication.salt, msg.d.authentication.challenge)
            : null;
          obsSocket.send(JSON.stringify({
            op: 1,
            d: { rpcVersion: 1, eventSubscriptions: 1, authentication: auth }
          }));
        } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
          if (msg.d.eventData.type === 'show-alert') {
            showAlert(msg.d.eventData.payload.message);
          }
        }
      };
      obsSocket.onclose = () => setTimeout(connectToOBS, 5000);
    }

    async function generateAuth(password, salt, challenge) {
      const encoder = new TextEncoder();
      const step1 = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
      const step1B64 = btoa(String.fromCharCode(...new Uint8Array(step1)));
      const step2 = await crypto.subtle.digest('SHA-256', encoder.encode(step1B64 + challenge));
      return btoa(String.fromCharCode(...new Uint8Array(step2)));
    }

    connectToOBS();
  </script>
</body>
</html>
```

**対応するルール設定:**
- 条件: キーワード「!alert」
- アクション: オーバーレイへ送信
- イベント名: `show-alert`

---

### 例2: スーパーチャット表示

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body { background: transparent; font-family: sans-serif; }
    .superchat {
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #f5af19, #f12711);
      color: white;
      padding: 20px;
      border-radius: 16px;
      min-width: 300px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      display: none;
    }
    .superchat.show { display: block; animation: popIn 0.5s; }
    .superchat .header { display: flex; align-items: center; gap: 12px; }
    .superchat .avatar { width: 50px; height: 50px; border-radius: 50%; }
    .superchat .name { font-weight: bold; font-size: 18px; }
    .superchat .amount { font-size: 32px; font-weight: bold; margin: 15px 0; }
    .superchat .message { font-size: 16px; opacity: 0.9; }
    @keyframes popIn {
      0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
      100% { transform: translateX(-50%) scale(1); opacity: 1; }
    }
  </style>
</head>
<body>
  <div id="superchat" class="superchat">
    <div class="header">
      <img id="avatar" class="avatar" src="" alt="">
      <span id="name" class="name"></span>
    </div>
    <div id="amount" class="amount"></div>
    <div id="message" class="message"></div>
  </div>

  <script>
    const container = document.getElementById('superchat');
    let obsSocket = null;

    function showSuperchat(payload) {
      document.getElementById('avatar').src = payload.profileImage;
      document.getElementById('name').textContent = payload.user;
      document.getElementById('amount').textContent = payload.amount;
      document.getElementById('message').textContent = payload.message;

      container.classList.add('show');
      setTimeout(() => container.classList.remove('show'), 8000);
    }

    async function connectToOBS() {
      const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
      const address = settings.obsAddress || 'ws://localhost:4455';
      const password = settings.obsPassword || '';

      obsSocket = new WebSocket(address);
      obsSocket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.op === 0) {
          const auth = msg.d.authentication && password
            ? await generateAuth(password, msg.d.authentication.salt, msg.d.authentication.challenge)
            : null;
          obsSocket.send(JSON.stringify({
            op: 1,
            d: { rpcVersion: 1, eventSubscriptions: 1, authentication: auth }
          }));
        } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
          if (msg.d.eventData.type === 'superchat') {
            showSuperchat(msg.d.eventData.payload);
          }
        }
      };
      obsSocket.onclose = () => setTimeout(connectToOBS, 5000);
    }

    async function generateAuth(password, salt, challenge) {
      const encoder = new TextEncoder();
      const step1 = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
      const step1B64 = btoa(String.fromCharCode(...new Uint8Array(step1)));
      const step2 = await crypto.subtle.digest('SHA-256', encoder.encode(step1B64 + challenge));
      return btoa(String.fromCharCode(...new Uint8Array(step2)));
    }

    connectToOBS();
  </script>
</body>
</html>
```

**対応するルール設定:**
- 条件: スーパーチャット（最低金額: 0）
- アクション: オーバーレイへ送信
- イベント名: `superchat`

---

### 例3: コメントティッカー（流れるコメント）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body { background: transparent; overflow: hidden; }
    .ticker {
      position: fixed;
      bottom: 20px;
      white-space: nowrap;
      font-size: 28px;
      color: white;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      animation: scroll 10s linear;
    }
    @keyframes scroll {
      0% { transform: translateX(100vw); }
      100% { transform: translateX(-100%); }
    }
  </style>
</head>
<body>
  <div id="container"></div>

  <script>
    const container = document.getElementById('container');
    let obsSocket = null;

    function addTicker(user, message) {
      const div = document.createElement('div');
      div.className = 'ticker';
      div.textContent = `${user}: ${message}`;
      container.appendChild(div);
      div.addEventListener('animationend', () => div.remove());
    }

    async function connectToOBS() {
      const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
      const address = settings.obsAddress || 'ws://localhost:4455';
      const password = settings.obsPassword || '';

      obsSocket = new WebSocket(address);
      obsSocket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.op === 0) {
          const auth = msg.d.authentication && password
            ? await generateAuth(password, msg.d.authentication.salt, msg.d.authentication.challenge)
            : null;
          obsSocket.send(JSON.stringify({
            op: 1,
            d: { rpcVersion: 1, eventSubscriptions: 1, authentication: auth }
          }));
        } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
          if (msg.d.eventData.type === 'ticker') {
            const p = msg.d.eventData.payload;
            addTicker(p.user, p.message);
          }
        }
      };
      obsSocket.onclose = () => setTimeout(connectToOBS, 5000);
    }

    async function generateAuth(password, salt, challenge) {
      const encoder = new TextEncoder();
      const step1 = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
      const step1B64 = btoa(String.fromCharCode(...new Uint8Array(step1)));
      const step2 = await crypto.subtle.digest('SHA-256', encoder.encode(step1B64 + challenge));
      return btoa(String.fromCharCode(...new Uint8Array(step2)));
    }

    connectToOBS();
  </script>
</body>
</html>
```

---

## OBSへの追加方法

1. **OBSを開く**

2. **ブラウザソースを追加**
   - ソース → + → ブラウザ

3. **設定**
   ```
   URL: file:///C:/path/to/stream_manager/overlays/your-overlay/index.html
   幅: 1920（配信解像度に合わせる）
   高さ: 1080（配信解像度に合わせる）
   ```

4. **透過設定の確認**
   - HTMLの`body`に`background: transparent;`が設定されていることを確認

---

## テンプレート

新しいオーバーレイを作る際のテンプレートです。

### index.html
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>オーバーレイ名</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="container"></div>
  <script src="app.js"></script>
</body>
</html>
```

### style.css
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: transparent;
  font-family: 'Noto Sans JP', sans-serif;
  overflow: hidden;
}

/* ここにスタイルを追加 */
```

### app.js
```javascript
/**
 * オーバーレイ名
 * OBS WebSocket経由でイベントを受信
 */
let obsSocket = null;

async function connectToOBS() {
  const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
  const address = settings.obsAddress || 'ws://localhost:4455';
  const password = settings.obsPassword || '';

  console.log('OBS接続中:', address);
  obsSocket = new WebSocket(address);

  obsSocket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.op === 0) {
      // Hello -> Identify
      const auth = msg.d.authentication && password
        ? await generateAuth(password, msg.d.authentication.salt, msg.d.authentication.challenge)
        : null;
      obsSocket.send(JSON.stringify({
        op: 1,
        d: { rpcVersion: 1, eventSubscriptions: 1, authentication: auth }
      }));
    } else if (msg.op === 2) {
      console.log('OBS接続完了');
    } else if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
      const { type, payload, timestamp } = msg.d.eventData;
      handleEvent(type, payload);
    }
  };

  obsSocket.onclose = () => {
    console.log('OBS切断 - 5秒後に再接続');
    setTimeout(connectToOBS, 5000);
  };
}

async function generateAuth(password, salt, challenge) {
  const encoder = new TextEncoder();
  const step1 = await crypto.subtle.digest('SHA-256', encoder.encode(password + salt));
  const step1B64 = btoa(String.fromCharCode(...new Uint8Array(step1)));
  const step2 = await crypto.subtle.digest('SHA-256', encoder.encode(step1B64 + challenge));
  return btoa(String.fromCharCode(...new Uint8Array(step2)));
}

function handleEvent(type, payload) {
  console.log('イベント受信:', type, payload);

  switch (type) {
    case 'your-event-name':
      // 処理を実装
      break;

    // 他のイベントタイプを追加
  }
}

// デバッグ用: コンソールからテスト可能
window.test = () => {
  handleEvent('your-event-name', {
    message: 'テストメッセージ',
    user: 'テストユーザー'
  });
};

// 起動時に接続
connectToOBS();
```

---

## トラブルシューティング

### イベントが受信できない

1. **OBS WebSocket接続を確認**
   - コンソールに「OBS接続完了」が表示されているか
   - OBSのWebSocketサーバーが有効になっているか

2. **接続先アドレスを確認**
   - ドックと同じアドレス・パスワードを使用しているか
   - `localStorage.getItem('streamManagerSettings')` で設定を確認

3. **イベント名を確認**
   - ルール設定の「イベント名」とオーバーレイの`type`チェックが一致しているか

4. **コンソールを確認**
   - F12（または右クリック→検証）でDevToolsを開いてエラーがないか確認

### 背景が透過しない

- `body { background: transparent; }` を設定
- OBSブラウザソースの「カスタムCSS」が空か確認

### アニメーションがカクつく

- `transform` や `opacity` を使用（`top`, `left` の直接変更は避ける）
- `will-change` プロパティを活用
