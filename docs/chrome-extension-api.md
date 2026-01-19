# YouTube Live Chat to OBS Extension - API仕様書

**Version:** 1.1.0
**対応拡張機能:** v1.2.0
**Last Updated:** 2026-01-18

---

## 概要

この拡張機能は、YouTubeライブチャットのデータをOBS WebSocket v5経由で配信します。開発者はOBS Browser SourceまたはWebSocketクライアントを使用して、チャットデータを受信・表示できます。

---

## OBS WebSocket イベント仕様

### プロトコル

| 項目 | 値 |
|------|-----|
| プロトコル | OBS WebSocket v5 |
| イベント種別 | `CustomEvent` |
| チャットイベント名 | `YouTubeLiveChat`（デフォルト） |
| 統計イベント名 | `YouTubeLiveStats`（デフォルト）[v1.2.0追加] |

### イベント構造

OBS WebSocketの`CustomEvent`として以下の形式で送信されます。

#### チャットイベント（YouTubeLiveChat）

```typescript
interface OBSChatEvent {
  eventType: "CustomEvent";
  eventData: {
    eventName: string;      // デフォルト: "YouTubeLiveChat"
    eventData: LiveChatMessage;
  };
}
```

#### 統計イベント（YouTubeLiveStats）[v1.2.0追加]

```typescript
interface OBSStatsEvent {
  eventType: "CustomEvent";
  eventData: {
    eventName: string;      // デフォルト: "YouTubeLiveStats"
    eventData: VideoResource;
  };
}
```

---

## 統計データ形式（v1.2.0追加）

### VideoResource

YouTube Data API v3 `videos`リソースと互換性のある形式です。

```typescript
interface VideoResource {
  kind: "youtube#video";
  etag: string;
  id: string;
  statistics: VideoStatistics;
  liveStreamingDetails?: LiveStreamingDetails;
}
```

### VideoStatistics

```typescript
interface VideoStatistics {
  viewCount: string;       // 総視聴回数
  likeCount: string;       // 高評価数
  commentCount?: string;   // コメント数（取得可能な場合）
}
```

### LiveStreamingDetails

```typescript
interface LiveStreamingDetails {
  actualStartTime?: string;      // 配信開始時刻（ISO 8601）
  concurrentViewers?: string;    // 同時接続数（配信中のみ）
  activeLiveChatId?: string;     // ライブチャットID
}
```

### サンプルデータ（統計）

```json
{
  "kind": "youtube#video",
  "etag": "",
  "id": "dQw4w9WgXcQ",
  "statistics": {
    "viewCount": "123456",
    "likeCount": "5000"
  },
  "liveStreamingDetails": {
    "actualStartTime": "2026-01-18T10:00:00Z",
    "concurrentViewers": "1234",
    "activeLiveChatId": "Cg0KC..."
  }
}
```

### 更新間隔

| 項目 | 値 |
|------|-----|
| YouTubeのポーリング | 15-30秒 |
| OBSへの送信（スロットリング） | 最低10秒間隔 |

---

## 受信方法

### 方法1: OBS Browser Source

OBSのブラウザソース内で`obsCustomEvent`イベントをリッスンします。

```javascript
window.addEventListener('obsCustomEvent', (event) => {
  const data = event.detail;

  // チャットメッセージ
  if (data.eventName === 'YouTubeLiveChat') {
    const message = data.eventData;
    console.log('Author:', message.authorDetails.displayName);
    console.log('Message:', message.snippet.displayMessage);
    console.log('Type:', message.snippet.type);
  }

  // 統計情報（v1.2.0追加）
  if (data.eventName === 'YouTubeLiveStats') {
    const stats = data.eventData;
    console.log('Viewers:', stats.liveStreamingDetails?.concurrentViewers);
    console.log('Likes:', stats.statistics?.likeCount);
    console.log('Views:', stats.statistics?.viewCount);
  }
});
```

### 方法2: WebSocketクライアント（obs-websocket-js）

外部アプリケーションからOBS WebSocketに接続してイベントを受信します。

