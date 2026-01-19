# ルール条件詳細

本ドキュメントでは、Live Stream Event Dockのイベントルールで使用できる条件タイプの詳細を説明します。

---

## 概要

イベントルールは、特定の条件に一致したコメントに対してカスタムイベントを送信する機能です。各ルールは以下の要素で構成されます：

- **条件**: どのようなコメントで発火するか
- **カスタムイベント**: 発火時に送信するイベントの内容
- **クールダウン**: 連続発火を防ぐ設定

---

## 条件タイプ一覧

| タイプ | 内部名 | 説明 |
|--------|--------|------|
| テキスト一致 | `match` | メッセージ内容で判定 |
| コマンド | `command` | `!xxx` 形式のコマンド |
| スーパーチャット | `superchat` | スパチャ受信時 |
| コメント数（全体累計） | `commentCount` | 配信全体のコメント数 |
| ギフト数（全体累計） | `membership` | 配信全体のギフト数 |
| メンバー加入数（全体累計） | `membershipCount` | 配信全体のメンバー加入数 |
| 同時接続数 | `viewerCount` | 同時接続数が閾値に達した時 |
| 高評価数 | `likeCount` | 高評価数が閾値に達した時 |

---

## テキスト一致 (match)

メッセージの内容に基づいて判定します。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `matchType` | string | 一致タイプ |
| `value` | string | 検索テキスト |

### 一致タイプ

| 値 | 説明 | 例（検索: "hello"） |
|----|------|---------------------|
| `contains` | 含有 | "say hello world" → ✅ |
| `startsWith` | 前方一致 | "hello everyone" → ✅ |
| `endsWith` | 後方一致 | "say hello" → ✅ |
| `exact` | 完全一致 | "hello" → ✅ |

### 設定例

```javascript
{
  type: "match",
  matchType: "contains",
  value: "おめでとう"
}
```

### 判定ロジック

```javascript
// 大文字・小文字を区別する
switch (matchType) {
  case 'contains':
    return text.includes(value);
  case 'startsWith':
    return text.startsWith(value);
  case 'endsWith':
    return text.endsWith(value);
  case 'exact':
    return text === value;
}
```

---

## コマンド (command)

`!xxx` 形式のコマンドを判定します。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `value` | string | コマンド名（`!`は省略可） |

### 判定ルール

コマンドは**行頭完全一致**で判定されます。

| 入力メッセージ | コマンド `!hello` | 結果 | 理由 |
|---------------|------------------|------|------|
| `!hello` | ✅ マッチ | 完全一致 |
| `!hello world` | ✅ マッチ | コマンド+スペース+引数 |
| `!hello　world` | ✅ マッチ | 全角スペースも対応 |
| `!helloworld` | ❌ 不一致 | スペース区切りなし |
| `say !hello` | ❌ 不一致 | 行頭ではない |
| `!HELLO` | ❌ 不一致 | 大文字・小文字を区別 |

### 設定例

```javascript
{
  type: "command",
  value: "dice"  // または "!dice"
}
```

### 判定ロジック

```javascript
_checkCommand(condition, message) {
  const text = (message.message || '').trim();
  let command = condition.value;

  // !で始まっていなければ追加
  if (!command.startsWith('!')) {
    command = '!' + command;
  }

  // コマンドは行頭でマッチ（完全一致またはスペース区切り）
  return text === command || text.startsWith(command + ' ');
}
```

---

## スーパーチャット (superchat)

スーパーチャット受信時に発火します。3つのモードがあります。

### モード一覧

| モード | 内部名 | 説明 |
|--------|--------|------|
| 毎回 | `everyTime` | スパチャ受信ごとに発火 |
| 回数（全体） | `count` | 配信全体のスパチャ回数が閾値に達した時 |
| 累計金額（全体） | `total` | 配信全体のスパチャ累計が閾値に達した時 |

### 毎回モード (everyTime)

スパチャを受信するたびに発火します。最低金額でフィルタ可能です。

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `mode` | string | `"everyTime"` |
| `minAmount` | number | 最低金額（円）、0で全て |

```javascript
{
  type: "superchat",
  mode: "everyTime",
  minAmount: 500  // 500円以上で発火
}
```

### 回数モード (count)

配信全体のスパチャ回数が指定回数に達した時に発火します。

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `mode` | string | `"count"` |
| `countThreshold` | number | 回数閾値 |

```javascript
{
  type: "superchat",
  mode: "count",
  countThreshold: 10  // 10回以上のスパチャで発火
}
```

> **注意**: 閾値以上で発火条件を満たします。連続発火を防ぐには「1度だけ送信」オプションを使用してください。

