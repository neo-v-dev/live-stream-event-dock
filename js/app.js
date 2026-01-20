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
      conditionValueGroup: document.getElementById('condition-value-group'),
      conditionPatternsList: document.getElementById('condition-patterns-list'),
      addPatternBtn: document.getElementById('add-pattern'),
      conditionLogicGroup: document.getElementById('condition-logic-group'),
      conditionTextOptionsGroup: document.getElementById('condition-text-options-group'),
      conditionIgnoreCase: document.getElementById('condition-ignore-case'),
      conditionNormalizeWidth: document.getElementById('condition-normalize-width'),
      conditionAmount: document.getElementById('condition-amount'),
      conditionAmountGroup: document.getElementById('condition-amount-group'),
      superchatTextMatch: document.getElementById('superchat-text-match'),
      superchatTextMatchGroup: document.getElementById('superchat-text-match-group'),
      superchatMatchType: document.getElementById('superchat-match-type'),
      superchatMatchTypeGroup: document.getElementById('superchat-match-type-group'),
      superchatMatchValueGroup: document.getElementById('superchat-match-value-group'),
      superchatPatternsList: document.getElementById('superchat-patterns-list'),
      addSuperchatPatternBtn: document.getElementById('add-superchat-pattern'),
      superchatLogicGroup: document.getElementById('superchat-logic-group'),
      superchatTextOptionsGroup: document.getElementById('superchat-text-options-group'),
      superchatIgnoreCase: document.getElementById('superchat-ignore-case'),
      superchatNormalizeWidth: document.getElementById('superchat-normalize-width'),
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
      conditionNewViewerThreshold: document.getElementById('condition-new-viewer-threshold'),
      conditionNewViewerThresholdGroup: document.getElementById('condition-new-viewer-threshold-group'),
      conditionViewerThreshold: document.getElementById('condition-viewer-threshold'),
      conditionViewerThresholdGroup: document.getElementById('condition-viewer-threshold-group'),
      conditionLikeThreshold: document.getElementById('condition-like-threshold'),
      conditionLikeThresholdGroup: document.getElementById('condition-like-threshold-group'),
      customEventType: document.getElementById('custom-event-type'),
      customData: document.getElementById('custom-data'),
      ruleCooldown: document.getElementById('rule-cooldown'),
      ruleCooldownGroup: document.getElementById('rule-cooldown-group'),
      ruleOnceOnly: document.getElementById('rule-once-only'),
      saveRule: document.getElementById('save-rule'),
      cancelRule: document.getElementById('cancel-rule'),

      // イベント設定
      eventEnabled: document.getElementById('event-enabled'),
      eventName: document.getElementById('event-name'),
      eventIncludeOriginal: document.getElementById('event-include-original'),
      eventFirstComment: document.getElementById('event-first-comment'),
      eventNewViewer: document.getElementById('event-new-viewer'),
      eventSuperChat: document.getElementById('event-super-chat'),
      eventMembership: document.getElementById('event-membership'),
      eventMembershipGift: document.getElementById('event-membership-gift'),
      eventMemberMilestone: document.getElementById('event-member-milestone'),
      eventSessionStats: document.getElementById('event-session-stats'),
      eventForwardComments: document.getElementById('event-forward-comments'),
      eventOwnerComment: document.getElementById('event-owner-comment'),
      eventModeratorComment: document.getElementById('event-moderator-comment'),
      eventMemberComment: document.getElementById('event-member-comment'),

      // エクスポート/インポート
      exportData: document.getElementById('export-data'),
      importData: document.getElementById('import-data'),
      importFile: document.getElementById('import-file'),
      importModal: document.getElementById('import-modal'),
      importModalClose: document.getElementById('import-modal-close'),
      importSummary: document.getElementById('import-summary'),
      importRules: document.getElementById('import-rules'),
      importSettings: document.getElementById('import-settings'),
      importSession: document.getElementById('import-session'),
      importConfirm: document.getElementById('import-confirm'),
      importCancel: document.getElementById('import-cancel')
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

    // エクスポート/インポート
    this.elements.exportData?.addEventListener('click', () => this._exportData());
    this.elements.importData?.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile?.addEventListener('change', (e) => this._handleImportFile(e));
    this.elements.importModalClose?.addEventListener('click', () => this._closeImportModal());
    this.elements.importCancel?.addEventListener('click', () => this._closeImportModal());
    this.elements.importConfirm?.addEventListener('click', () => this._confirmImport());
    this.elements.importModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.importModal) this._closeImportModal();
    });

    // モーダル
    document.querySelector('.modal-close').addEventListener('click', () => this._closeRuleModal());
    this.elements.cancelRule.addEventListener('click', () => this._closeRuleModal());
    this.elements.saveRule.addEventListener('click', () => this._saveRule());

    // 条件タイプ変更時のUI更新
    this.elements.conditionType.addEventListener('change', () => this._updateConditionUI());

    // 1度だけ送信チェックボックス変更時のクールダウン表示切り替え
    this.elements.ruleOnceOnly.addEventListener('change', () => this._updateCooldownUI());

    // スーパーチャットテキスト判定チェックボックス変更時
    this.elements.superchatTextMatch.addEventListener('change', () => this._updateSuperchatTextMatchUI());

    // パターン追加ボタン
    this.elements.addPatternBtn.addEventListener('click', () => this._addPattern('condition'));
    this.elements.addSuperchatPatternBtn.addEventListener('click', () => this._addPattern('superchat'));

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

    // OBSからのYouTube統計受信（YouTube Live Chat Extension v1.2.0+）
    this.obsController.onStatsUpdate = (stats) => {
      this._onStatsUpdate(stats);
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
    this.elements.eventNewViewer.checked = eventSettings.newViewer?.enabled || false;
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
      newViewer: { enabled: this.elements.eventNewViewer.checked },
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
      // 発火済み状態を反映するためルール一覧を更新
      this._updateRulesList();
      // 起動済み状態を即座に保存
      this._saveSession();
    }
  }

  /**
   * YouTube統計受信時
   */
  async _onStatsUpdate(stats) {
    console.log(`[Stats] YouTube統計更新: 同接=${stats.concurrentViewers}, 高評価=${stats.likeCount}`);

    // SessionManagerで統計を更新（前回値も保存）
    const statsWithPrevious = this.sessionManager.updateYouTubeStats(stats);

    // イベントエンジンでYouTube統計系ルールを処理
    const triggered = await this.eventEngine.processStats(statsWithPrevious);
    if (triggered.length > 0) {
      console.log(`[Rule] ${triggered.length}件のYouTube統計ルールがトリガーされました`);
      // 発火済み状態を反映するためルール一覧を更新
      this._updateRulesList();
      // 起動済み状態を即座に保存
      this._saveSession();
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
    this._updateCooldownUI();
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
    // パターンをセット（後方互換性のためvalueも対応）
    const patterns = condition.patterns || (condition.value ? [condition.value] : []);
    this._setPatterns('condition', patterns);
    this._setLogic('condition', condition.logic);
    this.elements.conditionIgnoreCase.checked = condition.ignoreCase || false;
    this.elements.conditionNormalizeWidth.checked = condition.normalizeWidth || false;
    this.elements.conditionAmount.value = condition.minAmount || 0;
    // スーパーチャットテキスト判定
    this.elements.superchatTextMatch.checked = condition.textMatch || false;
    this.elements.superchatMatchType.value = condition.textMatchType || 'contains';
    // スーパーチャットパターンをセット
    const superchatPatterns = condition.textMatchPatterns || (condition.textMatchValue ? [condition.textMatchValue] : []);
    this._setPatterns('superchat', superchatPatterns);
    this._setLogic('superchat', condition.textMatchLogic);
    this.elements.superchatIgnoreCase.checked = condition.textMatchIgnoreCase || false;
    this.elements.superchatNormalizeWidth.checked = condition.textMatchNormalizeWidth || false;
    this.elements.conditionThreshold.value = condition.threshold || 10;
    this.elements.conditionCountThreshold.value = condition.countThreshold || 3;
    this.elements.conditionTotalThreshold.value = condition.totalThreshold || 10000;
    this.elements.conditionGiftThreshold.value = condition.giftThreshold || 10;
    this.elements.conditionMemberCountThreshold.value = condition.memberCountThreshold || 10;
    this.elements.conditionIncludeGifts.checked = condition.includeGifts || false;
    this.elements.conditionNewViewerThreshold.value = condition.newViewerThreshold || 10;
    this.elements.conditionViewerThreshold.value = condition.viewerThreshold || 100;
    this.elements.conditionLikeThreshold.value = condition.likeThreshold || 100;

    // カスタムイベント
    this.elements.customEventType.value = rule.customEventType || '';
    this.elements.customData.value = rule.customData || '';

    // 発火制御
    this.elements.ruleCooldown.value = rule.cooldown || 0;
    this.elements.ruleOnceOnly.checked = rule.onceOnly !== false; // デフォルトtrue
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

    // スーパーチャットテキスト判定の表示/非表示（superchat時のみ）
    const showSuperchatTextMatch = type === 'superchat';
    this.elements.superchatTextMatchGroup.style.display = showSuperchatTextMatch ? 'block' : 'none';
    if (!showSuperchatTextMatch) {
      // superchat以外の場合は関連UIを非表示
      this.elements.superchatMatchTypeGroup.style.display = 'none';
      this.elements.superchatMatchValueGroup.style.display = 'none';
    } else {
      // superchatの場合はチェックボックスの状態に応じて表示
      this._updateSuperchatTextMatchUI();
    }

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

    // 新規視聴者数閾値の表示/非表示（newViewerCount時のみ）
    const showNewViewerThreshold = type === 'newViewerCount';
    this.elements.conditionNewViewerThresholdGroup.style.display = showNewViewerThreshold ? 'block' : 'none';

    // 同時接続数閾値の表示/非表示（viewerCount時のみ）
    const showViewerThreshold = type === 'viewerCount';
    this.elements.conditionViewerThresholdGroup.style.display = showViewerThreshold ? 'block' : 'none';

    // 高評価数閾値の表示/非表示（likeCount時のみ）
    const showLikeThreshold = type === 'likeCount';
    this.elements.conditionLikeThresholdGroup.style.display = showLikeThreshold ? 'block' : 'none';

    // テキストオプションの表示/非表示（match, command時のみ）
    const showTextOptions = ['match', 'command'].includes(type);
    this.elements.conditionTextOptionsGroup.style.display = showTextOptions ? 'block' : 'none';

    // 複数パターン時のロジック選択表示更新
    if (showValue) {
      this._updateLogicGroupVisibility('condition');
    } else {
      this.elements.conditionLogicGroup.style.display = 'none';
    }
  }

  /**
   * クールダウンUI更新（1度だけ送信がオフの時のみ表示）
   */
  _updateCooldownUI() {
    const onceOnly = this.elements.ruleOnceOnly.checked;
    this.elements.ruleCooldownGroup.style.display = onceOnly ? 'none' : 'block';
  }

  /**
   * スーパーチャットテキスト判定UI更新
   */
  _updateSuperchatTextMatchUI() {
    const enabled = this.elements.superchatTextMatch.checked;
    this.elements.superchatMatchTypeGroup.style.display = enabled ? 'block' : 'none';
    this.elements.superchatMatchValueGroup.style.display = enabled ? 'block' : 'none';
    this.elements.superchatTextOptionsGroup.style.display = enabled ? 'block' : 'none';
    // 複数パターンの場合のみロジック選択を表示
    this._updateLogicGroupVisibility('superchat');
  }

  /**
   * パターンを追加
   */
  _addPattern(type) {
    const list = type === 'superchat'
      ? this.elements.superchatPatternsList
      : this.elements.conditionPatternsList;

    const item = document.createElement('div');
    item.className = 'pattern-item';
    item.innerHTML = `
      <input type="text" class="pattern-input" placeholder="検索テキスト">
      <button type="button" class="btn btn-small btn-danger pattern-remove">−</button>
    `;

    // 削除ボタンのイベント
    item.querySelector('.pattern-remove').addEventListener('click', () => {
      item.remove();
      this._updatePatternRemoveButtons(type);
      this._updateLogicGroupVisibility(type);
    });

    list.appendChild(item);
    this._updatePatternRemoveButtons(type);
    this._updateLogicGroupVisibility(type);
  }

  /**
   * パターン削除ボタンの表示/非表示を更新
   */
  _updatePatternRemoveButtons(type) {
    const list = type === 'superchat'
      ? this.elements.superchatPatternsList
      : this.elements.conditionPatternsList;

    const items = list.querySelectorAll('.pattern-item');
    items.forEach((item, index) => {
      const removeBtn = item.querySelector('.pattern-remove');
      // 2つ以上ある場合のみ削除ボタンを表示
      removeBtn.style.display = items.length > 1 ? 'block' : 'none';
    });
  }

  /**
   * ロジック選択グループの表示/非表示を更新
   */
  _updateLogicGroupVisibility(type) {
    const list = type === 'superchat'
      ? this.elements.superchatPatternsList
      : this.elements.conditionPatternsList;
    const logicGroup = type === 'superchat'
      ? this.elements.superchatLogicGroup
      : this.elements.conditionLogicGroup;

    const patternCount = list.querySelectorAll('.pattern-item').length;
    logicGroup.style.display = patternCount > 1 ? 'block' : 'none';
  }

  /**
   * パターンリストを取得
   */
  _getPatterns(type) {
    const list = type === 'superchat'
      ? this.elements.superchatPatternsList
      : this.elements.conditionPatternsList;

    const patterns = [];
    list.querySelectorAll('.pattern-input').forEach(input => {
      const value = input.value.trim();
      if (value) patterns.push(value);
    });
    return patterns;
  }

  /**
   * パターンリストを設定
   */
  _setPatterns(type, patterns) {
    const list = type === 'superchat'
      ? this.elements.superchatPatternsList
      : this.elements.conditionPatternsList;

    // 既存のパターンをクリア
    list.innerHTML = '';

    // パターンが空なら1つの空欄を追加
    const patternsToShow = patterns && patterns.length > 0 ? patterns : [''];

    patternsToShow.forEach((pattern, index) => {
      const item = document.createElement('div');
      item.className = 'pattern-item';
      item.innerHTML = `
        <input type="text" class="pattern-input" placeholder="検索テキスト" value="${this._escapeHtml(pattern)}">
        <button type="button" class="btn btn-small btn-danger pattern-remove" style="display:none;">−</button>
      `;

      // 削除ボタンのイベント
      item.querySelector('.pattern-remove').addEventListener('click', () => {
        item.remove();
        this._updatePatternRemoveButtons(type);
        this._updateLogicGroupVisibility(type);
      });

      list.appendChild(item);
    });

    this._updatePatternRemoveButtons(type);
    this._updateLogicGroupVisibility(type);
  }

  /**
   * ロジック値を取得
   */
  _getLogic(type) {
    const name = type === 'superchat' ? 'superchat-logic' : 'condition-logic';
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : 'or';
  }

  /**
   * ロジック値を設定
   */
  _setLogic(type, logic) {
    const name = type === 'superchat' ? 'superchat-logic' : 'condition-logic';
    const radio = document.querySelector(`input[name="${name}"][value="${logic || 'or'}"]`);
    if (radio) radio.checked = true;
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

    const patterns = this._getPatterns('condition');
    const superchatPatterns = this._getPatterns('superchat');

    const rule = {
      id: this.editingRuleId,
      name: this.elements.ruleName.value.trim(),
      enabled: this.elements.ruleEnabled.checked,
      condition: {
        type: conditionType,
        matchType: this.elements.conditionMatchType.value,
        patterns: patterns,
        logic: this._getLogic('condition'),
        ignoreCase: this.elements.conditionIgnoreCase.checked,
        normalizeWidth: this.elements.conditionNormalizeWidth.checked,
        minAmount: parseInt(this.elements.conditionAmount.value) || 0,
        // スーパーチャットテキスト判定
        textMatch: this.elements.superchatTextMatch.checked,
        textMatchType: this.elements.superchatMatchType.value,
        textMatchPatterns: superchatPatterns,
        textMatchLogic: this._getLogic('superchat'),
        textMatchIgnoreCase: this.elements.superchatIgnoreCase.checked,
        textMatchNormalizeWidth: this.elements.superchatNormalizeWidth.checked,
        threshold: parseInt(this.elements.conditionThreshold.value) || 10,
        countThreshold: parseInt(this.elements.conditionCountThreshold.value) || 3,
        totalThreshold: parseInt(this.elements.conditionTotalThreshold.value) || 10000,
        giftThreshold: parseInt(this.elements.conditionGiftThreshold.value) || 1,
        memberCountThreshold: parseInt(this.elements.conditionMemberCountThreshold.value) || 10,
        includeGifts: this.elements.conditionIncludeGifts.checked,
        newViewerThreshold: parseInt(this.elements.conditionNewViewerThreshold.value) || 10,
        viewerThreshold: parseInt(this.elements.conditionViewerThreshold.value) || 100,
        likeThreshold: parseInt(this.elements.conditionLikeThreshold.value) || 100
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
    if (['match', 'command'].includes(conditionType) && rule.condition.patterns.length === 0) {
      this._showToast('検索テキストを入力してください', 'error');
      return;
    }

    // バリデーション: スーパーチャットテキスト判定（有効時は検索テキスト必須）
    if (['superchat', 'superchatCount', 'superchatTotal'].includes(conditionType) &&
        rule.condition.textMatch && rule.condition.textMatchPatterns.length === 0) {
      this._showToast('検索テキストを入力してください', 'error');
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

    list.innerHTML = rules.map(rule => {
      const isTriggered = this.eventEngine.isTriggeredOnce(rule.id);
      const onceOnlyBadge = rule.onceOnly
        ? (isTriggered
          ? '<span class="badge badge-triggered">1度だけ・起動済</span>'
          : '<span class="badge badge-once">1度だけ</span>')
        : '';

      return `
        <div class="rule-item ${rule.enabled ? '' : 'disabled'} ${isTriggered ? 'triggered' : ''}" data-id="${rule.id}">
          <div class="rule-header">
            <span class="rule-name">${this._escapeHtml(rule.name)}${onceOnlyBadge}</span>
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
      `;
    }).join('');

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
      membership: 'メンバーシップ',
      membershipCount: 'メンバー加入数',
      newViewerCount: '新規視聴者数',
      viewerCount: '同時接続数',
      likeCount: '高評価数'
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

    // パターン表示（複数パターン対応）
    const patterns = condition.patterns || (condition.value ? [condition.value] : []);
    if (patterns.length > 0) {
      if (patterns.length === 1) {
        text += ` 「${patterns[0]}」`;
      } else {
        const logic = condition.logic === 'and' ? 'AND' : 'OR';
        text += ` 「${patterns.join(`」${logic}「`)}」`;
      }
      // テキストオプション表示
      const options = [];
      if (condition.ignoreCase) options.push('大小無視');
      if (condition.normalizeWidth) options.push('全半角無視');
      if (options.length > 0) {
        text += ` [${options.join('/')}]`;
      }
    }

    if (condition.type === 'superchat' && condition.minAmount > 0) {
      text += ` (¥${condition.minAmount}以上)`;
    }

    if (condition.type === 'superchatCount') {
      let detail = `${condition.countThreshold || 3}回以上`;
      if (condition.minAmount > 0) {
        detail += ` ¥${condition.minAmount}以上`;
      }
      text += ` (${detail})`;
    }

    if (condition.type === 'superchatTotal') {
      text += ` (¥${condition.totalThreshold || 10000}達成)`;
    }

    // スーパーチャットのテキスト判定（複数パターン対応）
    if (['superchat', 'superchatCount', 'superchatTotal'].includes(condition.type) && condition.textMatch) {
      const scPatterns = condition.textMatchPatterns || (condition.textMatchValue ? [condition.textMatchValue] : []);
      if (scPatterns.length > 0) {
        const matchLabel = matchTypeLabels[condition.textMatchType] || '含有';
        if (scPatterns.length === 1) {
          text += ` + ${matchLabel}「${scPatterns[0]}」`;
        } else {
          const scLogic = condition.textMatchLogic === 'and' ? 'AND' : 'OR';
          text += ` + ${matchLabel}「${scPatterns.join(`」${scLogic}「`)}」`;
        }
        // テキストオプション表示
        const scOptions = [];
        if (condition.textMatchIgnoreCase) scOptions.push('大小無視');
        if (condition.textMatchNormalizeWidth) scOptions.push('全半角無視');
        if (scOptions.length > 0) {
          text += ` [${scOptions.join('/')}]`;
        }
      }
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

    if (condition.type === 'membershipCount') {
      let detail = `${condition.memberCountThreshold || 10}人`;
      if (condition.includeGifts) {
        detail += ' (ギフト含む)';
      }
      text += ` (${detail})`;
    }

    if (condition.type === 'viewerCount') {
      text += ` (${condition.viewerThreshold || 100}人達成)`;
    }

    if (condition.type === 'likeCount') {
      text += ` (${condition.likeThreshold || 100}件達成)`;
    }

    if (condition.type === 'newViewerCount') {
      text += ` (${condition.newViewerThreshold || 10}人達成)`;
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
    // 発火済みルールIDも含める
    sessionData.triggeredOnce = this.eventEngine.exportTriggeredOnce();
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
        // 発火済みルールIDも復元
        if (sessionData.triggeredOnce) {
          this.eventEngine.importTriggeredOnce(sessionData.triggeredOnce);
        }
        const stats = this.sessionManager.getStats();
        console.log('[App] セッション復元完了:', {
          users: stats.uniqueUsers,
          messages: stats.totalMessages,
          superChat: stats.totalSuperChat,
          gifts: stats.totalGifts,
          newMembers: stats.totalNewMembers
        });
        // ルール一覧を更新（起動済み状態を反映）
        this._updateRulesList();
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

    // ルール一覧を更新（起動済み状態をクリア）
    this._updateRulesList();

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

  // ========== エクスポート/インポート ==========

  /**
   * データをエクスポート
   */
  _exportData() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      rules: this.eventEngine.getRules(),
      settings: {
        obsConnection: {
          address: this.elements.obsAddress.value,
          password: this.elements.obsPassword.value
        },
        events: {
          enabled: this.elements.eventEnabled.checked,
          eventName: this.elements.eventName.value,
          includeOriginal: this.elements.eventIncludeOriginal.checked,
          firstComment: this.elements.eventFirstComment.checked,
          newViewer: this.elements.eventNewViewer.checked,
          superChat: this.elements.eventSuperChat.checked,
          membership: this.elements.eventMembership.checked,
          membershipGift: this.elements.eventMembershipGift.checked,
          memberMilestone: this.elements.eventMemberMilestone.checked,
          sessionStats: this.elements.eventSessionStats.checked,
          forwardComments: this.elements.eventForwardComments.checked,
          ownerComment: this.elements.eventOwnerComment.checked,
          moderatorComment: this.elements.eventModeratorComment.checked,
          memberComment: this.elements.eventMemberComment.checked
        }
      },
      sessionData: {
        ...this.sessionManager.exportData(),
        triggeredOnce: this.eventEngine.exportTriggeredOnce()
      },
      globalViewers: storage.exportGlobalViewers()
    };

    // JSONファイルとしてダウンロード
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `live-stream-event-dock-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this._showToast('データをエクスポートしました');
    console.log('[App] データエクスポート完了');
  }

  /**
   * インポートファイル処理
   */
  _handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this._pendingImportData = data;
        this._showImportModal(data);
      } catch (err) {
        this._showToast('ファイルの読み込みに失敗しました: ' + err.message, 'error');
        console.error('[App] インポートエラー:', err);
      }
    };
    reader.readAsText(file);

    // ファイル入力をリセット（同じファイルを再選択可能にする）
    event.target.value = '';
  }

  /**
   * インポートモーダルを表示
   */
  _showImportModal(data) {
    // サマリーを表示
    const rulesCount = data.rules?.length || 0;
    const hasSettings = !!data.settings;
    const hasSession = !!data.sessionData;
    const globalViewersCount = data.globalViewers?.count || 0;

    let summary = `<strong>ファイル内容:</strong><br>`;
    summary += `・ルール: ${rulesCount}件<br>`;
    summary += `・設定: ${hasSettings ? 'あり' : 'なし'}<br>`;
    summary += `・セッションデータ: ${hasSession ? 'あり' : 'なし'}<br>`;
    summary += `・全期間視聴者: ${globalViewersCount > 0 ? globalViewersCount.toLocaleString() + '人' : 'なし'}`;

    if (data.exportedAt) {
      const exportDate = new Date(data.exportedAt).toLocaleString('ja-JP');
      summary += `<br><small style="color:var(--text-muted);">エクスポート日時: ${exportDate}</small>`;
    }

    this.elements.importSummary.innerHTML = summary;

    // チェックボックスの有効/無効を設定
    this.elements.importRules.disabled = rulesCount === 0;
    this.elements.importRules.checked = rulesCount > 0;
    this.elements.importSettings.disabled = !hasSettings;
    this.elements.importSettings.checked = hasSettings;
    this.elements.importSession.disabled = !hasSession && globalViewersCount === 0;
    this.elements.importSession.checked = false; // セッションはデフォルトOFF

    this.elements.importModal.classList.remove('hidden');
  }

  /**
   * インポートモーダルを閉じる
   */
  _closeImportModal() {
    this.elements.importModal.classList.add('hidden');
    this._pendingImportData = null;
  }

  /**
   * インポートを実行
   */
  _confirmImport() {
    const data = this._pendingImportData;
    if (!data) return;

    const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'replace';
    const importRules = this.elements.importRules.checked;
    const importSettings = this.elements.importSettings.checked;
    const importSession = this.elements.importSession.checked;

    let importedItems = [];

    // ルールのインポート
    if (importRules && data.rules) {
      if (importMode === 'replace') {
        // 上書き: 既存ルールをすべて削除
        const existingRules = this.eventEngine.getRules();
        existingRules.forEach(r => this.eventEngine.deleteRule(r.id));
      }

      // ルールを追加（IDは新規生成）
      data.rules.forEach(rule => {
        const newRule = { ...rule };
        if (importMode === 'merge') {
          // マージ時はIDを新規生成して重複を避ける
          newRule.id = null;
        }
        this.eventEngine.addRule(newRule);
      });

      this._saveRulesToStorage();
      this._updateRulesList();
      importedItems.push(`ルール ${data.rules.length}件`);
    }

    // 設定のインポート
    if (importSettings && data.settings) {
      const { obsConnection, events } = data.settings;

      if (obsConnection) {
        this.elements.obsAddress.value = obsConnection.address || 'ws://localhost:4455';
        this.elements.obsPassword.value = obsConnection.password || '';
      }

      if (events) {
        this.elements.eventEnabled.checked = events.enabled !== false;
        this.elements.eventName.value = events.eventName || 'LiveStreamEvent';
        this.elements.eventIncludeOriginal.checked = events.includeOriginal || false;
        this.elements.eventFirstComment.checked = events.firstComment !== false;
        this.elements.eventNewViewer.checked = events.newViewer || false;
        this.elements.eventSuperChat.checked = events.superChat !== false;
        this.elements.eventMembership.checked = events.membership !== false;
        this.elements.eventMembershipGift.checked = events.membershipGift !== false;
        this.elements.eventMemberMilestone.checked = events.memberMilestone !== false;
        this.elements.eventSessionStats.checked = events.sessionStats !== false;
        this.elements.eventForwardComments.checked = events.forwardComments || false;
        this.elements.eventOwnerComment.checked = events.ownerComment || false;
        this.elements.eventModeratorComment.checked = events.moderatorComment || false;
        this.elements.eventMemberComment.checked = events.memberComment || false;
      }

      this._saveSettings();
      this._saveEventSettings();
      importedItems.push('設定');
    }

    // セッションデータのインポート
    if (importSession) {
      if (data.sessionData) {
        this.sessionManager.importData(data.sessionData);
        if (data.sessionData.triggeredOnce) {
          this.eventEngine.importTriggeredOnce(data.sessionData.triggeredOnce);
        }
        this._saveSession();
        this._updateRulesList();
        importedItems.push('セッションデータ');
      }
      // 全期間視聴者データのインポート
      if (data.globalViewers) {
        storage.importGlobalViewers(data.globalViewers);
        const count = data.globalViewers.count || 0;
        importedItems.push(`全期間視聴者 ${count.toLocaleString()}人`);
      }
    }

    this._closeImportModal();
    this._showToast(`インポート完了: ${importedItems.join('、')}`);
    console.log('[App] インポート完了:', importedItems);
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
