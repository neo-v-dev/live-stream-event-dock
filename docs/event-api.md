# Live Stream Event API 仕様書

本ドキュメントでは、Live Stream Event Dockが送信するイベントの詳細仕様を定義します。

---

## 概要

Live Stream Event Dockは、OBS WebSocketの`BroadcastCustomEvent`を使用してイベントを配信します。オーバーレイやその他のクライアントは、OBS WebSocketに接続してこれらのイベントを受信できます。

---

## イベント配信の仕組み

```
┌─────────────────────┐
│ YouTube Live Chat   │
│ (Chrome Extension)  │
└─────────┬───────────┘
          │ CustomEvent: YouTubeLiveChat
          ▼
┌─────────────────────┐
│ Live Stream Event   │
│ Dock                │
│ - イベント判定      │
│ - ルール評価        │
│ - セッション管理    │
└─────────┬───────────┘
          │ BroadcastCustomEvent: LiveStreamEvent
          ▼
┌─────────────────────┐
│ OBS WebSocket       │
│ (BroadcastCustomEvent)
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌───────┐   ┌───────┐
│Overlay│   │Client │
└───────┘   └───────┘
```

---

## 共通構造

すべてのイベントは以下の共通構造を持ちます。

### OBS WebSocket メッセージ

```javascript
{
  op: 5,                    // Event opcode
  d: {
    eventType: "CustomEvent",
    eventData: {
      eventName: "LiveStreamEvent",  // 設定で変更可能
      eventData: {
        // イベント本体（下記参照）
      }
    }
  }
}
```

### イベント本体構造

```javascript
{
  type: "EventType",              // イベントタイプ（必須）
  timestamp: "ISO8601",           // イベント発生時刻（必須）
  liveChatId: "xxx...",           // YouTube Live Chat ID（v1.2.0+）
  sessionId: "session_xxx_yyy",   // セッションID（必須）
  user: { ... },                  // ユーザー情報（任意）
  payload: { ... }                // イベント固有データ（必須）
}
```

> **Note**: `liveChatId` はYouTube配信ごとに固有のIDです。配信が切り替わるとこのIDも変わります。Chrome拡張機能のバージョンによっては取得できない場合があり、その場合は `null` になります。

### ユーザー情報 (user)

```javascript
{
  channelId: "UCxxxxxxxxxx",      // YouTubeチャンネルID
  displayName: "ユーザー名",       // 表示名
  profileImageUrl: "https://...", // プロフィール画像URL
  isOwner: false,                 // 配信者かどうか
  isModerator: false,             // モデレーターかどうか
  isMember: true,                 // メンバーかどうか
  session: {
    messageCount: 5,              // セッション内メッセージ数
    superChatTotal: 1000,         // セッション内スパチャ累計（円）
    superChatCount: 2,            // セッション内スパチャ回数
    giftCount: 0,                 // セッション内ギフト回数
    firstSeenAt: "ISO8601"        // セッション内初コメント時刻
  }
}
```

---

## 自動イベント

以下のイベントは条件を満たすと自動的に送信されます。

### FirstComment

ユーザーがセッション内で初めてコメントした際に送信されます。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"FirstComment"` |
| `user` | object | ユーザー情報 |
| `payload.message` | string | コメント内容 |

```javascript
{
  type: "FirstComment",
  timestamp: "2025-01-15T12:34:56.789Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    message: "こんにちは！"
  }
}
```

### SuperChat

スーパーチャットを受信した際に送信されます。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"SuperChat"` |
| `user` | object | ユーザー情報 |
| `payload.amount` | number | 金額（円換算） |
| `payload.amountMicros` | number | 金額（マイクロ単位） |
| `payload.amountDisplayString` | string | 表示用金額文字列 |
| `payload.currency` | string | 通貨コード |
| `payload.tier` | number | スパチャティア（色レベル） |
| `payload.message` | string | コメント内容 |
| `payload.sessionTotal` | number | そのユーザーのセッション内スパチャ累計 |
| `payload.superChatCount` | number | そのユーザーのセッション内スパチャ回数 |
| `payload.isFirstSuperchat` | boolean | セッション内初スパチャかどうか |

```javascript
{
  type: "SuperChat",
  timestamp: "2025-01-15T12:35:00.000Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    amount: 1000,
    amountMicros: 1000000000,
    amountDisplayString: "¥1,000",
    currency: "JPY",
    tier: 2,
    message: "応援してます！",
    sessionTotal: 3000,
    superChatCount: 3,
    isFirstSuperchat: false
  }
}
```

