/**
 * EventEngine - イベント条件判定エンジン
 */
class EventEngine {
  constructor(obsController) {
    this.obsController = obsController;
    this.rules = [];
    this.lastTriggered = new Map(); // ルールIDごとの最終実行時刻
  }

  /**
   * ルールを設定
   */
  setRules(rules) {
    this.rules = rules || [];
  }

  /**
   * ルールを追加
   */
  addRule(rule) {
    // IDがなければ生成
    if (!rule.id) {
      rule.id = this._generateId();
    }
    this.rules.push(rule);
    return rule;
  }

  /**
   * ルールを更新
   */
  updateRule(id, updates) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates };
      return this.rules[index];
    }
    return null;
  }

  /**
   * ルールを削除
   */
  deleteRule(id) {
    const index = this.rules.findIndex(r => r.id === id);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.lastTriggered.delete(id);
      return true;
    }
    return false;
  }

  /**
   * ルール一覧を取得
   */
  getRules() {
    return this.rules;
  }

  /**
   * ユニークIDを生成
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * メッセージを処理（条件判定＆アクション実行）
   */
  async processMessage(message) {
    const triggeredRules = [];

    for (const rule of this.rules) {
      // 無効なルールはスキップ
      if (!rule.enabled) continue;

      // クールダウンチェック
      if (this._isOnCooldown(rule)) {
        console.log(`[Event] ルール "${rule.name}" はクールダウン中`);
        continue;
      }

      // 条件チェック
      if (this._checkConditions(rule, message)) {
        console.log(`[Event] ルール "${rule.name}" がマッチ！`);
        console.log(`[Event]   コメント: ${message.authorName}: ${message.message}`);
        console.log(`[Event]   アクション: ${rule.action?.type}`);

        triggeredRules.push(rule);

        // アクション実行
        try {
          await this._executeAction(rule, message);
          this.lastTriggered.set(rule.id, Date.now());
          console.log(`[Event]   → アクション実行成功`);
        } catch (error) {
          console.error(`[Event]   → アクション実行エラー:`, error);
        }
      }
    }

    return triggeredRules;
  }

  /**
   * クールダウン中かチェック
   */
  _isOnCooldown(rule) {
    if (!rule.cooldown || rule.cooldown <= 0) return false;

    const lastTime = this.lastTriggered.get(rule.id) || 0;
    const cooldownMs = rule.cooldown * 1000;
    return Date.now() - lastTime < cooldownMs;
  }

  /**
   * 条件をチェック
   */
  _checkConditions(rule, message) {
    const condition = rule.condition;
    console.log(`[Event] 条件チェック: ルール="${rule.name}", 条件=`, condition);
    console.log(`[Event]   メッセージ="${message.message}"`);

    if (!condition) {
      console.log(`[Event]   → 条件なし、スキップ`);
      return false;
    }

    // 初コメント限定チェック
    if (condition.firstCommentOnly && !message.isFirstComment) {
      console.log(`[Event]   → 初コメント限定で不一致`);
      return false;
    }

    // モデレーター限定チェック
    if (condition.moderatorOnly && !message.isModerator && !message.isOwner) {
      console.log(`[Event]   → モデレーター限定で不一致`);
      return false;
    }

    // 初コメントのみONかつ値が空の場合は、条件タイプチェックをスキップ（全ての初コメントにマッチ）
    const valueRequiredTypes = ['keyword', 'command', 'regex', 'user'];
    if (condition.firstCommentOnly && valueRequiredTypes.includes(condition.type) && !condition.value) {
      console.log(`[Event]   → 初コメントのみ（条件値なし）でマッチ`);
      return true;
    }

    // 条件タイプ別チェック
    let result = false;
    switch (condition.type) {
      case 'keyword':
        result = this._checkKeyword(condition, message);
        break;

      case 'command':
        result = this._checkCommand(condition, message);
        break;

      case 'regex':
        result = this._checkRegex(condition, message);
        break;

      case 'superchat':
        result = this._checkSuperchat(condition, message);
        break;

      case 'membership':
        result = this._checkMembership(condition, message);
        break;

      case 'user':
        result = this._checkUser(condition, message);
        break;

      default:
        console.log(`[Event]   → 不明な条件タイプ: ${condition.type}`);
        return false;
    }

    console.log(`[Event]   → チェック結果: ${result}`);
    return result;
  }

  /**
   * キーワード含有チェック
   */
  _checkKeyword(condition, message) {
    console.log(`[Event] キーワードチェック: keyword="${condition.value}"`);

    if (!condition.value) {
      console.log(`[Event]   → キーワードが空`);
      return false;
    }

    const text = message.message || '';
    const keyword = condition.value;

    console.log(`[Event]   text="${text}", keyword="${keyword}"`);

    let result;
    if (condition.caseSensitive) {
      result = condition.exactMatch
        ? text === keyword
        : text.includes(keyword);
    } else {
      const lowerText = text.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      result = condition.exactMatch
        ? lowerText === lowerKeyword
        : lowerText.includes(lowerKeyword);
    }

    console.log(`[Event]   → キーワードマッチ: ${result}`);
    return result;
  }

  /**
   * コマンドチェック (!xxx形式)
   */
  _checkCommand(condition, message) {
    if (!condition.value) return false;

    const text = (message.message || '').trim();
    let command = condition.value;

    // !で始まっていなければ追加
    if (!command.startsWith('!')) {
      command = '!' + command;
    }

    // コマンドは行頭でマッチ
    if (condition.caseSensitive) {
      return text === command || text.startsWith(command + ' ');
    } else {
      const lowerText = text.toLowerCase();
      const lowerCommand = command.toLowerCase();
      return lowerText === lowerCommand || lowerText.startsWith(lowerCommand + ' ');
    }
  }

  /**
   * 正規表現チェック
   */
  _checkRegex(condition, message) {
    if (!condition.value) return false;

    try {
      const flags = condition.caseSensitive ? '' : 'i';
      const regex = new RegExp(condition.value, flags);
      return regex.test(message.message || '');
    } catch (e) {
      console.error('正規表現エラー:', e);
      return false;
    }
  }

  /**
   * スーパーチャットチェック
   */
  _checkSuperchat(condition, message) {
    if (!message.superchat) return false;

    // 最低金額チェック
    if (condition.minAmount && condition.minAmount > 0) {
      // amountMicrosは文字列で、1,000,000 = 1円
      const amountYen = parseInt(message.superchat.amountMicros) / 1000000;
      if (amountYen < condition.minAmount) {
        return false;
      }
    }

    return true;
  }

  /**
   * メンバーシップチェック
   */
  _checkMembership(condition, message) {
    // メンバーシップ関連イベント
    return message.newSponsor || message.membershipGift || message.isMember;
  }

  /**
   * 特定ユーザーチェック
   */
  _checkUser(condition, message) {
    if (!condition.value) return false;

    // チャンネルIDまたはユーザー名でマッチ
    const value = condition.value.toLowerCase();
    return message.authorChannelId === condition.value ||
           message.authorName.toLowerCase() === value;
  }

  /**
   * アクションを実行
   */
  async _executeAction(rule, message) {
    const action = rule.action;
    if (!action) return;

    // コンテキスト（変数置換用 & オーバーレイ送信用）
    const context = {
      // 基本情報
      message: message.message || '',
      user: message.authorName || '',
      userId: message.authorChannelId || '',
      profileImage: message.authorProfileImage || '',

      // ユーザー属性
      isOwner: message.isOwner || false,
      isModerator: message.isModerator || false,
      isMember: message.isMember || false,
      isFirstComment: message.isFirstComment || false,

      // スパチャ情報
      amount: message.superchat?.amount || '',
      amountValue: message.superchat ? parseInt(message.superchat.amountMicros) / 1000000 : 0,
      currency: message.superchat?.currency || '',

      // メンバーシップ情報
      isNewSponsor: message.newSponsor || false,
      membershipGiftCount: message.membershipGift?.count || 0,

      // メタ情報
      ruleName: rule.name || '',
      timestamp: Date.now()
    };

    await this.obsController.executeAction(action, context);
  }

  /**
   * デフォルトのルールテンプレートを取得
   */
  static getDefaultRule() {
    return {
      id: null,
      name: '',
      enabled: true,
      condition: {
        type: 'keyword',
        value: '',
        caseSensitive: false,
        exactMatch: false,
        minAmount: 0,
        firstCommentOnly: false,
        moderatorOnly: false
      },
      action: {
        type: 'switchScene',
        sceneName: '',
        sourceName: '',
        filterName: '',
        text: '',
        eventName: '',
        duration: 3
      },
      cooldown: 0
    };
  }
}