```javascript
import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

await obs.connect('ws://localhost:4455', 'your-password');

obs.on('CustomEvent', (data) => {
  // チャットメッセージ
  if (data.eventName === 'YouTubeLiveChat') {
    const message = data.eventData;
    // メッセージを処理
  }

  // 統計情報（v1.2.0追加）
  if (data.eventName === 'YouTubeLiveStats') {
    const stats = data.eventData;
    console.log('Viewers:', stats.liveStreamingDetails?.concurrentViewers);
    console.log('Likes:', stats.statistics?.likeCount);
  }
});
```

### 方法3: 生WebSocket接続

OBS WebSocket v5プロトコルに直接接続する場合:

```javascript
const ws = new WebSocket('ws://localhost:4455');

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  // OpCode 5 = Event
  if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
    const customData = msg.d.eventData;
    if (customData.eventName === 'YouTubeLiveChat') {
      const message = customData.eventData;
      // メッセージを処理
    }
  }
};

// 認証処理が必要（Hello → Identify → Identified フロー）
```

---

## メッセージデータ形式

### LiveChatMessage

YouTube Data API v3 `liveChatMessages`リソースと互換性のある形式です。

```typescript
interface LiveChatMessage {
  kind: "youtube#liveChatMessage";
  etag: string;
  id: string;
  snippet: LiveChatMessageSnippet;
  authorDetails: AuthorDetails;
}
```

### snippet

```typescript
interface LiveChatMessageSnippet {
  type: MessageType;
  liveChatId: string;
  authorChannelId: string;
  publishedAt: string;           // ISO 8601形式
  hasDisplayContent: boolean;
  displayMessage: string;

  // typeに応じた詳細（下記参照）
  textMessageDetails?: TextMessageDetails;
  superChatDetails?: SuperChatDetails;
  superStickerDetails?: SuperStickerDetails;
  newSponsorDetails?: NewSponsorDetails;
  memberMilestoneChatDetails?: MemberMilestoneChatDetails;
  membershipGiftingDetails?: MembershipGiftingDetails;
  giftMembershipReceivedDetails?: GiftMembershipReceivedDetails;
}
```

### authorDetails

```typescript
interface AuthorDetails {
  channelId: string;
  channelUrl: string;
  displayName: string;
  profileImageUrl: string;
  isVerified: boolean;
  isChatOwner: boolean;
  isChatSponsor: boolean;      // メンバーシップ加入者
  isChatModerator: boolean;
}
```

---

## メッセージタイプ

### MessageType

```typescript
type MessageType =
  | "textMessageEvent"              // 通常チャット
  | "superChatEvent"                // スーパーチャット
  | "superStickerEvent"             // スーパーステッカー
  | "newSponsorEvent"               // 新規メンバーシップ
  | "memberMilestoneChatEvent"      // メンバーシップ継続記念
  | "membershipGiftingEvent"        // メンバーシップギフト購入
  | "giftMembershipReceivedEvent";  // メンバーシップギフト受取
```

---

## タイプ別詳細

### textMessageEvent

通常のチャットメッセージ。

```typescript
interface TextMessageDetails {
  messageText: string;
  messageRuns?: MessageRun[];  // 絵文字を含む場合
}

interface MessageRun {
  text?: string;
  emoji?: {
    emojiId: string;
    shortcuts: string[];
    image: {
      thumbnails: Array<{
        url: string;
        width?: number;
        height?: number;
      }>;
    };
    isCustomEmoji: boolean;
  };
}
```

### superChatEvent

スーパーチャット（投げ銭）。

```typescript
interface SuperChatDetails {
  amountMicros: number;          // マイクロ単位（1,000,000 = 1通貨単位）
  amountDisplayString: string;   // 表示用文字列（例: "¥1,000"）
  currency: string;              // ISO 4217通貨コード（例: "JPY"）
  tier: number;                  // 1-7（色に対応）
  userComment: string;
}
```

#### スーパーチャットティア

| tier | 色 | 金額目安（JPY） |
|------|-----|----------------|
| 1 | Blue | ¥100-199 |
| 2 | Cyan | ¥200-499 |
| 3 | Green | ¥500-999 |
| 4 | Yellow | ¥1,000-1,999 |
| 5 | Orange | ¥2,000-4,999 |
| 6 | Magenta | ¥5,000-9,999 |
| 7 | Red | ¥10,000+ |

### superStickerEvent

スーパーステッカー。

