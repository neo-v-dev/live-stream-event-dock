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
}

// グローバルインスタンス
const storage = new Storage();
