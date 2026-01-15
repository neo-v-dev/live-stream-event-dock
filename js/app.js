/**
 * App - メインアプリケーション
 */
class App {
  constructor() {
    // コンポーネント初期化
    this.obsController = new OBSController();
    this.youtubeChat = null; // APIキー設定後に初期化
    this.eventEngine = new EventEngine(this.obsController);

    // 編集中のルール
    this.editingRuleId = null;

    // DOM要素
    this.elements = {};

    // 初期化
    this._initElements();
    this._initEventListeners();
    this._loadSettings();
    this._loadRules();
    this._updateRulesList();
  }

  /**
   * DOM要素を取得
   */
  _initElements() {
    this.elements = {
      // ステータス
      ytStatus: document.getElementById('yt-status'),
      obsStatus: document.getElementById('obs-status'),

      // 設定
      apiKey: document.getElementById('api-key'),
      videoUrl: document.getElementById('video-url'),
      obsAddress: document.getElementById('obs-address'),
      obsPassword: document.getElementById('obs-password'),

      // ボタン
      ytConnect: document.getElementById('yt-connect'),
      ytDisconnect: document.getElementById('yt-disconnect'),
      obsConnect: document.getElementById('obs-connect'),
      obsDisconnect: document.getElementById('obs-disconnect'),
      saveSettings: document.getElementById('save-settings'),
      addRule: document.getElementById('add-rule'),
      clearLog: document.getElementById('clear-log'),

      // リスト
      rulesList: document.getElementById('rules-list'),
      commentLog: document.getElementById('comment-log'),

      // モーダル
      ruleModal: document.getElementById('rule-modal'),
      modalTitle: document.getElementById('modal-title'),
      ruleName: document.getElementById('rule-name'),
      ruleEnabled: document.getElementById('rule-enabled'),
      conditionType: document.getElementById('condition-type'),
      conditionValue: document.getElementById('condition-value'),
      conditionValueGroup: document.getElementById('condition-value-group'),
      conditionAmount: document.getElementById('condition-amount'),
      conditionAmountGroup: document.getElementById('condition-amount-group'),
      conditionFirstComment: document.getElementById('condition-first-comment'),
      conditionModerator: document.getElementById('condition-moderator'),
      actionType: document.getElementById('action-type'),
      actionScene: document.getElementById('action-scene'),
      actionSceneGroup: document.getElementById('action-scene-group'),
      actionSource: document.getElementById('action-source'),
      actionSourceGroup: document.getElementById('action-source-group'),
      actionFilter: document.getElementById('action-filter'),
      actionFilterGroup: document.getElementById('action-filter-group'),
      actionText: document.getElementById('action-text'),
      actionTextGroup: document.getElementById('action-text-group'),
      actionEvent: document.getElementById('action-event'),
      actionEventGroup: document.getElementById('action-event-group'),
      actionDuration: document.getElementById('action-duration'),
      actionDurationGroup: document.getElementById('action-duration-group'),
      ruleCooldown: document.getElementById('rule-cooldown'),
      saveRule: document.getElementById('save-rule'),
      cancelRule: document.getElementById('cancel-rule')
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

    // YouTube接続
    this.elements.ytConnect.addEventListener('click', () => this._connectYouTube());
    this.elements.ytDisconnect.addEventListener('click', () => this._disconnectYouTube());

    // OBS接続
    this.elements.obsConnect.addEventListener('click', () => this._connectOBS());
    this.elements.obsDisconnect.addEventListener('click', () => this._disconnectOBS());

    // 設定保存
    this.elements.saveSettings.addEventListener('click', () => this._saveSettings());

    // ルール追加
    this.elements.addRule.addEventListener('click', () => this._openRuleModal());

    // ログクリア
    this.elements.clearLog.addEventListener('click', () => this._clearLog());

    // モーダル
    document.querySelector('.modal-close').addEventListener('click', () => this._closeRuleModal());
    this.elements.cancelRule.addEventListener('click', () => this._closeRuleModal());
    this.elements.saveRule.addEventListener('click', () => this._saveRule());

    // 条件タイプ変更時のUI更新
    this.elements.conditionType.addEventListener('change', () => this._updateConditionUI());

    // アクションタイプ変更時のUI更新
    this.elements.actionType.addEventListener('change', () => this._updateActionUI());

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
    this.elements.apiKey.value = settings.apiKey || '';
    this.elements.videoUrl.value = settings.videoUrl || '';
    this.elements.obsAddress.value = settings.obsAddress || 'ws://localhost:4455';
    this.elements.obsPassword.value = settings.obsPassword || '';
  }

  /**
   * 設定を保存
   */
  _saveSettings() {
    const settings = {
      apiKey: this.elements.apiKey.value,
      videoUrl: this.elements.videoUrl.value,
      obsAddress: this.elements.obsAddress.value,
      obsPassword: this.elements.obsPassword.value
    };
    storage.saveSettings(settings);
    this._showToast('設定を保存しました');
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
   * YouTube接続
   */
  async _connectYouTube() {
    const apiKey = this.elements.apiKey.value.trim();
    const videoUrl = this.elements.videoUrl.value.trim();

    if (!apiKey) {
      this._showToast('API Keyを入力してください', 'error');
      return;
    }

    if (!videoUrl) {
      this._showToast('配信URLを入力してください', 'error');
      return;
    }

    // YouTubeChatCollectorを初期化
    this.youtubeChat = new YouTubeChatCollector(apiKey);

    // コールバック設定
    this.youtubeChat.onStatusChange = (status) => {
      this._updateStatusIndicator(this.elements.ytStatus, status);
      this.elements.ytConnect.disabled = status === 'connected' || status === 'connecting';
      this.elements.ytDisconnect.disabled = status !== 'connected';
    };

    this.youtubeChat.onMessage = (message) => {
      this._onChatMessage(message);
    };

    this.youtubeChat.onError = (error) => {
      this._showToast(`YouTube: ${error.message}`, 'error');
    };

    try {
      await this.youtubeChat.connect(videoUrl);
      this._showToast('YouTubeに接続しました');
    } catch (error) {
      this._showToast(`接続エラー: ${error.message}`, 'error');
    }
  }

  /**
   * YouTube切断
   */
  async _disconnectYouTube() {
    if (this.youtubeChat) {
      await this.youtubeChat.disconnect();
      this._showToast('YouTubeから切断しました');
    }
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
    } catch (error) {
      this._showToast(`OBS接続エラー: ${error.message}`, 'error');
    }
  }

  /**
   * OBS切断
   */
  async _disconnectOBS() {
    await this.obsController.disconnect();
    this._showToast('OBSから切断しました');
  }

  /**
   * チャットメッセージ受信時
   */
  async _onChatMessage(message) {
    // コンソールログ
    if (message.superchat) {
      console.log(`[YT] スパチャ: ${message.authorName} ${message.superchat.amount} "${message.message}"`);
    } else if (message.newSponsor) {
      console.log(`[YT] 新規メンバー: ${message.authorName}`);
    } else {
      console.log(`[YT] コメント: ${message.authorName}: ${message.message}`);
    }

    // ログに追加
    this._addCommentLog(message);

    // イベントエンジンで処理
    const triggered = await this.eventEngine.processMessage(message);
    if (triggered.length > 0) {
      console.log(`[YT] ${triggered.length}件のルールがトリガーされました`);
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
    this._updateActionUI();
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
    this.elements.conditionType.value = condition.type || 'keyword';
    this.elements.conditionValue.value = condition.value || '';
    this.elements.conditionAmount.value = condition.minAmount || 0;
    this.elements.conditionFirstComment.checked = condition.firstCommentOnly || false;
    this.elements.conditionModerator.checked = condition.moderatorOnly || false;

    // アクション
    const action = rule.action || {};
    this.elements.actionType.value = action.type || 'switchScene';
    this.elements.actionScene.value = action.sceneName || '';
    this.elements.actionSource.value = action.sourceName || '';
    this.elements.actionFilter.value = action.filterName || '';
    this.elements.actionText.value = action.text || '';
    this.elements.actionEvent.value = action.eventName || '';
    this.elements.actionDuration.value = action.duration || 3;

    this.elements.ruleCooldown.value = rule.cooldown || 0;
  }

  /**
   * 条件UI更新
   */
  _updateConditionUI() {
    const type = this.elements.conditionType.value;

    // 値入力の表示/非表示
    const showValue = ['keyword', 'command', 'regex', 'user'].includes(type);
    this.elements.conditionValueGroup.style.display = showValue ? 'block' : 'none';

    // 金額入力の表示/非表示
    const showAmount = type === 'superchat';
    this.elements.conditionAmountGroup.style.display = showAmount ? 'block' : 'none';

    // プレースホルダー更新
    const placeholders = {
      keyword: 'キーワード',
      command: '!コマンド名',
      regex: '正規表現パターン',
      user: 'ユーザー名またはチャンネルID'
    };
    this.elements.conditionValue.placeholder = placeholders[type] || '';
  }

  /**
   * アクションUI更新
   */
  _updateActionUI() {
    const type = this.elements.actionType.value;

    // 全て非表示にしてから必要なものだけ表示
    this.elements.actionSceneGroup.style.display = 'none';
    this.elements.actionSourceGroup.style.display = 'none';
    this.elements.actionFilterGroup.style.display = 'none';
    this.elements.actionTextGroup.style.display = 'none';
    this.elements.actionEventGroup.style.display = 'none';
    this.elements.actionDurationGroup.style.display = 'none';

    switch (type) {
      case 'switchScene':
        this.elements.actionSceneGroup.style.display = 'block';
        break;

      case 'showSource':
        this.elements.actionSceneGroup.style.display = 'block';
        this.elements.actionSourceGroup.style.display = 'block';
        this.elements.actionDurationGroup.style.display = 'block';
        break;

      case 'hideSource':
      case 'toggleSource':
        this.elements.actionSceneGroup.style.display = 'block';
        this.elements.actionSourceGroup.style.display = 'block';
        break;

      case 'setText':
        this.elements.actionSourceGroup.style.display = 'block';
        this.elements.actionTextGroup.style.display = 'block';
        break;

      case 'enableFilter':
      case 'disableFilter':
        this.elements.actionSourceGroup.style.display = 'block';
        this.elements.actionFilterGroup.style.display = 'block';
        break;

      case 'broadcastEvent':
        this.elements.actionEventGroup.style.display = 'block';
        break;
    }
  }

  /**
   * ルールを保存
   */
  _saveRule() {
    const rule = {
      id: this.editingRuleId,
      name: this.elements.ruleName.value.trim(),
      enabled: this.elements.ruleEnabled.checked,
      condition: {
        type: this.elements.conditionType.value,
        value: this.elements.conditionValue.value.trim(),
        minAmount: parseInt(this.elements.conditionAmount.value) || 0,
        firstCommentOnly: this.elements.conditionFirstComment.checked,
        moderatorOnly: this.elements.conditionModerator.checked,
        caseSensitive: false,
        exactMatch: false
      },
      action: {
        type: this.elements.actionType.value,
        sceneName: this.elements.actionScene.value.trim(),
        sourceName: this.elements.actionSource.value.trim(),
        filterName: this.elements.actionFilter.value.trim(),
        text: this.elements.actionText.value,
        eventName: this.elements.actionEvent.value.trim(),
        duration: parseInt(this.elements.actionDuration.value) || 0
      },
      cooldown: parseInt(this.elements.ruleCooldown.value) || 0
    };

    // バリデーション: ルール名
    if (!rule.name) {
      this._showToast('ルール名を入力してください', 'error');
      return;
    }

    // バリデーション: 条件の値（初コメントのみONの場合は値なしでもOK）
    const conditionNeedsValue = ['keyword', 'command', 'regex', 'user'];
    if (conditionNeedsValue.includes(rule.condition.type) && !rule.condition.value && !rule.condition.firstCommentOnly) {
      this._showToast('条件の値を入力してください', 'error');
      return;
    }

    // バリデーション: アクション
    const actionType = rule.action.type;
    if (actionType === 'switchScene' && !rule.action.sceneName) {
      this._showToast('シーン名を入力してください', 'error');
      return;
    }
    if (['showSource', 'hideSource', 'toggleSource'].includes(actionType) && !rule.action.sourceName) {
      this._showToast('ソース名を入力してください', 'error');
      return;
    }
    if (actionType === 'setText' && !rule.action.sourceName) {
      this._showToast('テキストソース名を入力してください', 'error');
      return;
    }
    if (['enableFilter', 'disableFilter'].includes(actionType) && (!rule.action.sourceName || !rule.action.filterName)) {
      this._showToast('ソース名とフィルター名を入力してください', 'error');
      return;
    }
    if (actionType === 'broadcastEvent' && !rule.action.eventName) {
      this._showToast('イベント名を入力してください', 'error');
      return;
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
          <div class="rule-action">アクション: ${this._formatAction(rule.action)}</div>
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
      keyword: 'キーワード',
      command: 'コマンド',
      regex: '正規表現',
      superchat: 'スーパーチャット',
      membership: 'メンバーシップ',
      user: 'ユーザー'
    };

    let text = typeLabels[condition.type] || condition.type;

    if (condition.value) {
      text += ` "${condition.value}"`;
    }

    if (condition.type === 'superchat' && condition.minAmount > 0) {
      text += ` (¥${condition.minAmount}以上)`;
    }

    if (condition.firstCommentOnly) {
      text += ' [初コメ]';
    }

    if (condition.moderatorOnly) {
      text += ' [モデレーターのみ]';
    }

    return text;
  }

  /**
   * アクションをフォーマット
   */
  _formatAction(action) {
    if (!action) return '未設定';

    const typeLabels = {
      switchScene: 'シーン切替',
      showSource: 'ソース表示',
      hideSource: 'ソース非表示',
      toggleSource: 'ソース切替',
      setText: 'テキスト設定',
      enableFilter: 'フィルター有効',
      disableFilter: 'フィルター無効',
      broadcastEvent: 'オーバーレイ送信'
    };

    let text = typeLabels[action.type] || action.type;

    if (action.sceneName) {
      text += ` → "${action.sceneName}"`;
    }

    if (action.sourceName) {
      text += ` [${action.sourceName}]`;
    }

    if (action.type === 'showSource' && action.duration > 0) {
      text += ` (${action.duration}秒)`;
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
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
