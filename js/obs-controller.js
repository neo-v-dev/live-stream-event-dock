/**
 * OBSController - OBS WebSocket制御クラス
 * OBSWebSocketClient（自前実装）を使用
 */
class OBSController {
  constructor() {
    this.obs = null;
    this.connected = false;
    this.sceneItemCache = new Map();

    // コールバック
    this.onStatusChange = null;
    this.onError = null;
    this.onChatMessage = null;
    this.onStatsUpdate = null;

    // 初コメント判定用
    this.commentedUsers = new Set();
  }

  /**
   * OBSに接続
   */
  async connect(address = 'ws://localhost:4455', password = '') {
    if (this.connected) {
      await this.disconnect();
    }

    this._setStatus('connecting');
    console.log('[OBS] 接続開始:', address);

    try {
      // OBSWebSocketClientクラスの存在確認
      if (typeof OBSWebSocketClient === 'undefined') {
        throw new Error('OBSWebSocketClientが読み込まれていません');
      }

      this.obs = new OBSWebSocketClient();
      console.log('[OBS] OBSWebSocketClientインスタンス作成');

      // イベントハンドラ設定
      this.obs.onClose = () => {
        console.log('[OBS] 接続が閉じられました');
        this.connected = false;
        this._setStatus('disconnected');
      };

      this.obs.onError = (err) => {
        console.error('[OBS] 接続エラー:', err);
        this.connected = false;
        this._setStatus('error');
        this.onError?.(err);
      };

      // 接続
      console.log('[OBS] connect()呼び出し中...');
      const result = await this.obs.connect(address, password);
      console.log('[OBS] 接続成功:', result);

      this.connected = true;
      this._setStatus('connected');

      // シーンアイテムキャッシュをクリア
      this.sceneItemCache.clear();

      // 初コメント判定をリセット
      this.commentedUsers.clear();

      // イベントハンドラ設定（YouTube Live Chat Extension対応）
      this.obs.onEvent = (eventType, eventData) => {
        if (eventType !== 'CustomEvent') return;

        // チャットメッセージ（YouTubeLiveChat）
        if (eventData?.eventName === 'YouTubeLiveChat') {
          const message = this._convertChatMessage(eventData.eventData);
          if (message) {
            console.log('[OBS] チャットメッセージ受信:', message.authorName, message.message);
            this.onChatMessage?.(message);
          }
        }

        // YouTube統計（YouTubeLiveStats）
        if (eventData?.eventName === 'YouTubeLiveStats') {
          const stats = this._convertYouTubeStats(eventData.eventData);
          if (stats) {
            console.log('[OBS] YouTube統計受信:', stats);
            this.onStatsUpdate?.(stats);
          }
        }
      };

      return true;
    } catch (error) {
      console.error('[OBS] 接続失敗:', error);
      this.connected = false;
      this._setStatus('error');
      throw new Error(`OBS接続エラー: ${error.message}`);
    }
  }

  /**
   * OBSから切断
   */
  async disconnect() {
    if (this.obs) {
      try {
        this.obs.disconnect();
      } catch (e) {
        // 無視
      }
      this.obs = null;
    }
    this.connected = false;
    this.sceneItemCache.clear();
    this._setStatus('disconnected');
  }

  /**
   * 接続確認
   */
  _checkConnection() {
    if (!this.connected || !this.obs) {
      throw new Error('OBSに接続されていません');
    }
  }

  /**
   * シーン切替
   */
  async switchScene(sceneName) {
    this._checkConnection();
    await this.obs.call('SetCurrentProgramScene', { sceneName });
  }

  /**
   * 現在のシーン名を取得
   */
  async getCurrentScene() {
    this._checkConnection();
    const response = await this.obs.call('GetCurrentProgramScene');
    return response.currentProgramSceneName;
  }

  /**
   * シーン一覧を取得
   */
  async getSceneList() {
    this._checkConnection();
    const response = await this.obs.call('GetSceneList');
    return response.scenes.map(s => s.sceneName);
  }

  /**
   * シーンアイテムIDを取得（キャッシュ付き）
   */
  async _getSceneItemId(sceneName, sourceName) {
    const cacheKey = `${sceneName}::${sourceName}`;

    if (this.sceneItemCache.has(cacheKey)) {
      return this.sceneItemCache.get(cacheKey);
    }

    this._checkConnection();
    const response = await this.obs.call('GetSceneItemId', {
      sceneName,
      sourceName
    });

    const sceneItemId = response.sceneItemId;
    this.sceneItemCache.set(cacheKey, sceneItemId);
    return sceneItemId;
  }

