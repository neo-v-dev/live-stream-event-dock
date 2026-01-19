/**
 * App - メインアプリケーション
 */
class App {
  constructor() {
    // コンポーネント初期化
    this.obsController = new OBSController();
    this.sessionManager = new SessionManager();
    this.streamEventSender = new StreamEventSender(this.obsController, this.sessionManager);
    this.eventEngine = new EventEngine(this.obsController, this.streamEventSender);

    // 編集中のルール
    this.editingRuleId = null;

    // セッション統計タイマー
    this.sessionStatsTimer = null;

    // セッション保存タイマー
    this.sessionSaveTimer = null;

    // DOM要素
    this.elements = {};

    // 初期化
    this._initElements();
    this._initEventListeners();
    this._loadSettings();
    this._loadEventSettings();
    this._loadRules();
    this._updateRulesList();

    // セッション復元
    this._restoreSession();

    // 定期セッション保存（30秒ごと）
    this._startSessionAutoSave();
  }

  /**
   * DOM要素を取得
   */
  _initElements() {
    this.elements = {
      // ステータス
      obsStatus: document.getElementById('obs-status'),

      // 設定
      obsAddress: document.getElementById('obs-address'),
      obsPassword: document.getElementById('obs-password'),

      // ボタン
      obsConnect: document.getElementById('obs-connect'),
      obsDisconnect: document.getElementById('obs-disconnect'),
      saveSettings: document.getElementById('save-settings'),
      addRule: document.getElementById('add-rule'),
      clearLog: document.getElementById('clear-log'),
      resetSession: document.getElementById('reset-session'),

      // リスト
      rulesList: document.getElementById('rules-list'),
      commentLog: document.getElementById('comment-log'),

      // モーダル
      ruleModal: document.getElementById('rule-modal'),
      modalTitle: document.getElementById('modal-title'),
      ruleName: document.getElementById('rule-name'),
      ruleEnabled: document.getElementById('rule-enabled'),
      conditionType: document.getElementById('condition-type'),
      superchatModeGroup: document.getElementById('superchat-mode-group'),
      superchatMode: document.getElementById('superchat-mode'),
      conditionMatchType: document.getElementById('condition-match-type'),
      conditionMatchTypeGroup: document.getElementById('condition-match-type-group'),
      conditionValue: document.getElementById('condition-value'),
      conditionValueGroup: document.getElementById('condition-value-group'),
      conditionAmount: document.getElementById('condition-amount'),
      conditionAmountGroup: document.getElementById('condition-amount-group'),
      conditionThreshold: document.getElementById('condition-threshold'),
      conditionThresholdGroup: document.getElementById('condition-threshold-group'),
      conditionCountThreshold: document.getElementById('condition-count-threshold'),
      conditionCountThresholdGroup: document.getElementById('condition-count-threshold-group'),
      conditionTotalThreshold: document.getElementById('condition-total-threshold'),
      conditionTotalThresholdGroup: document.getElementById('condition-total-threshold-group'),
      conditionGiftThreshold: document.getElementById('condition-gift-threshold'),
      conditionGiftThresholdGroup: document.getElementById('condition-gift-threshold-group'),
      conditionMemberCountThreshold: document.getElementById('condition-member-count-threshold'),
      conditionMemberCountThresholdGroup: document.getElementById('condition-member-count-threshold-group'),
      conditionIncludeGifts: document.getElementById('condition-include-gifts'),
      conditionIncludeGiftsGroup: document.getElementById('condition-include-gifts-group'),
      customEventType: document.getElementById('custom-event-type'),
      customData: document.getElementById('custom-data'),
      ruleCooldown: document.getElementById('rule-cooldown'),
      ruleOnceOnly: document.getElementById('rule-once-only'),
      saveRule: document.getElementById('save-rule'),
      cancelRule: document.getElementById('cancel-rule'),

      // イベント設定
      eventEnabled: document.getElementById('event-enabled'),
      eventName: document.getElementById('event-name'),
      eventIncludeOriginal: document.getElementById('event-include-original'),
      eventFirstComment: document.getElementById('event-first-comment'),
      eventSuperChat: document.getElementById('event-super-chat'),
      eventMembership: document.getElementById('event-membership'),
      eventMembershipGift: document.getElementById('event-membership-gift'),
      eventMemberMilestone: document.getElementById('event-member-milestone'),
      eventSessionStats: document.getElementById('event-session-stats'),
      eventForwardComments: document.getElementById('event-forward-comments'),
      eventOwnerComment: document.getElementById('event-owner-comment'),
      eventModeratorComment: document.getElementById('event-moderator-comment'),
      eventMemberComment: document.getElementById('event-member-comment')
    };
  }