### 累計金額モード (total)

配信全体のスパチャ累計金額が指定金額に達した時に発火します。

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `mode` | string | `"total"` |
| `totalThreshold` | number | 累計金額閾値（円） |

```javascript
{
  type: "superchat",
  mode: "total",
  totalThreshold: 10000  // 累計1万円達成時に発火
}
```

> **注意**: 閾値を「超えた瞬間」に発火します（例: 累計が9500円→10500円になった時に発火）。

---

## コメント数（全体累計） (commentCount)

配信全体のコメント数が指定数に達した時に発火します。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"commentCount"` |
| `threshold` | number | コメント数閾値 |

### 設定例

```javascript
{
  type: "commentCount",
  threshold: 100  // 100コメント以上で発火
}
```

### 判定ロジック

```javascript
_checkCommentCount(condition, message) {
  const stats = this.streamEventSender.sessionManager.getStats();
  const threshold = condition.threshold || 10;

  // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
  return stats.totalMessages >= threshold;
}
```

> **ユースケース**: 「100コメント達成！」などのマイルストーン演出に使用。連続発火を防ぐには「1度だけ送信」オプションを使用してください。

---

## ギフト数（全体累計） (membership)

配信全体のメンバーシップギフト数が指定数に達した時に発火します。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"membership"` |
| `giftThreshold` | number | ギフト数閾値 |

### 設定例

```javascript
{
  type: "membership",
  giftThreshold: 50  // 累計50ギフト以上で発火
}
```

### 判定ロジック

```javascript
_checkMembership(condition, message) {
  // ギフトメッセージでない場合はスキップ
  if (!message.membershipGift) return false;

  const stats = this.streamEventSender.sessionManager.getStats();
  const threshold = condition.giftThreshold || 10;

  // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
  return stats.totalGifts >= threshold;
}
```

> **ユースケース**: 「50ギフト達成！」などの演出に使用。連続発火を防ぐには「1度だけ送信」オプションを使用してください。

---

## メンバー加入数（全体累計） (membershipCount)

配信全体のメンバー加入数が指定数に達した時に発火します。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `type` | string | `"membershipCount"` |
| `memberCountThreshold` | number | メンバー数閾値 |
| `includeGifts` | boolean | ギフトによる加入を含めるか（デフォルト: false） |

### 設定例

```javascript
// ギフトを含めない（純粋な新規加入のみ）
{
  type: "membershipCount",
  memberCountThreshold: 10,
  includeGifts: false
}

// ギフトを含める（ギフト受取者も含む）
{
  type: "membershipCount",
  memberCountThreshold: 100,
  includeGifts: true
}
```

### カウント対象

| includeGifts | カウント対象 |
|--------------|-------------|
| `false` | 新規メンバー加入のみ |
| `true` | 新規メンバー加入 + ギフト受取者 |

### 判定ロジック

```javascript
_checkMembershipCount(condition, message) {
  const includeGifts = condition.includeGifts || false;

  // 対象メッセージの判定
  if (includeGifts) {
    if (!message.membershipGift && !message.newSponsor) return false;
  } else {
    if (!message.newSponsor) return false;
  }

  const stats = this.streamEventSender.sessionManager.getStats();
  const threshold = condition.memberCountThreshold || 10;
  const currentCount = includeGifts
    ? stats.totalMembersWithGifts
    : stats.totalNewMembers;

  // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
  return currentCount >= threshold;
}
```

> **ユースケース**: 「10人メンバー達成！」などの演出に使用。連続発火を防ぐには「1度だけ送信」オプションを使用してください。

---

## 同時接続数 (viewerCount)

同時接続数（視聴者数）が閾値に達した時に発火します。

> **Note**: この機能にはChrome拡張機能 v1.2.0以上が必要です。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `viewerThreshold` | number | 発火する同時接続数（デフォルト: 100） |

### 設定例

```javascript
{
  type: "viewerCount",
  viewerThreshold: 1000
}
```

### 判定ロジック

```javascript
_checkViewerCount(condition, stats) {
  const threshold = condition.viewerThreshold || 100;
  const current = stats.current?.concurrentViewers || 0;

  // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
  return current >= threshold;
}
```

### 注意事項

- YouTube統計は10〜30秒間隔で更新されるため、リアルタイム性は限定的です
- 閾値以上であれば発火条件を満たします
- 連続発火を防ぐには「1度だけ送信」オプションまたはクールダウンを設定してください
- 複数の閾値（100人、500人、1000人）を設定したい場合は、それぞれ別のルールを作成してください

---

## 高評価数 (likeCount)

