# Live Stream Event Dock

**バージョン: 1.2.0**

YouTubeライブ配信のチャットイベントをOBS Studioに連携するためのブラウザドックツールです。

Chrome拡張機能「YouTube Live Chat to OBS Extension」と連携し、コメント・スーパーチャット・メンバーシップなどのイベントを検出してOBSオーバーレイに送信できます。

---

## 特徴

- **APIキー不要**: Chrome拡張機能経由でチャットを取得するため、YouTube Data API不要
- **リアルタイム処理**: コメント受信時に即座にイベント判定・送信
- **自動セッション管理**: 配信IDの変更を検出して自動的にセッション切り替え
- **セッション持続**: ページリロードしても累計データを維持
- **柔軟なルール設定**: テキスト一致、コマンド、スパチャ、コメント数など多彩な条件
- **カスタムカウンター**: ルール発火回数を独自に集計してオーバーレイに送信
- **カスタムオーバーレイ対応**: OBS WebSocket経由で自作オーバーレイにイベント送信

---

## 必要なもの

| 項目 | 説明 |
|------|------|
| **OBS Studio** | バージョン 28.0以上（WebSocket 5.x内蔵） |
| **Chrome拡張機能** | [YouTube Live Chat to OBS Extension](https://chrome.google.com/webstore/detail/youtube-live-chat-to-obs/...) |
| **Webブラウザ** | Chrome / Edge / Firefox など |

---

## セットアップ

### 1. OBS WebSocketの設定

1. OBS Studioを起動
2. **ツール** → **WebSocketサーバー設定**
3. 「WebSocketサーバーを有効にする」にチェック
4. ポート: `4455`（デフォルト）
5. 必要に応じてパスワードを設定

### 2. Chrome拡張機能のインストール

1. Chrome ウェブストアから「YouTube Live Chat to OBS Extension」をインストール
2. 拡張機能の設定でOBS WebSocketの接続先を設定:
   - アドレス: `ws://localhost:4455`
   - パスワード: OBSで設定したパスワード
3. イベント名: `YouTubeLiveChat`（デフォルト）

### 3. ドックの追加

**方法A: OBSカスタムブラウザドックとして追加（推奨）**

1. OBSで **表示** → **ドック** → **カスタムブラウザドック**
2. 設定:
   - ドック名: `Live Stream Event Dock`
   - URL: `file:///path/to/stream_manager/index.html`

**方法B: ブラウザで直接開く**

1. `index.html` をブラウザで開く
2. OBS WebSocket設定を入力して接続

### 4. 接続

1. ドックの「設定」タブを開く
2. OBS WebSocketの接続情報を入力:
   - アドレス: `ws://localhost:4455`
   - パスワード: （設定した場合）
3. 「接続」ボタンをクリック
4. ステータスが「OBS」（緑色）になれば接続成功

---

## 機能説明

### セッション管理

配信中の累計データ（コメント数、スパチャ合計、メンバー加入数など）を自動的に追跡・保存します。

#### 自動セッション管理（v1.2.0+）

- **配信ID自動検出**: YouTubeの`liveChatId`を自動検出し、配信を識別
- **配信切り替え検出**: 別の配信を開いた場合、確認ダイアログを表示
  - 「OK」: セッションをリセットして新しい配信を開始
  - 「キャンセル」: 現在のセッションを継続
- **配信ID表示**: 設定タブの「セッション管理」で現在の配信IDを確認可能

#### データの永続化

- **自動保存**: 30秒ごとにlocalStorageへ自動保存
- **リロード対応**: ページをリロードしても累計データを維持
- **手動リセット**: 詳細設定から手動でセッションをリセット可能

> 配信切り替えが自動検出されない場合や、同一配信内でリセットしたい場合は、「詳細設定」から手動リセットを使用してください。

### データのエクスポート/インポート

ルール、設定、セッションデータをJSONファイルとして保存・読み込みできます。

#### エクスポート

設定タブの「データ管理」→「エクスポート」で以下のデータをJSONファイルとしてダウンロードします：

- **ルール**: すべてのイベントルール
- **設定**: OBS接続設定、イベント設定
- **セッションデータ**: 累計統計、発火済みルール状態
- **全期間視聴者**: NewViewer用の視聴者履歴

エクスポートファイルにはアプリケーションバージョンが含まれます。

#### インポート

「インポート」ボタンでJSONファイルを選択し、インポートオプションを設定します：

| オプション | 説明 |
|-----------|------|
| **上書き** | 既存のルールを削除して置き換える |
| **追加（マージ）** | 既存のルールを残して追加する |

インポート対象は個別に選択可能です：
- ルール（チェック可能）
- 設定（OBS接続・イベント設定）
- セッションデータ（統計情報）

> 別のPCへの設定移行やバックアップに便利です。

### 自動イベント（Live Stream Event API）

OBS接続中、以下のイベントが自動的に送信されます（設定で個別に有効/無効を切り替え可能）:

| イベントタイプ | 説明 | デフォルト |
|---------------|------|-----------|
| `FirstComment` | ユーザーのセッション初コメント | 有効 |
| `NewViewer` | 全期間で初めてのコメント（新規視聴者） | 無効 |
| `SuperChat` | スーパーチャット受信 | 有効 |
| `Membership` | 新規メンバー加入 | 有効 |
| `MembershipGift` | メンバーシップギフト送信 | 有効 |
| `MemberMilestone` | マイルストーンチャット | 有効 |
| `SessionStats` | 累計統計 + YouTube統計（5秒毎 + スパチャ/ギフト時） | 有効 |
| `Comment` | 通常コメント転送 | 無効 |
| `OwnerComment` | 配信者のコメント | 無効 |
| `ModeratorComment` | モデレーターのコメント | 無効 |
| `MemberComment` | メンバーのコメント | 無効 |

#### FirstComment vs NewViewer

| イベント | 判定基準 | 用途 |
|---------|---------|------|
| `FirstComment` | **セッション中**の初コメント | 「初見さんいらっしゃい」演出 |
| `NewViewer` | **全期間**で初めてのコメント | 真の新規視聴者の検出 |

- `NewViewer` は視聴者履歴をlocalStorageに保存します（上限なし）
- 履歴はエクスポート/インポートで移行可能です
- `FirstComment` はセッションリセットでクリアされますが、`NewViewer` の履歴は永続化されます

#### SessionStats のペイロード

SessionStatsイベントには以下のデータが含まれます（設定画面で詳細を確認可能）：

| フィールド | 説明 |
|-----------|------|
| `superChatTotal` | スパチャ累計金額 |
| `giftTotal` | ギフト累計数 |
| `newMemberTotal` | 新規メンバー数 |
| `newViewerTotal` | このセッションでの初見さん人数 |
| `uniqueUsers` | この配信でコメントをくれた人数 |
| `totalMessages` | 総メッセージ数 |
| `youtube.concurrentViewers` | 同時接続数 |
| `youtube.likeCount` | 高評価数 |
| `customCounters` | ルールで定義したカスタムカウンター |

### イベントルール

条件に一致したコメントに対してカスタムイベントを送信できます。

#### 条件タイプ

| タイプ | 説明 | 設定項目 |
|--------|------|----------|
| **テキスト一致** | メッセージ内容で判定 | 一致タイプ（含有/前方/後方/完全）、検索テキスト |
| **コマンド** | `!xxx` 形式のコマンド | コマンド名（行頭完全一致） |
| **スーパーチャット** | スパチャ受信時に発火 | モード（毎回/回数/累計金額）、閾値 |
| **コメント数（全体累計）** | 配信全体のコメント数がN件に達した時に発火 | コメント数閾値 |
| **ギフト数（全体累計）** | 配信全体のギフト数がN個に達した時に発火 | ギフト閾値 |
| **メンバー加入数（全体累計）** | 配信全体のメンバー加入数がN人に達した時に発火 | メンバー数閾値、ギフトを含める |
| **新規視聴者数（セッション）** | セッション内のNewViewer数がN人に達した時に発火 | 新規視聴者数閾値 |
| **同時接続数** | 同時接続数がN人に達した時に発火 | 同時接続数閾値（Chrome拡張 v1.2.0+） |
| **高評価数** | 高評価数がN件に達した時に発火 | 高評価数閾値（Chrome拡張 v1.2.0+） |

#### コマンド条件の詳細

コマンド条件は**行頭完全一致**で判定されます。

| 入力メッセージ | コマンド `!hello` | 結果 |
|---------------|------------------|------|
| `!hello` | マッチ | 完全一致 |
| `!hello world` | マッチ | コマンド+引数 |
| `!helloworld` | 不一致 | 区切りなし |
| `say !hello` | 不一致 | 行頭ではない |

#### スーパーチャット条件のモード

| モード | 説明 |
|--------|------|
| **毎回** | スパチャを受信するたびに発火（最低金額フィルタ可） |
| **回数（全体）** | 配信全体のスパチャ回数がN回に達した時に発火 |
| **累計金額（全体）** | 配信全体のスパチャ累計がN円に達した時に発火 |

#### 発火制御

| 設定 | 説明 |
|------|------|
| **1度だけ送信** | セッション中1回のみ発火（起動済み状態は保存され、リロード後も維持） |
| **ユーザーごとに1回** | 同じユーザーには1回だけ発火（セッション中） |
| **クールダウン** | 同一ルールの連続発火を防止（秒数指定） |

> ルール一覧では「1度だけ」設定のルールにバッジが表示され、起動後は「1度だけ・起動済」と表示されます。

#### カスタムカウンター（v1.2.0+）

ルール発火時に独自のカウンターをインクリメントし、SessionStatsに含めることができます。

**設定方法:**
1. ルール編集で「カウンターに追加」をチェック
2. カウンター名を入力（例: `morning_greet`）

**使用例:**
- 「おはよう」コマンドの回数をカウント
- 特定キーワードの出現回数を集計
- オーバーレイで独自の統計を表示

SessionStatsの `customCounters` フィールドで送信されます：
```json
{
  "customCounters": {
    "morning_greet": 15,
    "congrats": 3
  }
}
```

---

## イベントデータ形式

詳細は [docs/event-api.md](docs/event-api.md) を参照してください。

### OBS CustomEvent の構造

イベントは OBS WebSocket の `BroadcastCustomEvent` で送信されます。

```javascript
// OBS CustomEvent の eventData
{
  eventName: "LiveStreamEvent",  // 設定で変更可能
  eventData: {
    type: "FirstComment",        // イベントタイプ
    timestamp: "2025-01-15T12:34:56.789Z",
    liveChatId: "xxx_yyy_zzz",   // 配信ID
    sessionId: "session_xxxx_yyyy",
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
      // イベント固有のデータ
    }
  }
}
```

---

## オーバーレイの作成

カスタムオーバーレイを作成してイベントを受信・表示できます。

詳細は [overlays/README.md](overlays/README.md) を参照してください。

### クイックスタート

1. `overlays/` フォルダ内に新しいフォルダを作成
2. `index.html` を作成してOBS WebSocket接続コードを実装
3. OBSでブラウザソースとして追加
4. ドックでルールを設定してイベントを送信

### イベント受信のポイント

```javascript
// OBS WebSocket でイベントを受信する場合
obsSocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.op === 5 && msg.d.eventType === 'CustomEvent') {
    const { eventName, eventData } = msg.d.eventData;

    // eventName でフィルタ（デフォルト: "LiveStreamEvent"）
    if (eventName === 'LiveStreamEvent') {
      const { type, user, payload } = eventData;
      console.log(`イベント受信: ${type}`, payload);

      // カスタムカウンターの利用例
      if (type === 'SessionStats') {
        const counters = payload.customCounters || {};
        console.log('カスタムカウンター:', counters);
      }
    }
  }
};
```

---

## テストツール

### Event Listener

`tools/event-listener/index.html` を開くと、イベントの受信状況をリアルタイムで確認できます。

**機能:**
- OBS WebSocket接続（自動再接続対応）
- イベントのリアルタイム表示（タイプ別色分け）
- イベントタイプ・テキストでのフィルタリング
- 一時停止・クリア・JSONエクスポート
- イベント詳細のJSON表示

**使い方:**
1. `tools/event-listener/index.html` をブラウザで開く
2. OBS WebSocket接続情報を入力して「接続」
3. ドックからイベントを送信して確認

---

## ディレクトリ構成

```
stream_manager/
├── index.html                  # メインUI
├── css/
│   └── style.css               # スタイル
├── js/
│   ├── app.js                  # メインアプリケーション
│   ├── obs-controller.js       # OBS WebSocket制御
│   ├── obs-websocket-client.js # WebSocketクライアント
│   ├── event-engine.js         # ルール条件判定エンジン
│   ├── session-manager.js      # セッション・ユーザー管理
│   ├── stream-event-sender.js  # イベント送信
│   └── storage.js              # localStorage管理
├── overlays/
│   ├── README.md               # オーバーレイ作成マニュアル
│   └── sample/                 # サンプルオーバーレイ
├── tools/
│   └── event-listener/         # イベント受信テストツール
├── docs/
│   ├── event-api.md            # イベントAPI仕様書
│   └── rule-conditions.md      # ルール条件詳細
└── LICENSE
```

---

## トラブルシューティング

### OBSに接続できない

1. OBS WebSocketサーバーが有効になっているか確認
2. ポート番号が正しいか確認（デフォルト: 4455）
3. パスワードが設定されている場合は正しく入力されているか確認
4. ファイアウォールでポートがブロックされていないか確認

### チャットが受信できない

1. Chrome拡張機能がインストール・有効化されているか確認
2. 拡張機能のOBS WebSocket設定が正しいか確認
3. YouTubeのライブ配信ページで拡張機能が動作しているか確認
4. ドックがOBSに接続されているか確認（ステータスが緑色）

### イベントがオーバーレイに届かない

1. オーバーレイがOBS WebSocketに接続されているか確認
2. `eventName` が一致しているか確認（デフォルト: `LiveStreamEvent`）
3. ブラウザのコンソールでエラーを確認
4. `tools/event-listener/` で受信状況を確認

### 設定が保存されない

- ブラウザのlocalStorageが有効か確認
- プライベートブラウジングモードでないか確認

### セッションデータがリセットされる

- 配信が切り替わった際に確認ダイアログで「OK」を押していないか確認
- ブラウザのlocalStorageがクリアされていないか確認

### 配信切り替えが検出されない

- Chrome拡張機能が最新バージョンか確認
- `liveChatId` が含まれていない場合は従来の手動モードで動作します

---

## 技術仕様

| 項目 | 内容 |
|------|------|
| アプリバージョン | 1.2.0 |
| OBS WebSocket Protocol | v5.x |
| イベント配信方式 | `BroadcastCustomEvent` |
| デフォルトイベント名 | `LiveStreamEvent` |
| ストレージ | localStorage |
| セッション自動保存間隔 | 30秒 |
| 外部依存 | なし（Pure JavaScript） |

---

## 更新履歴

### v1.2.0
- liveChatIdによる自動セッション管理
- カスタムカウンター機能
- ユーザーごとに1回発火制御
- SessionStatsペイロード詳細表示
- アプリケーションバージョン管理
- UIバグ修正

### v1.1.0
- YouTube Live Chat to OBS Extension API対応
- YouTube Data API直接接続を廃止

---

## ライセンス

MIT License + Commons Clause

- 使用・改変・配布: 可
- 商用配信での使用: 可
- 販売（このソフトウェア自体の）: 不可

詳細は [LICENSE](LICENSE) を参照してください。

---

## 関連リンク

- [OBS WebSocket Protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)
- [YouTube Live Chat to OBS Extension](https://chrome.google.com/webstore/)