### Membership

新規メンバーが加入した際に送信されます。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"Membership"` |
| `user` | object | ユーザー情報 |
| `payload.type` | string | `"new"` |
| `payload.levelName` | string | メンバーシップレベル名 |

```javascript
{
  type: "Membership",
  timestamp: "2025-01-15T12:36:00.000Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    type: "new",
    levelName: "メンバー"
  }
}
```

### MembershipGift

メンバーシップギフトが送信された際に送信されます。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"MembershipGift"` |
| `user` | object | ユーザー情報（贈り主） |
| `payload.count` | number | ギフト数 |
| `payload.levelName` | string | メンバーシップレベル名 |
| `payload.sessionGiftTotal` | number | そのユーザーのセッション内ギフト累計 |
| `payload.isFirstGift` | boolean | セッション内初ギフトかどうか |

```javascript
{
  type: "MembershipGift",
  timestamp: "2025-01-15T12:37:00.000Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    count: 5,
    levelName: "メンバー",
    sessionGiftTotal: 10,
    isFirstGift: false
  }
}
```

### MemberMilestone

マイルストーンチャット（メンバー継続記念）が送信された際に送信されます。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"MemberMilestone"` |
| `user` | object | ユーザー情報 |
| `payload.memberMonth` | number | メンバー継続月数 |
| `payload.memberLevelName` | string | メンバーシップレベル名 |
| `payload.userComment` | string | ユーザーのコメント |

```javascript
{
  type: "MemberMilestone",
  timestamp: "2025-01-15T12:38:00.000Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    memberMonth: 6,
    memberLevelName: "メンバー",
    userComment: "半年記念！"
  }
}
```

### SessionStats

セッションの累計統計を送信します。5秒ごと、およびスパチャ/ギフト受信時に送信されます。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"SessionStats"` |
| `payload.superChatTotal` | number | スパチャ累計金額（円） |
| `payload.giftTotal` | number | ギフト累計数 |
| `payload.newMemberTotal` | number | 新規メンバー累計数（ギフト除く） |
| `payload.newViewerTotal` | number | 初見さん累計数（v1.2.0+） |
| `payload.uniqueUsers` | number | ユニークユーザー数 |
| `payload.totalMessages` | number | 総メッセージ数 |
| `payload.youtube` | object | YouTube統計（v1.2.0+） |
| `payload.youtube.concurrentViewers` | number | 同時接続数 |
| `payload.youtube.likeCount` | number | 高評価数 |
| `payload.youtube.viewCount` | number | 総視聴回数 |
| `payload.customCounters` | object | カスタムカウンター（v1.2.0+） |

```javascript
{
  type: "SessionStats",
  timestamp: "2025-01-15T12:40:00.000Z",
  liveChatId: "Cg0KC2FiY2RlZmdoaWpr",
  sessionId: "session_abc_123",
  payload: {
    superChatTotal: 50000,
    giftTotal: 25,
    newMemberTotal: 10,
    newViewerTotal: 120,
    uniqueUsers: 150,
    totalMessages: 500,
    youtube: {
      concurrentViewers: 1234,
      likeCount: 500,
      viewCount: 12345
    },
    customCounters: {
      "morning_count": 5,
      "dice_rolls": 12
    }
  }
}
```

> **注意**: SessionStatsにはuser情報が含まれません。
> **注意**: `youtube`プロパティはChrome拡張機能 v1.2.0以上が必要です。未対応の場合は値が0になります。
> **注意**: `customCounters`はルールで「カウンターに追加」を設定した場合にのみ値が含まれます。

### Comment

通常コメントを転送します（デフォルト無効）。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"Comment"` |
| `user` | object | ユーザー情報 |
| `payload.message` | string | コメント内容 |

```javascript
{
  type: "Comment",
  timestamp: "2025-01-15T12:41:00.000Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    message: "コメント内容"
  }
}
```

### OwnerComment / ModeratorComment / MemberComment

配信者・モデレーター・メンバーのコメント（デフォルト無効）。

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"OwnerComment"` / `"ModeratorComment"` / `"MemberComment"` |
| `user` | object | ユーザー情報 |
| `payload.message` | string | コメント内容 |

---

## ルールイベント