  /**
   * ソース表示/非表示
   */
  async setSourceVisible(sceneName, sourceName, visible) {
    this._checkConnection();

    // シーン名が指定されていない場合は現在のシーンを使用
    if (!sceneName) {
      sceneName = await this.getCurrentScene();
    }

    const sceneItemId = await this._getSceneItemId(sceneName, sourceName);
    await this.obs.call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId,
      sceneItemEnabled: visible
    });
  }

  /**
   * ソース表示
   */
  async showSource(sceneName, sourceName) {
    await this.setSourceVisible(sceneName, sourceName, true);
  }

  /**
   * ソース非表示
   */
  async hideSource(sceneName, sourceName) {
    await this.setSourceVisible(sceneName, sourceName, false);
  }

  /**
   * ソース表示切替
   */
  async toggleSource(sceneName, sourceName) {
    this._checkConnection();

    if (!sceneName) {
      sceneName = await this.getCurrentScene();
    }

    const sceneItemId = await this._getSceneItemId(sceneName, sourceName);
    const response = await this.obs.call('GetSceneItemEnabled', {
      sceneName,
      sceneItemId
    });

    await this.obs.call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId,
      sceneItemEnabled: !response.sceneItemEnabled
    });
  }

  /**
   * 一時的にソースを表示（指定秒数後に非表示）
   */
  async flashSource(sceneName, sourceName, duration = 3000) {
    await this.showSource(sceneName, sourceName);
    if (duration > 0) {
      setTimeout(() => {
        this.hideSource(sceneName, sourceName).catch(console.error);
      }, duration);
    }
  }

  /**
   * フィルター有効/無効
   */
  async setFilterEnabled(sourceName, filterName, enabled) {
    this._checkConnection();
    await this.obs.call('SetSourceFilterEnabled', {
      sourceName,
      filterName,
      filterEnabled: enabled
    });
  }

  /**
   * フィルター有効
   */
  async enableFilter(sourceName, filterName) {
    await this.setFilterEnabled(sourceName, filterName, true);
  }

  /**
   * フィルター無効
   */
  async disableFilter(sourceName, filterName) {
    await this.setFilterEnabled(sourceName, filterName, false);
  }

  /**
   * テキスト設定（テキストソース用）
   */
  async setText(sourceName, text) {
    this._checkConnection();
    await this.obs.call('SetInputSettings', {
      inputName: sourceName,
      inputSettings: { text }
    });
  }

  /**
   * ホットキー実行
   */
  async triggerHotkey(hotkeyName) {
    this._checkConnection();
    await this.obs.call('TriggerHotkeyByName', { hotkeyName });
  }

  /**
   * ホットキー実行（キーシーケンス）
   */
  async triggerHotkeySequence(keyId, keyModifiers = {}) {
    this._checkConnection();
    await this.obs.call('TriggerHotkeyByKeySequence', {
      keyId,
      keyModifiers
    });
  }

  /**
   * 入力ソース一覧を取得
   */
  async getInputList() {
    this._checkConnection();
    const response = await this.obs.call('GetInputList');
    return response.inputs;
  }

  /**
   * ステータス変更通知
   */
  _setStatus(status) {
    this.onStatusChange?.(status);
  }

  /**
   * アクションを実行（統合メソッド）
   */
  async executeAction(action, context = {}) {
    const { type, sceneName, sourceName, filterName, text, eventName, duration } = action;

    // テキスト内の変数を置換
    const resolveText = (str) => {
      if (!str) return str;
      return str
        .replace(/\$\{message\}/g, context.message || '')
        .replace(/\$\{user\}/g, context.user || '')
        .replace(/\$\{amount\}/g, context.amount || '');
    };

    switch (type) {
      case 'switchScene':
        await this.switchScene(sceneName);
        break;

      case 'showSource':
        if (duration && duration > 0) {
          await this.flashSource(sceneName, sourceName, duration * 1000);
        } else {
          await this.showSource(sceneName, sourceName);
        }
        break;

      case 'hideSource':
        await this.hideSource(sceneName, sourceName);
        break;

      case 'toggleSource':
        await this.toggleSource(sceneName, sourceName);
        break;

      case 'setText':
        await this.setText(sourceName, resolveText(text));
        break;

      case 'enableFilter':
        await this.enableFilter(sourceName, filterName);
        break;

      case 'disableFilter':
        await this.disableFilter(sourceName, filterName);
        break;

      case 'broadcastEvent':
        // OBS WebSocketでオーバーレイに送信
        if (this.connected && this.obs) {
          try {
            await this.obs.call('BroadcastCustomEvent', {
              eventData: {
                type: eventName,
                payload: context,
                timestamp: Date.now()
              }
            });
            console.log('[OBS] カスタムイベント送信:', eventName);
          } catch (e) {
            console.error('[OBS] カスタムイベント送信エラー:', e);
          }
        } else {
          console.warn('[OBS] 未接続のためイベント送信スキップ');
        }
        break;

      default:
        console.warn('不明なアクションタイプ:', type);
    }
  }

  /**
   * 拡張機能からのメッセージを内部形式に変換
   */
  _convertChatMessage(liveChatMessage) {
    if (!liveChatMessage) return null;

    // デバッグ: 受信データの構造を確認（初回のみ）
    if (!this._loggedChatStructure) {
      console.log('[OBS] チャットメッセージ構造:', JSON.stringify(liveChatMessage, null, 2));
      this._loggedChatStructure = true;
    }

    const snippet = liveChatMessage.snippet || {};
    const authorDetails = liveChatMessage.authorDetails || {};
    const type = snippet.type || 'textMessageEvent';
    const channelId = authorDetails.channelId || '';

    // 初コメント判定
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    // メモリリーク防止: 500件を超えたら古いものを削除
    if (this.commentedUsers.size > 500) {
      const usersArray = Array.from(this.commentedUsers);
      this.commentedUsers = new Set(usersArray.slice(-250));
    }

    const message = {
      id: liveChatMessage.id,
      type: type,
      liveChatId: snippet.liveChatId || null,  // 配信識別用
      authorName: authorDetails.displayName || '',
      authorChannelId: channelId,
      authorProfileImage: authorDetails.profileImageUrl || '',
      message: snippet.displayMessage || '',
      timestamp: new Date(snippet.publishedAt),
      isOwner: authorDetails.isChatOwner || false,
      isModerator: authorDetails.isChatModerator || false,
      isMember: authorDetails.isChatSponsor || false,
      isFirstComment: isFirstComment,
      superchat: null,
      membershipGift: null,
      memberMilestone: null,
      newSponsor: false
    };

    // スーパーチャット
    if (type === 'superChatEvent' || type === 'superStickerEvent') {
      const details = snippet.superChatDetails || snippet.superStickerDetails || {};
      message.superchat = {
        amount: details.amountDisplayString || '',
        amountMicros: details.amountMicros || '0',
        currency: details.currency || 'JPY',
        tier: details.tier || 0
      };
      message.message = snippet.superChatDetails?.userComment || snippet.displayMessage || '';
    }

    // メンバーシップギフト
    if (type === 'membershipGiftingEvent') {
      const details = snippet.membershipGiftingDetails || {};
      message.membershipGift = {
        count: details.giftMembershipsCount || 0
      };
    }

    // 新規メンバー
    if (type === 'newSponsorEvent') {
      message.newSponsor = true;
    }

    // メンバーマイルストーン（マイルストーンチャット）
    if (type === 'memberMilestoneChatEvent') {
      const details = snippet.memberMilestoneChatDetails || {};
      message.memberMilestone = {
        memberMonth: details.memberMonth || 0,
        memberLevelName: details.memberLevelName || '',
        userComment: details.userComment || ''
      };
      message.message = details.userComment || '';
    }

    return message;
  }

  /**
   * YouTube統計データを内部形式に変換
   */
  _convertYouTubeStats(videoResource) {
    if (!videoResource) return null;

    const statistics = videoResource.statistics || {};
    const liveDetails = videoResource.liveStreamingDetails || {};

    return {
      videoId: videoResource.id || '',
      activeLiveChatId: liveDetails.activeLiveChatId || null,  // 配信識別用
      concurrentViewers: parseInt(liveDetails.concurrentViewers) || 0,
      likeCount: parseInt(statistics.likeCount) || 0,
      viewCount: parseInt(statistics.viewCount) || 0,
      actualStartTime: liveDetails.actualStartTime || null,
      timestamp: new Date().toISOString()
    };
  }
}