```typescript
interface SuperStickerDetails {
  amountMicros: number;
  amountDisplayString: string;
  currency: string;
  tier: number;
  superStickerMetadata: {
    stickerId: string;
    altText: string;
    altTextLanguage: string | undefined;  // 常にundefined（InnerTubeに情報なし）
  };
}
```

### newSponsorEvent

新規メンバーシップ加入。

```typescript
interface NewSponsorDetails {
  memberLevelName: string;         // メンバーシップレベル名
  isUpgrade: boolean | undefined;  // 常にundefined（InnerTubeに情報なし）
}
```

### memberMilestoneChatEvent

メンバーシップ継続記念メッセージ。

```typescript
interface MemberMilestoneChatDetails {
  memberLevelName: string;
  memberMonth: number;       // 継続月数
  userComment: string;
}
```

### membershipGiftingEvent

メンバーシップギフト購入。

```typescript
interface MembershipGiftingDetails {
  giftMembershipsCount: number;      // ギフト数
  giftMembershipsLevelName: string;  // ギフトしたレベル
}
```

### giftMembershipReceivedEvent

メンバーシップギフト受取。

```typescript
interface GiftMembershipReceivedDetails {
  memberLevelName: string;
  gifterChannelId: string | undefined;                      // ギフト購入イベント受信時に取得可能
  associatedMembershipGiftingMessageId: string | undefined; // 常にundefined（InnerTubeに情報なし）
}
```

---

## サンプルデータ

### 通常チャット

```json
{
  "kind": "youtube#liveChatMessage",
  "etag": "abc123",
  "id": "LCC.CjgKDQoLdmlkZW9faWRfMTIzEicKGFVDxxxxxxxxxxxxxxxxELd...",
  "snippet": {
    "type": "textMessageEvent",
    "liveChatId": "LiveChat_video_id_123",
    "authorChannelId": "UCxxxxxxxxxxxx",
    "publishedAt": "2026-01-17T12:00:00.000Z",
    "hasDisplayContent": true,
    "displayMessage": "こんにちは！",
    "textMessageDetails": {
      "messageText": "こんにちは！"
    }
  },
  "authorDetails": {
    "channelId": "UCxxxxxxxxxxxx",
    "channelUrl": "https://www.youtube.com/channel/UCxxxxxxxxxxxx",
    "displayName": "視聴者名",
    "profileImageUrl": "https://yt3.ggpht.com/...",
    "isVerified": false,
    "isChatOwner": false,
    "isChatSponsor": false,
    "isChatModerator": false
  }
}
```

### スーパーチャット

```json
{
  "kind": "youtube#liveChatMessage",
  "etag": "def456",
  "id": "SC.CjgKDQoLdmlkZW9faWRfMTIzEicKGFVDxxxxxxxxxxxxxxxxELd...",
  "snippet": {
    "type": "superChatEvent",
    "liveChatId": "LiveChat_video_id_123",
    "authorChannelId": "UCxxxxxxxxxxxx",
    "publishedAt": "2026-01-17T12:01:00.000Z",
    "hasDisplayContent": true,
    "displayMessage": "応援しています！",
    "superChatDetails": {
      "amountMicros": "1000000000",
      "amountDisplayString": "¥1,000",
      "currency": "JPY",
      "tier": 4,
      "userComment": "応援しています！"
    }
  },
  "authorDetails": {
    "channelId": "UCxxxxxxxxxxxx",
    "channelUrl": "https://www.youtube.com/channel/UCxxxxxxxxxxxx",
    "displayName": "スパチャ視聴者",
    "profileImageUrl": "https://yt3.ggpht.com/...",
    "isVerified": false,
    "isChatOwner": false,
    "isChatSponsor": true,
    "isChatModerator": false
  }
}
```

---

## OBS WebSocket v5 接続

### 接続シーケンス

```
クライアント                    OBSサーバー
    |                              |
    |--- WebSocket接続 ----------->|
    |                              |
    |<-------- Hello (op: 0) ------|
    |                              |
    |--- Identify (op: 1) -------->|
    |   (認証が必要な場合は        |
    |    authenticationを含む)     |
    |                              |
    |<------ Identified (op: 2) ---|
    |                              |
    |<-------- Event (op: 5) ------|
    |   (CustomEventを含む)        |
```

### OpCode一覧