  /**
   * イベントリスナーを設定
   */
  _initEventListeners() {
    // タブ切替
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    });

    // OBS接続
    this.elements.obsConnect.addEventListener('click', () => this._connectOBS());
    this.elements.obsDisconnect.addEventListener('click', () => this._disconnectOBS());

    // 設定保存
    this.elements.saveSettings.addEventListener('click', () => this._saveSettings());

    // ルール追加
    this.elements.addRule.addEventListener('click', () => this._openRuleModal());

    // ログクリア
    this.elements.clearLog.addEventListener('click', () => this._clearLog());

    // セッションリセット
    this.elements.resetSession?.addEventListener('click', () => this._resetSession());

    // モーダル
    document.querySelector('.modal-close').addEventListener('click', () => this._closeRuleModal());
    this.elements.cancelRule.addEventListener('click', () => this._closeRuleModal());
    this.elements.saveRule.addEventListener('click', () => this._saveRule());

    // 条件タイプ変更時のUI更新
    this.elements.conditionType.addEventListener('change', () => this._updateConditionUI());

    // スーパーチャットモードタブ切り替え
    document.querySelectorAll('.sub-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this._setSuperchatMode(mode);
      });
    });

    // モーダル外クリックで閉じる
    this.elements.ruleModal.addEventListener('click', (e) => {
      if (e.target === this.elements.ruleModal) {
        this._closeRuleModal();
      }
    });

    // OBSステータス変更
    this.obsController.onStatusChange = (status) => {
      this._updateStatusIndicator(this.elements.obsStatus, status);
      this.elements.obsConnect.disabled = status === 'connected' || status === 'connecting';
      this.elements.obsDisconnect.disabled = status !== 'connected';
    };

    // OBSからのチャットメッセージ受信（YouTube Live Chat Extension経由）
    this.obsController.onChatMessage = (message) => {
      this._onChatMessage(message);
    };
  }

  /**
   * タブ切替
   */
  _switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
  }

  /**
   * ステータスインジケーター更新
   */
  _updateStatusIndicator(element, status) {
    element.classList.remove('connected', 'disconnected', 'connecting');
    element.classList.add(status === 'error' ? 'disconnected' : status);
  }

  /**
   * 設定を読み込み
   */
  _loadSettings() {
    const settings = storage.loadSettings();
    this.elements.obsAddress.value = settings.obsAddress || 'ws://localhost:4455';
    this.elements.obsPassword.value = settings.obsPassword || '';
  }

  /**
   * 設定を保存
   */
  _saveSettings() {
    const settings = {
      obsAddress: this.elements.obsAddress.value,
      obsPassword: this.elements.obsPassword.value
    };
    storage.saveSettings(settings);

    // イベント設定も保存
    this._saveEventSettings();

    this._showToast('設定を保存しました');
  }

  /**
   * イベント設定を読み込み
   */
  _loadEventSettings() {
    const eventSettings = storage.loadEventSettings();

    // UI要素に反映
    this.elements.eventEnabled.checked = eventSettings.enabled !== false;
    this.elements.eventName.value = eventSettings.eventName || 'LiveStreamEvent';
    this.elements.eventIncludeOriginal.checked = eventSettings.includeOriginal || false;

    this.elements.eventFirstComment.checked = eventSettings.firstComment?.enabled !== false;
    this.elements.eventSuperChat.checked = eventSettings.superChat?.enabled !== false;
    this.elements.eventMembership.checked = eventSettings.membership?.enabled !== false;
    this.elements.eventMembershipGift.checked = eventSettings.membershipGift?.enabled !== false;
    this.elements.eventMemberMilestone.checked = eventSettings.memberMilestone?.enabled !== false;
    this.elements.eventSessionStats.checked = eventSettings.sessionStats?.enabled !== false;
    this.elements.eventForwardComments.checked = eventSettings.forwardComments?.enabled || false;

    this.elements.eventOwnerComment.checked = eventSettings.ownerComment?.enabled || false;
    this.elements.eventModeratorComment.checked = eventSettings.moderatorComment?.enabled || false;
    this.elements.eventMemberComment.checked = eventSettings.memberComment?.enabled || false;

    // StreamEventSenderに設定を適用
    this.streamEventSender.applySettings(eventSettings);
  }

  /**
   * イベント設定を保存
   */
  _saveEventSettings() {
    const eventSettings = {
      enabled: this.elements.eventEnabled.checked,
      eventName: this.elements.eventName.value.trim() || 'LiveStreamEvent',
      includeOriginal: this.elements.eventIncludeOriginal.checked,

      forwardComments: { enabled: this.elements.eventForwardComments.checked },
      firstComment: { enabled: this.elements.eventFirstComment.checked },
      superChat: { enabled: this.elements.eventSuperChat.checked },
      membership: { enabled: this.elements.eventMembership.checked },
      membershipGift: { enabled: this.elements.eventMembershipGift.checked },
      memberMilestone: { enabled: this.elements.eventMemberMilestone.checked },
      sessionStats: { enabled: this.elements.eventSessionStats.checked },

      ownerComment: { enabled: this.elements.eventOwnerComment.checked },
      moderatorComment: { enabled: this.elements.eventModeratorComment.checked },
      memberComment: { enabled: this.elements.eventMemberComment.checked }
    };

    storage.saveEventSettings(eventSettings);
    this.streamEventSender.applySettings(eventSettings);
  }

  /**
   * ルールを読み込み
   */
  _loadRules() {
    const rules = storage.loadRules();
    this.eventEngine.setRules(rules);
  }

  /**
   * ルールを保存
   */
  _saveRulesToStorage() {
    storage.saveRules(this.eventEngine.getRules());
  }

  /**
   * OBS接続
   */
  async _connectOBS() {
    const address = this.elements.obsAddress.value.trim();
    const password = this.elements.obsPassword.value;

    try {
      await this.obsController.connect(address, password);
      this._showToast('OBSに接続しました');

      // セッション統計タイマー開始（5秒毎）
      this._startSessionStatsTimer();
    } catch (error) {
      this._showToast(`OBS接続エラー: ${error.message}`, 'error');
    }
  }

  /**
   * OBS切断
   */
  async _disconnectOBS() {
    // セッション統計タイマー停止
    this._stopSessionStatsTimer();

    await this.obsController.disconnect();
    this._showToast('OBSから切断しました');
  }

  /**
   * セッション統計タイマー開始
   */
  _startSessionStatsTimer() {
    this._stopSessionStatsTimer();

    this.sessionStatsTimer = setInterval(() => {
      if (this.obsController.connected) {
        this.streamEventSender.sendSessionStats();
      }
    }, 5000);

    console.log('[App] セッション統計タイマー開始（5秒毎）');
  }

  /**
   * セッション統計タイマー停止
   */
  _stopSessionStatsTimer() {
    if (this.sessionStatsTimer) {
      clearInterval(this.sessionStatsTimer);
      this.sessionStatsTimer = null;
      console.log('[App] セッション統計タイマー停止');
    }
  }

  /**
   * チャットメッセージ受信時
   */
  async _onChatMessage(message) {
    // コンソールログ
    if (message.superchat) {
      console.log(`[Chat] スパチャ: ${message.authorName} ${message.superchat.amount} "${message.message}"`);
    } else if (message.newSponsor) {
      console.log(`[Chat] 新規メンバー: ${message.authorName}`);
    } else {
      console.log(`[Chat] コメント: ${message.authorName}: ${message.message}`);
    }

    // ログに追加
    this._addCommentLog(message);

    // Stream Manager Eventを送信（初コメ、スパチャ累計、コマンド等）
    await this.streamEventSender.processAndSend(message);

    // イベントエンジンで処理（ルールベースのアクション + パターンマッチイベント送信）
    const triggered = await this.eventEngine.processMessage(message);
    if (triggered.length > 0) {
      console.log(`[Rule] ${triggered.length}件のルールがトリガーされました`);
    }
  }

  /**
   * コメントログに追加
   */
  _addCommentLog(message) {
    const log = this.elements.commentLog;
    const item = document.createElement('div');
    item.className = 'comment-item';

    // スパチャの場合
    if (message.superchat) {
      item.classList.add('comment-superchat');
      item.innerHTML = `
        <span class="comment-time">${this._formatTime(message.timestamp)}</span>
        <span class="amount">${message.superchat.amount}</span>
        <span class="comment-author">${this._escapeHtml(message.authorName)}</span>
        <span class="comment-text">${this._escapeHtml(message.message)}</span>
      `;
    } else {
      // 通常コメント
      let authorClass = 'comment-author';
      if (message.isOwner) authorClass += ' owner';
      else if (message.isModerator) authorClass += ' moderator';
      else if (message.isMember) authorClass += ' member';

      item.innerHTML = `
        <span class="comment-time">${this._formatTime(message.timestamp)}</span>
        <span class="${authorClass}">${this._escapeHtml(message.authorName)}</span>
        <span class="comment-text">${this._escapeHtml(message.message)}</span>
      `;
    }

    log.appendChild(item);

    // 自動スクロール
    log.scrollTop = log.scrollHeight;

    // 最大件数を超えたら古いものを削除
    while (log.children.length > 200) {
      log.removeChild(log.firstChild);
    }
  }

  /**
   * ログクリア
   */
  _clearLog() {
    this.elements.commentLog.innerHTML = '';
  }

  /**
   * ルールモーダルを開く
   */
  _openRuleModal(ruleId = null) {
    this.editingRuleId = ruleId;

    if (ruleId) {
      // 編集モード
      this.elements.modalTitle.textContent = 'ルールを編集';
      const rule = this.eventEngine.getRules().find(r => r.id === ruleId);
      if (rule) {
        this._populateRuleForm(rule);
      }
    } else {
      // 追加モード
      this.elements.modalTitle.textContent = 'ルールを追加';
      this._populateRuleForm(EventEngine.getDefaultRule());
    }

    this._updateConditionUI();
    this.elements.ruleModal.classList.remove('hidden');
  }

  /**
   * ルールモーダルを閉じる
   */
  _closeRuleModal() {
    this.elements.ruleModal.classList.add('hidden');
    this.editingRuleId = null;
  }

  /**
   * ルールフォームに値を設定
   */
  _populateRuleForm(rule) {
    this.elements.ruleName.value = rule.name || '';
    this.elements.ruleEnabled.checked = rule.enabled !== false;

    // 条件
    const condition = rule.condition || {};
    let conditionType = condition.type || 'match';
    let superchatMode = 'everyTime';

    // スーパーチャット系の条件タイプを統合して処理
    if (['superchat', 'superchatCount', 'superchatTotal'].includes(conditionType)) {
      if (conditionType === 'superchatCount') {
        superchatMode = 'count';
      } else if (conditionType === 'superchatTotal') {
        superchatMode = 'total';
      }
      conditionType = 'superchat';
    }

    this.elements.conditionType.value = conditionType;
    this._setSuperchatMode(superchatMode);
    this.elements.conditionMatchType.value = condition.matchType || 'contains';
    this.elements.conditionValue.value = condition.value || '';
    this.elements.conditionAmount.value = condition.minAmount || 0;
    this.elements.conditionThreshold.value = condition.threshold || 10;
    this.elements.conditionCountThreshold.value = condition.countThreshold || 3;
    this.elements.conditionTotalThreshold.value = condition.totalThreshold || 10000;
    this.elements.conditionGiftThreshold.value = condition.giftThreshold || 10;
    this.elements.conditionMemberCountThreshold.value = condition.memberCountThreshold || 10;
    this.elements.conditionIncludeGifts.checked = condition.includeGifts || false;

    // カスタムイベント
    this.elements.customEventType.value = rule.customEventType || '';
    this.elements.customData.value = rule.customData || '';

    // クールダウン
    this.elements.ruleCooldown.value = rule.cooldown || 0;
    this.elements.ruleOnceOnly.checked = rule.onceOnly || false;
  }

  /**
   * 条件UI更新
   */
  _updateConditionUI() {
    const type = this.elements.conditionType.value;
    const superchatMode = this.elements.superchatMode.value;

    // 一致タイプの表示/非表示（match時のみ表示）
    const showMatchType = type === 'match';
    this.elements.conditionMatchTypeGroup.style.display = showMatchType ? 'block' : 'none';

    // 値入力の表示/非表示（match, command時のみ）
    const showValue = ['match', 'command'].includes(type);
    this.elements.conditionValueGroup.style.display = showValue ? 'block' : 'none';

    // スーパーチャットモードタブの表示/非表示
    const showSuperchatMode = type === 'superchat';
    this.elements.superchatModeGroup.style.display = showSuperchatMode ? 'block' : 'none';

    // 金額入力の表示/非表示（superchat時、everyTimeのみ）
    // 回数・累計金額は全体累計なので最低金額フィルタは不要
    const showAmount = type === 'superchat' && superchatMode === 'everyTime';
    this.elements.conditionAmountGroup.style.display = showAmount ? 'block' : 'none';

    // 閾値入力の表示/非表示（commentCount時のみ）
    const showThreshold = type === 'commentCount';
    this.elements.conditionThresholdGroup.style.display = showThreshold ? 'block' : 'none';

    // 回数閾値の表示/非表示（superchat時、count）
    const showCountThreshold = type === 'superchat' && superchatMode === 'count';
    this.elements.conditionCountThresholdGroup.style.display = showCountThreshold ? 'block' : 'none';

    // 累計金額閾値の表示/非表示（superchat時、total）
    const showTotalThreshold = type === 'superchat' && superchatMode === 'total';
    this.elements.conditionTotalThresholdGroup.style.display = showTotalThreshold ? 'block' : 'none';

    // ギフト閾値の表示/非表示（membership時のみ）
    const showGiftThreshold = type === 'membership';
    this.elements.conditionGiftThresholdGroup.style.display = showGiftThreshold ? 'block' : 'none';

    // メンバー加入数閾値の表示/非表示（membershipCount時のみ）
    const showMemberCountThreshold = type === 'membershipCount';
    this.elements.conditionMemberCountThresholdGroup.style.display = showMemberCountThreshold ? 'block' : 'none';
    this.elements.conditionIncludeGiftsGroup.style.display = showMemberCountThreshold ? 'block' : 'none';

    // プレースホルダー更新
    const placeholders = {
      match: '検索テキスト',
      command: 'コマンド名'
    };
    this.elements.conditionValue.placeholder = placeholders[type] || '';
  }

  /**
   * スーパーチャットモードを設定
   */
  _setSuperchatMode(mode) {
    this.elements.superchatMode.value = mode;

    // タブのアクティブ状態を更新
    document.querySelectorAll('.sub-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // UIを更新（表示フィールドの切り替え）
    this._updateConditionUI();
  }

  /**
   * ルールを保存
   */
  _saveRule() {
    let conditionType = this.elements.conditionType.value;

    // スーパーチャットの場合、モードに応じて実際の条件タイプを決定
    if (conditionType === 'superchat') {
      const superchatMode = this.elements.superchatMode.value;
      if (superchatMode === 'count') {
        conditionType = 'superchatCount';
      } else if (superchatMode === 'total') {
        conditionType = 'superchatTotal';
      }
      // everyTimeの場合は'superchat'のまま
    }

    const rule = {
      id: this.editingRuleId,
      name: this.elements.ruleName.value.trim(),
      enabled: this.elements.ruleEnabled.checked,
      condition: {
        type: conditionType,
        matchType: this.elements.conditionMatchType.value,
        value: this.elements.conditionValue.value.trim(),
        minAmount: parseInt(this.elements.conditionAmount.value) || 0,
        threshold: parseInt(this.elements.conditionThreshold.value) || 10,
        countThreshold: parseInt(this.elements.conditionCountThreshold.value) || 3,
        totalThreshold: parseInt(this.elements.conditionTotalThreshold.value) || 10000,
        giftThreshold: parseInt(this.elements.conditionGiftThreshold.value) || 1,
        memberCountThreshold: parseInt(this.elements.conditionMemberCountThreshold.value) || 10,
        includeGifts: this.elements.conditionIncludeGifts.checked
      },
      customEventType: this.elements.customEventType.value.trim(),
      customData: this.elements.customData.value.trim(),
      cooldown: parseInt(this.elements.ruleCooldown.value) || 0,
      onceOnly: this.elements.ruleOnceOnly.checked
    };

    // バリデーション: ルール名
    if (!rule.name) {
      this._showToast('ルール名を入力してください', 'error');
      return;
    }

    // バリデーション: 条件の値（match, command時は必須）
    if (['match', 'command'].includes(conditionType) && !rule.condition.value) {
      this._showToast('条件の値を入力してください', 'error');
      return;
    }

    // バリデーション: カスタムイベントタイプ（必須）
    if (!rule.customEventType) {
      this._showToast('イベントタイプを入力してください', 'error');
      return;
    }

    // バリデーション: イベントタイプの文字種（英字で始まり、英数字・ハイフン・アンダースコアのみ）
    const eventTypePattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!eventTypePattern.test(rule.customEventType)) {
      this._showToast('イベントタイプは英字で始まり、英数字・ハイフン・アンダースコアのみ使用可能です', 'error');
      return;
    }

    // カスタムデータのJSON検証
    if (rule.customData) {
      try {
        JSON.parse(rule.customData);
      } catch (e) {
        this._showToast('カスタムデータは有効なJSON形式で入力してください', 'error');
        return;
      }
    }

    if (this.editingRuleId) {
      this.eventEngine.updateRule(this.editingRuleId, rule);
    } else {
      this.eventEngine.addRule(rule);
    }

    this._saveRulesToStorage();
    this._updateRulesList();
    this._closeRuleModal();
    this._showToast('ルールを保存しました');
  }

  /**
   * ルールリストを更新
   */
  _updateRulesList() {
    const rules = this.eventEngine.getRules();
    const list = this.elements.rulesList;

    if (rules.length === 0) {
      list.innerHTML = '<div class="empty-state">ルールがありません</div>';
      return;
    }

    list.innerHTML = rules.map(rule => `
      <div class="rule-item ${rule.enabled ? '' : 'disabled'}" data-id="${rule.id}">
        <div class="rule-header">
          <span class="rule-name">${this._escapeHtml(rule.name)}</span>
          <div class="rule-actions">
            <button class="btn btn-small btn-secondary rule-edit">編集</button>
            <button class="btn btn-small btn-danger rule-delete">削除</button>
          </div>
        </div>
        <div class="rule-details">
          <div class="rule-condition">条件: ${this._formatCondition(rule.condition)}</div>
          <div class="rule-action">イベント: ${this._escapeHtml(rule.customEventType || '未設定')}</div>
        </div>
      </div>
    `).join('');

    // イベントリスナーを設定
    list.querySelectorAll('.rule-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ruleId = e.target.closest('.rule-item').dataset.id;
        this._openRuleModal(ruleId);
      });
    });

    list.querySelectorAll('.rule-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ruleId = e.target.closest('.rule-item').dataset.id;
        this._deleteRule(ruleId);
      });
    });
  }

  /**
   * ルールを削除
   */
  _deleteRule(ruleId) {
    if (confirm('このルールを削除しますか？')) {
      this.eventEngine.deleteRule(ruleId);
      this._saveRulesToStorage();
      this._updateRulesList();
      this._showToast('ルールを削除しました');
    }
  }

  /**
   * 条件をフォーマット
   */
  _formatCondition(condition) {
    if (!condition) return '未設定';

    const typeLabels = {
      match: 'テキスト',
      command: 'コマンド',
      superchat: 'スパチャ（毎回）',
      superchatCount: 'スパチャ（回数）',
      superchatTotal: 'スパチャ（累計）',
      commentCount: 'コメント数',
      membership: 'メンバーシップ'
    };

    const matchTypeLabels = {
      contains: '含有',
      startsWith: '前方一致',
      endsWith: '後方一致',
      exact: '完全一致'
    };

    let text = typeLabels[condition.type] || condition.type;

    // match時は一致タイプも表示
    if (condition.type === 'match' && condition.matchType) {
      text += `(${matchTypeLabels[condition.matchType] || condition.matchType})`;
    }

    if (condition.value) {
      text += ` "${condition.value}"`;
    }

    if (condition.type === 'superchat' && condition.minAmount > 0) {
      text += ` (¥${condition.minAmount}以上)`;
    }

    if (condition.type === 'superchatCount') {
      let detail = `${condition.countThreshold || 3}回目`;
      if (condition.minAmount > 0) {
        detail += ` ¥${condition.minAmount}以上`;
      }
      text += ` (${detail})`;
    }

    if (condition.type === 'superchatTotal') {
      text += ` (¥${condition.totalThreshold || 10000}達成)`;
    }

    if (condition.type === 'commentCount' && condition.threshold > 0) {
      text += ` (${condition.threshold}回達成)`;
    }

    if (condition.type === 'membership') {
      let detail = `${condition.giftThreshold || 10}個`;
      if (condition.includeNewMember) {
        detail += ' +新規加入';
      }
      text += ` (${detail})`;
    }

    return text;
  }

  /**
   * 時刻をフォーマット
   */
  _formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * HTMLエスケープ
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * トースト表示
   */
  _showToast(message, type = 'info') {
    // 簡易的なトースト（console.logで代用）
    console.log(`[${type.toUpperCase()}] ${message}`);

    // TODO: 実際のトーストUIを実装する場合はここに追加
  }

  // ========== セッション永続化 ==========

  /**
   * セッションを保存
   */
  _saveSession() {
    const sessionData = this.sessionManager.exportData();
    storage.saveSessionData(sessionData);
    console.log('[App] セッション保存完了');
  }

  /**
   * セッションを復元
   */
  _restoreSession() {
    const sessionData = storage.loadSessionData();
    if (sessionData) {
      const success = this.sessionManager.importData(sessionData);
      if (success) {
        const stats = this.sessionManager.getStats();
        console.log('[App] セッション復元完了:', {
          users: stats.uniqueUsers,
          messages: stats.totalMessages,
          superChat: stats.totalSuperChat,
          gifts: stats.totalGifts,
          newMembers: stats.totalNewMembers
        });
      }
    } else {
      console.log('[App] 復元可能なセッションなし');
    }
  }

  /**
   * セッションをリセット（新しい配信開始時）
   */
  _resetSession() {
    if (!confirm('セッションをリセットしますか？\n累計データがすべてクリアされます。')) {
      return;
    }

    this.sessionManager.reset();
    this.eventEngine.resetSession();
    storage.clearSessionData();

    // OBSのcommentedUsersもリセット
    this.obsController.commentedUsers?.clear();

    this._showToast('セッションをリセットしました');
    console.log('[App] セッションリセット完了');
  }

  /**
   * 定期セッション保存を開始
   */
  _startSessionAutoSave() {
    // 既存のタイマーがあれば停止
    if (this.sessionSaveTimer) {
      clearInterval(this.sessionSaveTimer);
    }

    // 30秒ごとに保存
    this.sessionSaveTimer = setInterval(() => {
      this._saveSession();
    }, 30000);

    console.log('[App] セッション自動保存開始（30秒間隔）');
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
