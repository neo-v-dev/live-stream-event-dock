/**
 * Storage - localStorage管理クラス
 */
class Storage {
  constructor(prefix = 'stream_manager_') {
    this.prefix = prefix;
  }

  /**
   * キーにプレフィックスを追加
   */
  _key(key) {
    return this.prefix + key;
  }

  /**
   * 値を保存
   */
  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set error:', e);
      return false;
    }
  }

  /**
   * 値を取得
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this._key(key));
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Storage.get error:', e);
      return defaultValue;
    }
  }

  /**
   * 値を削除
   */
  remove(key) {
    try {
      localStorage.removeItem(this._key(key));
      return true;
    } catch (e) {
      console.error('Storage.remove error:', e);
      return false;
    }
  }

  /**
   * 全ての設定をクリア
   */
  clear() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (e) {
      console.error('Storage.clear error:', e);
      return false;
    }
  }

  // 便利なメソッド群

  /**
   * 設定を保存
   */
  saveSettings(settings) {
    return this.set('settings', settings);
  }

  /**
   * 設定を読み込み
   */
  loadSettings() {
    return this.get('settings', {
      obsAddress: 'ws://localhost:4455',
      obsPassword: ''
    });
  }

  /**
   * ルールを保存
   */
  saveRules(rules) {
    return this.set('rules', rules);
  }

  /**
   * ルールを読み込み
   */
  loadRules() {
    return this.get('rules', []);
  }

  /**
   * イベント設定を保存
   */
  saveEventSettings(eventSettings) {
    return this.set('eventSettings', eventSettings);
  }

  /**
   * イベント設定を読み込み
   */
  loadEventSettings() {
    return this.get('eventSettings', this.getDefaultEventSettings());
  }

  /**
   * デフォルトのイベント設定
   */
  getDefaultEventSettings() {
    return {
      // 全体設定
      enabled: true,
      eventName: 'LiveStreamEvent',
      includeOriginal: false,

      // 通常コメント転送
      forwardComments: { enabled: false },

      // 基本イベント
      firstComment: { enabled: true },
      newViewer: { enabled: false },  // 全期間初コメ（NewViewer）
      superChat: { enabled: true },
      membership: { enabled: true },
      membershipGift: { enabled: true },
      memberMilestone: { enabled: true },
      sessionStats: { enabled: true },  // 累計統計（5秒毎+スパチャ/ギフト時）

      // ロールベースイベント
      moderatorComment: { enabled: false },
      ownerComment: { enabled: false },
      memberComment: { enabled: false }
    };
  }

  /**
   * セッションデータを保存
   */
  saveSessionData(sessionData) {
    return this.set('sessionData', {
      ...sessionData,
      savedAt: new Date().toISOString()
    });
  }

  /**
   * セッションデータを読み込み
   */
  loadSessionData() {
    return this.get('sessionData', null);
  }

  /**
   * セッションデータをクリア
   */
  clearSessionData() {
    return this.remove('sessionData');
  }

  // ========== 全期間初コメユーザー（NewViewer）管理 ==========

  /**
   * 全期間初コメユーザーを保存
   */
  saveGlobalViewers(channelIds) {
    return this.set('globalViewers', {
      channelIds: channelIds,
      count: channelIds.length,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * 全期間初コメユーザーを読み込み
   */
  loadGlobalViewers() {
    const data = this.get('globalViewers', null);
    return data ? data.channelIds : [];
  }

  /**
   * 全期間初コメユーザーを追加
   * @returns {boolean} 新規ユーザーだった場合true
   */
  addGlobalViewer(channelId) {
    if (!channelId) return false;

    const channelIds = this.loadGlobalViewers();

    // 既に存在する場合は新規ではない
    if (channelIds.includes(channelId)) {
      return false;
    }

    channelIds.push(channelId);
    this.saveGlobalViewers(channelIds);
    return true;
  }

  /**
   * 全期間初コメユーザー数を取得
   */
  getGlobalViewersCount() {
    const data = this.get('globalViewers', null);
    return data ? data.count : 0;
  }

  /**
   * 全期間初コメユーザーをクリア
   */
  clearGlobalViewers() {
    return this.remove('globalViewers');
  }

  /**
   * 全期間初コメユーザーをエクスポート
   */
  exportGlobalViewers() {
    return this.get('globalViewers', { channelIds: [], count: 0, updatedAt: null });
  }

  /**
   * 全期間初コメユーザーをインポート
   */
  importGlobalViewers(data) {
    if (data && Array.isArray(data.channelIds)) {
      return this.saveGlobalViewers(data.channelIds);
    }
    return false;
  }
}

// グローバルインスタンス
const storage = new Storage();