| OpCode | 名前 | 方向 |
|--------|------|------|
| 0 | Hello | Server → Client |
| 1 | Identify | Client → Server |
| 2 | Identified | Server → Client |
| 5 | Event | Server → Client |
| 6 | Request | Client → Server |
| 7 | RequestResponse | Server → Client |

### 認証（SHA-256）

```javascript
// 認証文字列の生成
async function generateAuth(password, challenge, salt) {
  const encoder = new TextEncoder();

  // Step 1: base64(sha256(password + salt))
  const passSaltHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(password + salt)
  );
  const passSaltBase64 = btoa(
    String.fromCharCode(...new Uint8Array(passSaltHash))
  );

  // Step 2: base64(sha256(base64_secret + challenge))
  const authHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(passSaltBase64 + challenge)
  );
  return btoa(String.fromCharCode(...new Uint8Array(authHash)));
}
```

---

## 互換性

### YouTube Data API v3

本拡張機能のデータ形式は以下と互換性があります:

#### チャットメッセージ

- **API**: YouTube Data API v3
- **リソース**: `liveChatMessages`
- **リファレンス**: https://developers.google.com/youtube/v3/live/docs/liveChatMessages
- **参照日**: 2026-01-17

#### 統計情報（v1.2.0追加）

- **API**: YouTube Data API v3
- **リソース**: `videos`（part=statistics,liveStreamingDetails）
- **リファレンス**: https://developers.google.com/youtube/v3/docs/videos
- **参照日**: 2026-01-18

### 公式APIとの相違点

#### 拡張タイプ（公式APIに存在しない）

| タイプ | 説明 |
|--------|------|
| `systemMessageEvent` | システムメッセージ（配信開始通知等）。`liveChatViewerEngagementMessageRenderer`をパース |

#### 条件付きで取得可能なフィールド

| フィールド | 条件 |
|-----------|------|
| `giftMembershipReceivedDetails.gifterChannelId` | ギフト購入イベントを受信済みの場合のみ取得可能。購入イベントと受取イベントをハンドル(@username)で相関付けて取得。 |

#### 常に`undefined`を返すフィールド

以下のフィールドはInnerTube APIの制約により取得できません:

| フィールド | 理由 |
|-----------|------|
| `newSponsorDetails.isUpgrade` | InnerTubeに該当情報が含まれていない |
| `superStickerMetadata.altTextLanguage` | InnerTubeに言語情報が含まれていない |
| `giftMembershipReceivedDetails.associatedMembershipGiftingMessageId` | InnerTubeに該当情報が含まれていない |

#### その他の相違点

| 項目 | 公式API | 本実装 | 備考 |
|------|---------|--------|------|
| `etag` | リソースバージョン | 空文字列 | InnerTubeはetagを提供しない |
| ページネーション | `pageInfo`, `nextPageToken` | なし | リアルタイムストリーミングのため不要 |

### OBS WebSocket

- **プロトコル**: obs-websocket 5.x
- **リファレンス**: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
- **参照日**: 2026-01-17

---

## 制限事項

1. **接続先制限**: 拡張機能からのWebSocket接続はlocalhost/127.0.0.1/プライベートIPのみ許可
2. **イベント名制限**: 英数字、ハイフン、アンダースコアのみ（最大100文字）
3. **アーカイブ非対応**: ライブ配信中のみ動作（アーカイブ/プレミア公開では動作しません）
4. **認証**: OBS WebSocketのパスワードはブラウザセッション内のみ保持（永続化されません）

---

## エラーハンドリング

クライアント側でイベント受信時にエラーが発生した場合の推奨対応:

```javascript
window.addEventListener('obsCustomEvent', (event) => {
  try {
    const data = event.detail;
    if (data.eventName !== 'YouTubeLiveChat') return;

    const message = data.eventData;

    // 必須フィールドの存在確認
    if (!message?.snippet?.type || !message?.authorDetails) {
      console.warn('Invalid message format');
      return;
    }

    // メッセージを処理
    processMessage(message);

  } catch (error) {
    console.error('Failed to process chat message:', error);
  }
});
```

---

## 更新履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| 1.1.0 | 2026-01-18 | `YouTubeLiveStats`イベント追加（拡張機能 v1.2.0 対応）|
| 1.0.0 | 2026-01-18 | 初版リリース（拡張機能 v1.0.0 対応） |
