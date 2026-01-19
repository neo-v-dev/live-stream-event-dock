/**
 * EventEngine - イベント条件判定エンジン（刷新版）
 */
class EventEngine {
  constructor(obsController, streamEventSender = null) {
    this.obsController = obsController;
    this.streamEventSender = streamEventSender;
    this.rules = [];
    this.lastTriggered = new Map(); // ルールIDごとの最終実行時刻
    this.triggeredOnce = new Set(); // 1度だけ送信したルールID
  }

  /**
   * StreamEventSenderを設定
   */
  setStreamEventSender(sender) {
    this.streamEventSender = sender;
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
      this.triggeredOnce.delete(id);
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
   * セッションリセット（1度だけ送信のリセット）
   */
  resetSession() {
    this.triggeredOnce.clear();
    this.lastTriggered.clear();
    console.log('[Event] セッションリセット');
  }

  /**
   * ルールが発火済みかどうかを確認
   */
  isTriggeredOnce(ruleId) {
    return this.triggeredOnce.has(ruleId);
  }

  /**
   * 発火済みルールIDをエクスポート（保存用）
   */
  exportTriggeredOnce() {
    return Array.from(this.triggeredOnce);
  }

  /**
   * 発火済みルールIDをインポート（復元用）
   */
  importTriggeredOnce(ruleIds) {
    if (!ruleIds || !Array.isArray(ruleIds)) return;
    this.triggeredOnce = new Set(ruleIds);
    console.log('[Event] 発火済みルール復元:', ruleIds.length, '件');
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

      // 1度だけ送信で既に送信済み
      if (rule.onceOnly && this.triggeredOnce.has(rule.id)) {
        continue;
      }

      // クールダウンチェック
      if (this._isOnCooldown(rule)) {
        console.log(`[Event] ルール "${rule.name}" はクールダウン中`);
        continue;
      }

      // 条件チェック
      if (this._checkConditions(rule, message)) {
        console.log(`[Event] ルール "${rule.name}" がマッチ！`);
        triggeredRules.push(rule);

        // アクション実行（カスタムイベント送信）
        try {
          await this._executeAction(rule, message);
          this.lastTriggered.set(rule.id, Date.now());

          if (rule.onceOnly) {
            this.triggeredOnce.add(rule.id);
          }

          console.log(`[Event]   → カスタムイベント送信成功`);
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

    if (!condition || !condition.type) {
      return false;
    }

    switch (condition.type) {
      case 'match':
        return this._checkMatch(condition, message);

      case 'command':
        return this._checkCommand(condition, message);

      case 'superchat':
        return this._checkSuperchat(condition, message);

      case 'superchatCount':
        return this._checkSuperchatCount(condition, message);

      case 'superchatTotal':
        return this._checkSuperchatTotal(condition, message);

      case 'commentCount':
        return this._checkCommentCount(condition, message);

      case 'membership':
        return this._checkMembership(condition, message);

      case 'membershipCount':
        return this._checkMembershipCount(condition, message);

      // YouTube統計系はprocessStats()で処理するためここではfalse
      case 'viewerCount':
      case 'likeCount':
        return false;

      default:
        console.log(`[Event] 不明な条件タイプ: ${condition.type}`);
        return false;
    }
  }

  /**
   * テキストを正規化（大文字小文字、半角全角）
   */
  _normalizeText(text, options = {}) {
    let result = text;

    // 大文字小文字を区別しない
    if (options.ignoreCase) {
      result = result.toLowerCase();
    }

    // 半角全角を区別しない（全角を半角に変換）
    if (options.normalizeWidth) {
      result = result
        // 全角英数字を半角に
        .replace(/[\uFF01-\uFF5E]/g, ch =>
          String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        )
        // 全角スペースを半角に
        .replace(/\u3000/g, ' ')
        // 全角カタカナを半角に
        .replace(/[\u30A1-\u30F6]/g, ch => {
          const kana = 'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロワヲンヴ';
          const hankaku = 'ｧｱｨｲｩｳｪｴｫｵｶｶﾞｷｷﾞｸｸﾞｹｹﾞｺｺﾞｻｻﾞｼｼﾞｽｽﾞｾｾﾞｿｿﾞﾀﾀﾞﾁﾁﾞｯﾂﾂﾞﾃﾃﾞﾄﾄﾞﾅﾆﾇﾈﾉﾊﾊﾞﾊﾟﾋﾋﾞﾋﾟﾌﾌﾞﾌﾟﾍﾍﾞﾍﾟﾎﾎﾞﾎﾟﾏﾐﾑﾒﾓｬﾔｭﾕｮﾖﾗﾘﾙﾚﾛﾜｦﾝｳﾞ';
          const idx = kana.indexOf(ch);
          return idx >= 0 ? hankaku[idx] : ch;
        });
    }

    return result;
  }

  /**
   * 単一パターンをテスト
   */
  _testSinglePattern(text, pattern, matchType) {
    switch (matchType) {
      case 'startsWith':
        return text.startsWith(pattern);
      case 'endsWith':
        return text.endsWith(pattern);
      case 'exact':
        return text === pattern;
      case 'contains':
      default:
        return text.includes(pattern);
    }
  }

  /**
   * テキスト一致チェック（複数パターン対応）
   */
  _checkMatch(condition, message) {
    // 後方互換性: valueがある場合はpatternsに変換
    const patterns = condition.patterns || (condition.value ? [condition.value] : []);
    if (patterns.length === 0) return false;

    const options = {
      ignoreCase: condition.ignoreCase || false,
      normalizeWidth: condition.normalizeWidth || false
    };

    const text = this._normalizeText(message.message || '', options);
    const matchType = condition.matchType || 'contains';
    const logic = condition.logic || 'or';

    const results = patterns.map(pattern => {
      const normalizedPattern = this._normalizeText(pattern, options);
      return this._testSinglePattern(text, normalizedPattern, matchType);
    });

    // AND: すべてマッチ、OR: いずれかマッチ
    return logic === 'and' ? results.every(r => r) : results.some(r => r);
  }

  /**
   * コマンドチェック (!xxx形式、複数パターン対応)
   */
  _checkCommand(condition, message) {
    // 後方互換性: valueがある場合はpatternsに変換
    const patterns = condition.patterns || (condition.value ? [condition.value] : []);
    if (patterns.length === 0) return false;

    const options = {
      ignoreCase: condition.ignoreCase || false,
      normalizeWidth: condition.normalizeWidth || false
    };

    const text = this._normalizeText((message.message || '').trim(), options);
    const logic = condition.logic || 'or';

    const results = patterns.map(pattern => {
      let command = this._normalizeText(pattern, options);
      // !で始まっていなければ追加
      if (!command.startsWith('!')) {
        command = '!' + command;
      }
      // コマンドは行頭でマッチ（完全一致またはスペース区切り）
      return text === command || text.startsWith(command + ' ');
    });

    // AND: すべてマッチ、OR: いずれかマッチ
    return logic === 'and' ? results.every(r => r) : results.some(r => r);
  }

  /**
   * スーパーチャットチェック
   */
  _checkSuperchat(condition, message) {
    if (!message.superchat) return false;

    // 最低金額チェック
    if (condition.minAmount && condition.minAmount > 0) {
      const amountYen = parseInt(message.superchat.amountMicros) / 1000000;
      if (amountYen < condition.minAmount) {
        return false;
      }
    }

    // テキスト判定（有効な場合のみ）
    if (!this._checkSuperchatTextMatch(condition, message)) return false;

    return true;
  }

  /**
   * ギフト数チェック（全体ギフト累計閾値）
   */
  _checkMembership(condition, message) {
    // ギフトでなければスキップ
    if (!message.membershipGift) return false;

    if (!this.streamEventSender?.sessionManager) return false;

    const stats = this.streamEventSender.sessionManager.getStats();
    const threshold = condition.giftThreshold || 10;

    // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
    return stats.totalGifts >= threshold;
  }

  /**
   * メンバー加入数チェック（全体の新規メンバー数が閾値に達した時）
   * デフォルトはギフトを含まない（新規加入のみ）
   */
  _checkMembershipCount(condition, message) {
    // ギフトを含める場合
    const includeGifts = condition.includeGifts || false;

    // 対象イベントのチェック
    if (includeGifts) {
      // ギフトまたは新規加入でなければスキップ
      if (!message.membershipGift && !message.newSponsor) return false;
    } else {
      // 新規加入でなければスキップ
      if (!message.newSponsor) return false;
    }

    if (!this.streamEventSender?.sessionManager) return false;

    const stats = this.streamEventSender.sessionManager.getStats();
    const threshold = condition.memberCountThreshold || 10;

    // ギフトを含める場合は totalMembersWithGifts、そうでなければ totalNewMembers
    const currentCount = includeGifts ? stats.totalMembersWithGifts : stats.totalNewMembers;

    // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
    return currentCount >= threshold;
  }

  /**
   * コメント数チェック（全体の累計コメント数が閾値に達した時）
   */
  _checkCommentCount(condition, message) {
    if (!this.streamEventSender?.sessionManager) {
      return false;
    }

    const stats = this.streamEventSender.sessionManager.getStats();
    const threshold = condition.threshold || 10;

    // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
    return stats.totalMessages >= threshold;
  }

  /**
   * スーパーチャット回数チェック（全体の累計回数が閾値に達した時）
   */
  _checkSuperchatCount(condition, message) {
    if (!message.superchat) return false;
    if (!this.streamEventSender?.sessionManager) return false;

    // テキスト判定（有効な場合のみ）
    if (!this._checkSuperchatTextMatch(condition, message)) return false;

    const stats = this.streamEventSender.sessionManager.getStats();
    const threshold = condition.countThreshold || 3;

    // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
    return stats.totalSuperChatCount >= threshold;
  }

  /**
   * スーパーチャット累計金額チェック（全体の累計金額が閾値に達した時）
   */
  _checkSuperchatTotal(condition, message) {
    if (!message.superchat) return false;
    if (!this.streamEventSender?.sessionManager) return false;

    // テキスト判定（有効な場合のみ）
    if (!this._checkSuperchatTextMatch(condition, message)) return false;

    const stats = this.streamEventSender.sessionManager.getStats();
    const threshold = condition.totalThreshold || 10000;
    const currentAmount = this._parseSuperchatAmount(message.superchat);
    const previousTotal = stats.totalSuperChat - currentAmount;

    // 今回のスパチャで閾値を超えた場合のみトリガー（以前は未達だった）
    return previousTotal < threshold && stats.totalSuperChat >= threshold;
  }

  /**
   * スーパーチャットのテキスト判定（共通ヘルパー、複数パターン対応）
   */
  _checkSuperchatTextMatch(condition, message) {
    if (!condition.textMatch) return true;

    // 後方互換性: textMatchValueがある場合はtextMatchPatternsに変換
    const patterns = condition.textMatchPatterns || (condition.textMatchValue ? [condition.textMatchValue] : []);
    if (patterns.length === 0) return true;

    const options = {
      ignoreCase: condition.textMatchIgnoreCase || false,
      normalizeWidth: condition.textMatchNormalizeWidth || false
    };

    const text = this._normalizeText(message.message || '', options);
    const matchType = condition.textMatchType || 'contains';
    const logic = condition.textMatchLogic || 'or';

    const results = patterns.map(pattern => {
      const normalizedPattern = this._normalizeText(pattern, options);
      return this._testSinglePattern(text, normalizedPattern, matchType);
    });

    // AND: すべてマッチ、OR: いずれかマッチ
    return logic === 'and' ? results.every(r => r) : results.some(r => r);
  }

  /**
   * スーパーチャット金額をパース
   */
  _parseSuperchatAmount(superchat) {
    if (superchat.amountMicros) {
      return Math.round(parseInt(superchat.amountMicros) / 1000000);
    }
    return 0;
  }

  /**
   * YouTube統計を処理（条件判定＆アクション実行）
   * @param {Object} stats - { current, previous } YouTube統計
   */
  async processStats(stats) {
    const triggeredRules = [];

    for (const rule of this.rules) {
      // 無効なルールはスキップ
      if (!rule.enabled) continue;

      // YouTube統計系の条件のみ処理
      const conditionType = rule.condition?.type;
      if (conditionType !== 'viewerCount' && conditionType !== 'likeCount') {
        continue;
      }

      // 1度だけ送信で既に送信済み
      if (rule.onceOnly && this.triggeredOnce.has(rule.id)) {
        continue;
      }

      // クールダウンチェック
      if (this._isOnCooldown(rule)) {
        console.log(`[Event] ルール "${rule.name}" はクールダウン中`);
        continue;
      }

      // 条件チェック
      let matched = false;
      if (conditionType === 'viewerCount') {
        matched = this._checkViewerCount(rule.condition, stats);
      } else if (conditionType === 'likeCount') {
        matched = this._checkLikeCount(rule.condition, stats);
      }

      if (matched) {
        console.log(`[Event] ルール "${rule.name}" がマッチ！（YouTube統計）`);
        triggeredRules.push(rule);

        // アクション実行（カスタムイベント送信）
        try {
          await this._executeStatsAction(rule, stats);
          this.lastTriggered.set(rule.id, Date.now());

          if (rule.onceOnly) {
            this.triggeredOnce.add(rule.id);
          }

          console.log(`[Event]   → カスタムイベント送信成功`);
        } catch (error) {
          console.error(`[Event]   → アクション実行エラー:`, error);
        }
      }
    }

    return triggeredRules;
  }

  /**
   * 同時接続数チェック（閾値以上で発火）
   */
  _checkViewerCount(condition, stats) {
    const threshold = condition.viewerThreshold || 100;
    const current = stats.current?.concurrentViewers || 0;

    // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
    return current >= threshold;
  }

  /**
   * 高評価数チェック（閾値以上で発火）
   */
  _checkLikeCount(condition, stats) {
    const threshold = condition.likeThreshold || 100;
    const current = stats.current?.likeCount || 0;

    // 閾値以上でトリガー（連続発火防止はonceOnly/cooldownで制御）
    return current >= threshold;
  }

  /**
   * 統計系アクションを実行（カスタムイベント送信）
   */
  async _executeStatsAction(rule, stats) {
    if (!this.streamEventSender) {
      console.warn('[Event] StreamEventSenderが設定されていません');
      return;
    }

    const customEventType = rule.customEventType || 'Custom';
    let customData = null;

    if (rule.customData) {
      try {
        customData = JSON.parse(rule.customData);
      } catch (e) {
        console.error('[Event] customDataのパースエラー:', e);
      }
    }

    // YouTube統計用のダミーメッセージを作成
    const statsMessage = {
      message: '',
      authorName: 'YouTube Stats',
      authorChannelId: '',
      youtubeStats: stats.current
    };

    await this.streamEventSender.sendCustomEvent(
      customEventType,
      rule.id,
      rule.name,
      statsMessage,
      customData
    );
  }

  /**
   * アクションを実行（カスタムイベント送信のみ）
   */
  async _executeAction(rule, message) {
    if (!this.streamEventSender) {
      console.warn('[Event] StreamEventSenderが設定されていません');
      return;
    }

    const customEventType = rule.customEventType || 'Custom';
    let customData = null;

    if (rule.customData) {
      try {
        customData = JSON.parse(rule.customData);
      } catch (e) {
        console.error('[Event] customDataのパースエラー:', e);
      }
    }

    await this.streamEventSender.sendCustomEvent(
      customEventType,
      rule.id,
      rule.name,
      message,
      customData
    );
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
        type: 'match',
        matchType: 'contains',
        value: '',
        minAmount: 0,
        threshold: 10,
        countThreshold: 3,
        totalThreshold: 10000,
        giftThreshold: 10,
        memberCountThreshold: 10,
        includeGifts: false,
        viewerThreshold: 100,
        likeThreshold: 100
      },
      customEventType: '',
      customData: '',
      cooldown: 0,
      onceOnly: true
    };
  }
}
