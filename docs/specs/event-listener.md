# イベントリスナー（テストツール）仕様書

作成日: 2025-01-18

## 概要

**Live Stream Event Dock** から送信される全イベントを受信・表示し、動作確認やデバッグを行うためのテストツール。

---

## 機能要件

### 1. OBS WebSocket接続

| 項目 | 内容 |
|------|------|
| 接続先設定 | アドレス、パスワードを入力可能 |
| 接続状態表示 | 未接続/接続中/接続済み/エラー |
| 自動再接続 | 切断時に5秒後自動再接続 |
| 設定保存 | localStorageに保存 |

### 2. イベント受信・表示

| 項目 | 内容 |
|------|------|
| 対象イベント名 | 設定可能（デフォルト: `LiveStreamEvent`） |
| 表示形式 | タイムスタンプ + イベントタイプ + ペイロード |
| JSON整形 | payload を見やすくフォーマット |
| 最大表示件数 | 100件（超過時は古いものを削除） |

### 3. フィルタリング

| フィルタ | 説明 |
|---------|------|
| イベントタイプ | 特定タイプのみ表示（複数選択可） |
| テキスト検索 | ペイロード内のテキストで絞り込み |

### 4. 操作

| 操作 | 説明 |
|------|------|
| クリア | ログを全消去 |
| 一時停止 | 受信を継続しつつ表示更新を停止 |
| エクスポート | ログをJSONファイルとしてダウンロード |
| 詳細表示 | イベントをクリックで詳細パネル表示 |

---

## 受信対象イベント一覧

### 自動イベント

| タイプ | 説明 | 主要payload |
|--------|------|-------------|
| `FirstComment` | 初コメント | message |
| `SuperChat` | スパチャ | amount, currency, message, sessionTotal |
| `Membership` | 新規メンバー | levelName |
| `MembershipGift` | ギフト | count, sessionGiftTotal |
| `MemberMilestone` | マイルストーン | memberMonth, userComment |
| `SessionStats` | 累計統計 | superChatTotal, giftTotal, uniqueUsers, customCounters |
| `Comment` | コメント転送 | message |
| `OwnerComment` | 配信者コメント | message |
| `ModeratorComment` | モデレーターコメント | message |
| `MemberComment` | メンバーコメント | message |

### ルールイベント

| タイプ | 説明 | 主要payload |
|--------|------|-------------|
| `Custom` | カスタムイベント | eventType, ruleId, ruleName, customData |

---

## UI構成

```
┌─────────────────────────────────────────────────────────────┐
│  Live Stream Event Listener                                 │
├─────────────────────────────────────────────────────────────┤
│ [接続設定]                                                   │
│  アドレス: [ws://localhost:4455    ]                        │
│  パスワード: [********            ]                         │
│  イベント名: [LiveStreamEvent      ]                        │
│  [接続] [切断]                        ● 接続済み            │
├─────────────────────────────────────────────────────────────┤
│ [フィルタ]                                                   │
│  タイプ: [All ▼] または チェックボックス群                   │
│  検索: [________________]                                    │
├─────────────────────────────────────────────────────────────┤
│ [操作] [クリア] [一時停止] [エクスポート]     受信: 42件     │
├─────────────────────────────────────────────────────────────┤
│ イベントログ                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 12:34:56.789  FirstComment                              │ │
│ │   user: "視聴者A" | message: "こんにちは"               │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ 12:34:58.123  SuperChat                                 │ │
│ │   user: "スパチャさん" | amount: ¥1,000 | message: "..." │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ 12:35:00.000  SessionStats                              │ │
│ │   superChatTotal: 1000 | giftTotal: 0 | uniqueUsers: 5  │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [詳細パネル] （イベントクリック時に表示）                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {                                                       │ │
│ │   "type": "SuperChat",                                  │ │
│ │   "timestamp": "2025-01-15T12:34:58.123Z",             │ │
│ │   "user": { ... },                                      │ │
│ │   "payload": { ... }                                    │ │
│ │ }                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 配色（イベントタイプ別）

| タイプ | 色 | カラーコード |
|--------|-----|-------------|
| FirstComment | 緑 | `#4caf50` |
| SuperChat | オレンジ | `#ff9800` |
| Membership | 紫 | `#9c27b0` |
| MembershipGift | 紫 | `#9c27b0` |
| MemberMilestone | 青 | `#2196f3` |
| SessionStats | グレー | `#607d8b` |
| Comment | 白/薄グレー | `#9e9e9e` |
| OwnerComment | 赤 | `#f44336` |
| ModeratorComment | 緑 | `#4caf50` |
| MemberComment | オレンジ | `#ff9800` |
| Custom | シアン | `#00bcd4` |
| エラー/不明 | 赤 | `#f44336` |

---

## ファイル構成

```
tools/
└── event-listener/
    └── index.html      # 単一ファイル（CSS/JS埋め込み）
```

※ テストツールのため、単一HTMLファイルで完結させる

---

## 技術仕様

### OBS WebSocket接続

- プロトコル: OBS WebSocket v5.x
- 認証: SHA-256ベース（パスワード設定時）
- イベント購読: `eventSubscriptions: 1`（General events）
- 受信イベント: `CustomEvent`

### localStorage キー

| キー | 内容 |
|------|------|
| `lsed_listener_address` | OBS WebSocketアドレス |
| `lsed_listener_password` | OBS WebSocketパスワード |
| `lsed_listener_eventName` | 監視対象イベント名 |

### イベントデータ構造

```javascript
// OBS CustomEvent の eventData 内部
{
  eventName: "LiveStreamEvent",  // 設定で指定した名前
  eventData: {
    type: "FirstComment",        // イベントタイプ
    timestamp: "2025-01-15T12:34:56.789Z",
    liveChatId: "Cg0KC2FiY2RlZmdoaWpr",  // YouTube配信ID（v1.2.0+）
    sessionId: "session_xxx_yyy",
    user: {
      channelId: "UCxxxxxxxxxx",
      displayName: "ユーザー名",
      profileImageUrl: "https://...",
      isOwner: false,
      isModerator: false,
      isMember: true,
      session: {
        messageCount: 5,
        superChatTotal: 1000,
        superChatCount: 2,
        giftCount: 0,
        firstSeenAt: "2025-01-15T12:30:00.000Z"
      }
    },
    payload: {
      // イベント固有データ
    }
  }
}
```

---

## 実装メモ

### 接続フロー

1. WebSocket接続開始
2. `op: 0` (Hello) 受信 → 認証情報生成
3. `op: 1` (Identify) 送信
4. `op: 2` (Identified) 受信 → 接続完了
5. `op: 5` (Event) でイベント受信開始

### フィルタリング実装

- イベントタイプフィルタ: `Set` で選択状態を管理
- テキスト検索: `JSON.stringify(event).toLowerCase().includes(query)`
- フィルタ変更時に既存ログを再描画

### エクスポート形式

```javascript
{
  exportedAt: "2025-01-15T12:40:00.000Z",
  eventName: "LiveStreamEvent",
  eventCount: 42,
  events: [ /* 全イベント配列 */ ]
}
```