高評価数（いいね数）が閾値に達した時に発火します。

> **Note**: この機能にはChrome拡張機能 v1.2.0以上が必要です。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `likeThreshold` | number | 発火する高評価数（デフォルト: 100） |

### 設定例

```javascript
{
  type: "likeCount",
  likeThreshold: 500
}
```

### 判定ロジック

```javascript
_checkLikeCount(condition, stats) {
  const threshold = condition.likeThreshold || 100;
  const current = stats.current?.likeCount || 0;

  // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
  return current >= threshold;
}
```

### 注意事項

- YouTube統計は10〜30秒間隔で更新されるため、リアルタイム性は限定的です
- 閾値以上であれば発火条件を満たします
- 連続発火を防ぐには「1度だけ送信」オプションまたはクールダウンを設定してください
- 複数の閾値を設定したい場合は、それぞれ別のルールを作成してください

---

## クールダウン設定

同一ルールの連続発火を防ぐための設定です。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `cooldown` | number | クールダウン秒数（0で無効） |
| `onceOnly` | boolean | セッション中1回のみ発火 |

### 動作

1. **cooldown**: 指定秒数が経過するまで同一ルールは発火しない
2. **onceOnly**: セッション中に1度発火したら、以降は発火しない

### 1度だけ送信（onceOnly）の詳細

- ルール一覧で「1度だけ」のバッジが表示されます
- 発火後は「1度だけ・起動済」に変わり、ルールがグレー表示になります
- **起動済み状態はセッションデータと一緒に保存されます**（ページリロード後も維持）
- セッションリセット時にクリアされます

### 設定例

```javascript
// 30秒のクールダウン
{
  cooldown: 30,
  onceOnly: false
}

// セッション中1回のみ
{
  cooldown: 0,
  onceOnly: true
}
```

---

## カスタムイベント設定

ルールが発火した際に送信するイベントの設定です。

### パラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `eventType` | string | イベントタイプ（英数字、ハイフン、アンダースコアのみ） |
| `customData` | object | カスタムデータ（JSON形式） |

### 命名規則

`eventType` は以下の規則に従う必要があります：

- 英字で始まる
- 使用可能文字: `a-z`, `A-Z`, `0-9`, `-`, `_`
- 例: `Congratulation`, `dice-roll`, `special_effect`

### 設定例

```javascript
{
  eventType: "Congratulation",
  customData: {
    effect: "confetti",
    sound: "fanfare",
    duration: 5000
  }
}
```

### 送信されるイベント

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
      effect: "confetti",
      sound: "fanfare",
      duration: 5000
    }
  }
}
```

---

## ルール設定のベストプラクティス

### 1. マイルストーン演出

```javascript
// 100コメント達成
{
  name: "100コメント達成",
  condition: {
    type: "commentCount",
    threshold: 100
  },
  eventType: "Milestone",
  customData: { type: "comment", count: 100 },
  onceOnly: true
}
```

### 2. スパチャ累計達成

```javascript
// 1万円達成
{
  name: "スパチャ1万円達成",
  condition: {
    type: "superchat",
    mode: "total",
    totalThreshold: 10000
  },
  eventType: "SuperChatMilestone",
  customData: { amount: 10000 },
  onceOnly: true
}
```

### 3. コマンドによる演出

```javascript
// !diceコマンドでサイコロを振る
{
  name: "サイコロ",
  condition: {
    type: "command",
    value: "dice"
  },
  eventType: "DiceRoll",
  cooldown: 10  // 10秒に1回まで
}
```

### 4. キーワード反応

```javascript
// 「かわいい」でエフェクト
{
  name: "かわいいエフェクト",
  condition: {
    type: "match",
    matchType: "contains",
    value: "かわいい"
  },
  eventType: "CuteEffect",
  cooldown: 5
}
```

---

## トラブルシューティング

### ルールが発火しない

1. **ルールが有効になっているか確認**
   - ルール一覧で「有効」チェックボックスがオンになっているか

2. **条件が正しいか確認**
   - テキスト一致: 大文字・小文字を区別します
   - コマンド: 行頭完全一致です
   - 閾値系: 「達した瞬間」のみ発火します

3. **クールダウン中ではないか確認**
   - `onceOnly` が有効で既に発火済みではないか
   - クールダウン時間内に再度条件を満たしていないか

4. **OBSに接続されているか確認**
   - イベントはOBS接続時のみ送信されます

### 意図しない発火

1. **条件を絞り込む**
   - 「含有」より「完全一致」の方が誤発火が少ない
   - クールダウンを設定する

2. **閾値の重複に注意**
   - 同じ閾値で複数ルールを設定していないか