イベントルールの条件に一致した場合に送信されるカスタムイベントです。

### Custom

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"Custom"` |
| `user` | object | ユーザー情報 |
| `payload.eventType` | string | ルールで設定したイベントタイプ |
| `payload.ruleId` | string | ルールID |
| `payload.ruleName` | string | ルール名 |
| `payload.message` | string | コメント内容 |
| `payload.customData` | object | ルールで設定したカスタムデータ（任意） |

```javascript
{
  type: "Custom",
  timestamp: "2025-01-15T12:42:00.000Z",
  sessionId: "session_abc_123",
  user: { /* ユーザー情報 */ },
  payload: {
    eventType: "Congratulation",
    ruleId: "rule_xyz_789",
    ruleName: "おめでとうルール",
    message: "おめでとう！",
    customData: {
      effect: "confetti"
    }
  }
}
```

---

## イベント受信方法

### OBS WebSocket接続コード例

```javascript
class EventReceiver {
  constructor(address = 'ws://localhost:4455', password = '') {
    this.address = address;
    this.password = password;
    this.socket = null;
  }

  connect() {
    this.socket = new WebSocket(this.address);

    this.socket.onopen = () => {
      console.log('Connected to OBS WebSocket');
    };

    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = () => {
      console.log('Disconnected from OBS WebSocket');
      // 自動再接続
      setTimeout(() => this.connect(), 5000);
    };
  }

  handleMessage(msg) {
    // 認証要求への応答
    if (msg.op === 0) {
      this.authenticate(msg.d);
      return;
    }

    // 認証成功
    if (msg.op === 2) {
      console.log('Authenticated successfully');
      return;
    }

    // イベント受信
    if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
      const { eventName, eventData } = msg.d.eventData;

      // イベント名でフィルタ
      if (eventName === 'LiveStreamEvent') {
        this.onEvent(eventData);
      }
    }
  }

  authenticate(hello) {
    // 認証なしの場合
    if (!hello.authentication) {
      this.socket.send(JSON.stringify({
        op: 1,
        d: { rpcVersion: 1 }
      }));
      return;
    }

    // 認証ありの場合
    const { challenge, salt } = hello.authentication;
    const secret = this.generateSecret(this.password, salt, challenge);

    this.socket.send(JSON.stringify({
      op: 1,
      d: {
        rpcVersion: 1,
        authentication: secret
      }
    }));
  }

  async generateSecret(password, salt, challenge) {
    const encoder = new TextEncoder();
    const secretHash = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(password + salt)
    );
    const secretBase64 = btoa(String.fromCharCode(...new Uint8Array(secretHash)));
    const authHash = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(secretBase64 + challenge)
    );
    return btoa(String.fromCharCode(...new Uint8Array(authHash)));
  }

  onEvent(eventData) {
    const { type, user, payload } = eventData;
    console.log(`Event received: ${type}`, payload);

    // イベントタイプに応じた処理
    switch (type) {
      case 'FirstComment':
        // 初コメント処理
        break;
      case 'SuperChat':
        // スパチャ処理
        break;
      case 'SessionStats':
        // 統計更新処理
        break;
      case 'Custom':
        // カスタムイベント処理
        break;
      default:
        break;
    }
  }
}

// 使用例
const receiver = new EventReceiver('ws://localhost:4455', 'your-password');
receiver.connect();
```

---

## 設定オプション

### イベント名の変更

デフォルトのイベント名は `LiveStreamEvent` ですが、設定タブで変更できます。複数のドックを使用する場合に、イベント名で区別することが可能です。

### 元メッセージを含める

「元メッセージを含める」オプションを有効にすると、イベントに元のYouTubeメッセージデータが `originalMessage` フィールドとして追加されます。

```javascript
{
  type: "FirstComment",
  // ... 通常のフィールド
  originalMessage: {
    // Chrome拡張機能から受信した元データ
  }
}
```

---

## バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0.0 | 2025-01-15 | 初版リリース |
| 1.1.0 | 2025-01-18 | SessionStatsにnewMemberTotal追加、セッション持続機能追加 |
| 1.2.0 | 2026-01-18 | viewerCount/likeCount条件追加、SessionStatsにyoutube統計追加、起動済み状態の永続化 |
| 1.2.0 | 2026-01-21 | liveChatIdによるセッション管理、カスタムカウンター機能、ユーザーごとに1回発火制御、newViewerTotal追加 |
