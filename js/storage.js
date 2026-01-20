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

  // ========== 全期間ユーザー（GlobalViewers）管理 ==========

  /**
   * 全期間ユーザーデータを保存
   * @param {Object} globalViewersData - { channelIds, users, count, updatedAt }
   */
  saveGlobalViewers(globalViewersData) {
    // 後方互換性のため、配列が渡された場合は旧形式として処理
    if (Array.isArray(globalViewersData)) {
      return this.set('globalViewers', {
        channelIds: globalViewersData,
        users: {},
        count: globalViewersData.length,
        updatedAt: new Date().toISOString()
      });
    }
    return this.set('globalViewers', {
      ...globalViewersData,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * 全期間ユーザーデータを読み込み（マイグレーション対応）
   * @returns {Object} { channelIds, users, count, updatedAt }
   */
  loadGlobalViewersData() {
    const data = this.get('globalViewers', null);
    if (!data) {
      return { channelIds: [], users: {}, count: 0, updatedAt: null };
    }

    // マイグレーション: usersがない旧形式の場合
    if (!data.users) {
      const migrated = {
        channelIds: data.channelIds || [],
        users: {},
        count: data.channelIds ? data.channelIds.length : 0,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      // マイグレーション結果を保存
      this.saveGlobalViewers(migrated);
      console.log('[Storage] GlobalViewersデータをマイグレーションしました');
      return migrated;
    }

    return data;
  }

  /**
   * 全期間初コメユーザーのchannelIdリストを読み込み（後方互換性）
   */
  loadGlobalViewers() {
    const data = this.loadGlobalViewersData();
    return data.channelIds || [];
  }

  /**
   * 全期間ユーザー情報を更新
   * @param {string} channelId - ユーザーのチャンネルID
   * @param {Object} userInfo - ユーザー情報
   * @returns {boolean} 新規ユーザーだった場合true
   */
  updateGlobalUser(channelId, userInfo) {
    if (!channelId) return false;

    const data = this.loadGlobalViewersData();
    const now = new Date().toISOString();
    const isNewUser = !data.channelIds.includes(channelId);

    // 新規ユーザーの場合、channelIdsに追加
    if (isNewUser) {
      data.channelIds.push(channelId);
      data.count = data.channelIds.length;
    }

    // ユーザー情報を更新または作成
    const existingUser = data.users[channelId] || {};
    const existingStats = existingUser.stats || {
      totalMessages: 0,
      totalSuperChat: 0,
      totalSuperChatCount: 0,
      totalGifts: 0,
      sessionCount: 0
    };

    data.users[channelId] = {
      displayName: userInfo.displayName || existingUser.displayName || '',
      profileImage: userInfo.profileImage || existingUser.profileImage || '',
      roles: {
        isMember: userInfo.isMember ?? existingUser.roles?.isMember ?? false,
        isModerator: userInfo.isModerator ?? existingUser.roles?.isModerator ?? false,
        isOwner: userInfo.isOwner ?? existingUser.roles?.isOwner ?? false
      },
      stats: {
        totalMessages: existingStats.totalMessages + (userInfo.messageIncrement || 0),
        totalSuperChat: existingStats.totalSuperChat + (userInfo.superChatAmount || 0),
        totalSuperChatCount: existingStats.totalSuperChatCount + (userInfo.superChatIncrement || 0),
        totalGifts: existingStats.totalGifts + (userInfo.giftIncrement || 0),
        sessionCount: existingStats.sessionCount + (userInfo.newSession ? 1 : 0)
      },
      lastMessage: userInfo.lastMessage || existingUser.lastMessage || null,
      firstSeenAt: existingUser.firstSeenAt || now,
      lastSeenAt: now
    };

    this.saveGlobalViewers(data);
    return isNewUser;
  }

  /**
   * 全期間初コメユーザーを追加（後方互換性）
   * @returns {boolean} 新規ユーザーだった場合true
   */
  addGlobalViewer(channelId) {
    if (!channelId) return false;

    const data = this.loadGlobalViewersData();

    // 既に存在する場合は新規ではない
    if (data.channelIds.includes(channelId)) {
      return false;
    }

    data.channelIds.push(channelId);
    data.count = data.channelIds.length;

    // 最低限のユーザー情報を作成
    if (!data.users[channelId]) {
      const now = new Date().toISOString();
      data.users[channelId] = {
        displayName: '',
        profileImage: '',
        roles: { isMember: false, isModerator: false, isOwner: false },
        stats: {
          totalMessages: 0,
          totalSuperChat: 0,
          totalSuperChatCount: 0,
          totalGifts: 0,
          sessionCount: 0
        },
        lastMessage: null,
        firstSeenAt: now,
        lastSeenAt: now
      };
    }

    this.saveGlobalViewers(data);
    return true;
  }

  /**
   * 全期間初コメユーザー数を取得
   */
  getGlobalViewersCount() {
    const data = this.loadGlobalViewersData();
    return data.count || 0;
  }

  /**
   * 全期間ユーザーリストを取得（ソート・フィルター対応）
   * @param {Object} options - { sortBy, sortOrder, filter, limit, offset }
   * @returns {Object} { users: Array, total: number }
   */
  getGlobalUsersList(options = {}) {
    const {
      sortBy = 'lastSeenAt',
      sortOrder = 'desc',
      filter = '',
      limit = 50,
      offset = 0
    } = options;

    const data = this.loadGlobalViewersData();
    let users = Object.entries(data.users).map(([channelId, user]) => ({
      channelId,
      ...user
    }));

    // フィルター（表示名で検索）
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      users = users.filter(u =>
        u.displayName && u.displayName.toLowerCase().includes(lowerFilter)
      );
    }

    // ソート
    users.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'totalSuperChat':
          aVal = a.stats?.totalSuperChat || 0;
          bVal = b.stats?.totalSuperChat || 0;
          break;
        case 'totalMessages':
          aVal = a.stats?.totalMessages || 0;
          bVal = b.stats?.totalMessages || 0;
          break;
        case 'lastSeenAt':
          aVal = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          bVal = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          break;
        case 'firstSeenAt':
          aVal = a.firstSeenAt ? new Date(a.firstSeenAt).getTime() : 0;
          bVal = b.firstSeenAt ? new Date(b.firstSeenAt).getTime() : 0;
          break;
        default:
          aVal = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          bVal = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      }

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    const total = users.length;

    // ページネーション
    users = users.slice(offset, offset + limit);

    return { users, total };
  }

  /**
   * 個別ユーザーを削除
   * @param {string} channelId - 削除するユーザーのチャンネルID
   * @returns {boolean} 削除成功した場合true
   */
  deleteGlobalUser(channelId) {
    if (!channelId) return false;

    const data = this.loadGlobalViewersData();

    // channelIdsから削除
    const index = data.channelIds.indexOf(channelId);
    if (index === -1) return false;

    data.channelIds.splice(index, 1);
    data.count = data.channelIds.length;

    // usersから削除
    delete data.users[channelId];

    this.saveGlobalViewers(data);
    return true;
  }

  /**
   * 複数ユーザーを一括削除
   * @param {Array<string>} channelIds - 削除するチャンネルIDの配列
   * @returns {number} 削除した件数
   */
  deleteGlobalUsers(channelIds) {
    if (!Array.isArray(channelIds) || channelIds.length === 0) return 0;

    const data = this.loadGlobalViewersData();
    let deletedCount = 0;

    for (const channelId of channelIds) {
      const index = data.channelIds.indexOf(channelId);
      if (index !== -1) {
        data.channelIds.splice(index, 1);
        delete data.users[channelId];
        deletedCount++;
      }
    }

    data.count = data.channelIds.length;
    this.saveGlobalViewers(data);
    return deletedCount;
  }

  /**
   * 全期間初コメユーザーをクリア（全削除）
   */
  clearGlobalViewers() {
    return this.remove('globalViewers');
  }

  /**
   * 全期間初コメユーザーをエクスポート
   */
  exportGlobalViewers() {
    return this.loadGlobalViewersData();
  }

  /**
   * 全期間初コメユーザーをインポート（常にマージ）
   */
  importGlobalViewers(importData) {
    if (!importData) return false;

    const existing = this.loadGlobalViewersData();

    // 旧形式（channelIdsのみ）の場合
    if (Array.isArray(importData.channelIds) && !importData.users) {
      const merged = [...new Set([...existing.channelIds, ...importData.channelIds])];
      existing.channelIds = merged;
      existing.count = merged.length;
      this.saveGlobalViewers(existing);
      return true;
    }

    // 新形式（usersあり）の場合
    if (importData.users) {
      // channelIdsをマージ
      const mergedChannelIds = [...new Set([
        ...existing.channelIds,
        ...(importData.channelIds || Object.keys(importData.users))
      ])];

      // ユーザー情報をマージ（インポートデータで上書き or 新規追加）
      const mergedUsers = { ...existing.users };
      for (const [channelId, userData] of Object.entries(importData.users)) {
        if (mergedUsers[channelId]) {
          // 既存ユーザー: 統計をマージ
          const existingStats = mergedUsers[channelId].stats || {};
          const importStats = userData.stats || {};
          mergedUsers[channelId] = {
            ...mergedUsers[channelId],
            displayName: userData.displayName || mergedUsers[channelId].displayName,
            profileImage: userData.profileImage || mergedUsers[channelId].profileImage,
            roles: userData.roles || mergedUsers[channelId].roles,
            stats: {
              totalMessages: Math.max(existingStats.totalMessages || 0, importStats.totalMessages || 0),
              totalSuperChat: Math.max(existingStats.totalSuperChat || 0, importStats.totalSuperChat || 0),
              totalSuperChatCount: Math.max(existingStats.totalSuperChatCount || 0, importStats.totalSuperChatCount || 0),
              totalGifts: Math.max(existingStats.totalGifts || 0, importStats.totalGifts || 0),
              sessionCount: Math.max(existingStats.sessionCount || 0, importStats.sessionCount || 0)
            },
            lastMessage: userData.lastMessage || mergedUsers[channelId].lastMessage,
            firstSeenAt: mergedUsers[channelId].firstSeenAt || userData.firstSeenAt,
            lastSeenAt: userData.lastSeenAt > mergedUsers[channelId].lastSeenAt
              ? userData.lastSeenAt
              : mergedUsers[channelId].lastSeenAt
          };
        } else {
          // 新規ユーザー
          mergedUsers[channelId] = userData;
        }
      }

      this.saveGlobalViewers({
        channelIds: mergedChannelIds,
        users: mergedUsers,
        count: mergedChannelIds.length
      });
      return true;
    }

    return false;
  }
}

// グローバルインスタンス
const storage = new Storage();
