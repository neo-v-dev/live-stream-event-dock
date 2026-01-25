/**
 * SessionManager - 配信セッションとユーザー累計情報を管理
 */
class SessionManager {
  constructor() {
    // セッションID（配信ごとにユニーク）
    this.sessionId = this._generateSessionId();

    // 現在の配信のliveChatId（YouTube APIから取得）
    this.currentLiveChatId = null;

    // liveChatId変更時のコールバック（app.jsで設定）
    this.onLiveChatIdChange = null;

    // ユーザーデータ: channelId -> UserSession
    this.users = new Map();

    // セッション開始時刻
    this.startedAt = new Date().toISOString();

    // セッションレベルのカウンター
    this.newMemberCount = 0;
    this.newViewerCount = 0;  // セッション内の新規視聴者数

    // カスタムカウンター: name -> count
    this.customCounters = new Map();

    // YouTube統計データ
    this.youtubeStats = {
      concurrentViewers: 0,
      likeCount: 0,
      viewCount: 0,
      lastUpdated: null
    };

    // 前回のYouTube統計（閾値判定用）
    this.previousYoutubeStats = {
      concurrentViewers: 0,
      likeCount: 0,
      viewCount: 0
    };

    // 設定
    this.config = {
      maxUsers: 1000  // メモリリーク防止
    };

    // イベント有効/無効設定
    this.eventSettings = {
      forwardComments: { enabled: false },
      firstComment: { enabled: true },
      newViewer: { enabled: false },
      superChat: { enabled: true },
      superSticker: { enabled: true },
      membership: { enabled: true },
      membershipGift: { enabled: true },
      memberMilestone: { enabled: true },
      sessionStats: { enabled: true },
      moderatorComment: { enabled: false },
      ownerComment: { enabled: false },
      memberComment: { enabled: false }
    };
  }

  /**
   * イベント設定を更新
   */
  setEventSettings(settings) {
    // イベント有効/無効設定のマージ
    Object.assign(this.eventSettings, {
      forwardComments: settings.forwardComments || { enabled: false },
      firstComment: settings.firstComment || { enabled: true },
      newViewer: settings.newViewer || { enabled: false },
      superChat: settings.superChat || { enabled: true },
      superSticker: settings.superSticker || { enabled: true },
      membership: settings.membership || { enabled: true },
      membershipGift: settings.membershipGift || { enabled: true },
      memberMilestone: settings.memberMilestone || { enabled: true },
      sessionStats: settings.sessionStats || { enabled: true },
      moderatorComment: settings.moderatorComment || { enabled: false },
      ownerComment: settings.ownerComment || { enabled: false },
      memberComment: settings.memberComment || { enabled: false }
    });
  }

  /**
   * セッションIDを生成
   */
  _generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${random}`;
  }

  /**
   * セッションをリセット（新しい配信開始時）
   * @param {string|null} newLiveChatId - 新しいliveChatId（省略時はnullでリセット）
   */
  reset(newLiveChatId = null) {
    this.sessionId = this._generateSessionId();
    this.currentLiveChatId = newLiveChatId;
    this.users.clear();
    this.startedAt = new Date().toISOString();
    this.newMemberCount = 0;
    this.newViewerCount = 0;
    this.customCounters.clear();

    // YouTube統計もリセット
    this.youtubeStats = {
      concurrentViewers: 0,
      likeCount: 0,
      viewCount: 0,
      lastUpdated: null
    };
    this.previousYoutubeStats = {
      concurrentViewers: 0,
      likeCount: 0,
      viewCount: 0
    };

    console.log('[Session] 新しいセッション開始:', this.sessionId, 'liveChatId:', newLiveChatId);
  }

  /**
   * liveChatIdを更新し、変更があればコールバックを呼び出す
   * @param {string|null} liveChatId - 新しいliveChatId
   * @returns {Object} { changed: boolean, previous: string|null, current: string|null }
   */
  updateLiveChatId(liveChatId) {
    // nullや空文字は無視（liveChatIdが取得できない状況）
    if (!liveChatId) {
      return { changed: false, previous: this.currentLiveChatId, current: this.currentLiveChatId };
    }

    const previous = this.currentLiveChatId;

    // 初回設定の場合
    if (!previous) {
      this.currentLiveChatId = liveChatId;
      console.log('[Session] liveChatId初期設定:', liveChatId);
      return { changed: false, previous: null, current: liveChatId };
    }

    // 変更があった場合
    if (previous !== liveChatId) {
      console.log('[Session] liveChatId変更検出:', previous, '->', liveChatId);

      // コールバックを呼び出し（app.jsで確認ダイアログを表示）
      if (this.onLiveChatIdChange) {
        this.onLiveChatIdChange(previous, liveChatId);
      }

      return { changed: true, previous, current: liveChatId };
    }

    return { changed: false, previous, current: liveChatId };
  }

  /**
   * liveChatIdを強制的に設定（確認ダイアログ後など）
   * @param {string|null} liveChatId
   */
  setLiveChatId(liveChatId) {
    this.currentLiveChatId = liveChatId;
    console.log('[Session] liveChatId設定:', liveChatId);
  }

  /**
   * セッションデータをエクスポート（保存用）
   */
  exportData() {
    // MapをArray形式に変換
    const usersArray = Array.from(this.users.entries()).map(([channelId, userData]) => ({
      channelId,
      ...userData
    }));

    return {
      sessionId: this.sessionId,
      liveChatId: this.currentLiveChatId,
      startedAt: this.startedAt,
      newMemberCount: this.newMemberCount,
      newViewerCount: this.newViewerCount,
      users: usersArray,
      customCounters: Object.fromEntries(this.customCounters)
    };
  }

  /**
   * セッションデータをインポート（復元用）
   */
  importData(data) {
    if (!data) return false;

    try {
      this.sessionId = data.sessionId || this._generateSessionId();
      this.currentLiveChatId = data.liveChatId || null;
      this.startedAt = data.startedAt || new Date().toISOString();
      this.newMemberCount = data.newMemberCount || 0;
      this.newViewerCount = data.newViewerCount || 0;

      // カスタムカウンター復元
      this.customCounters.clear();
      if (data.customCounters) {
        for (const [name, count] of Object.entries(data.customCounters)) {
          this.customCounters.set(name, count);
        }
      }

      // Array形式からMapに復元
      this.users.clear();
      if (data.users && Array.isArray(data.users)) {
        for (const userData of data.users) {
          const { channelId, ...rest } = userData;
          if (channelId) {
            this.users.set(channelId, {
              channelId,
              messageCount: rest.messageCount || 0,
              superChatTotal: rest.superChatTotal || 0,
              superChatCount: rest.superChatCount || 0,
              giftCount: rest.giftCount || 0,
              firstSeenAt: rest.firstSeenAt || new Date().toISOString(),
              lastSeenAt: rest.lastSeenAt || new Date().toISOString()
            });
          }
        }
      }

      console.log('[Session] セッション復元:', this.sessionId, 'liveChatId:', this.currentLiveChatId, `(${this.users.size}ユーザー)`);
      return true;
    } catch (e) {
      console.error('[Session] セッション復元エラー:', e);
      return false;
    }
  }

  /**
   * ユーザーセッションを取得または作成
   */
  getUser(channelId) {
    if (!channelId) return null;

    if (!this.users.has(channelId)) {
      // メモリリーク防止
      if (this.users.size >= this.config.maxUsers) {
        this._evictOldUsers();
      }

      this.users.set(channelId, {
        channelId,
        messageCount: 0,
        superChatTotal: 0,
        superChatCount: 0,
        giftCount: 0,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });
    }

    return this.users.get(channelId);
  }

  /**
   * 古いユーザーを削除（LRU的）
   */
  _evictOldUsers() {
    const entries = Array.from(this.users.entries());
    // lastSeenAtでソートして古い半分を削除
    entries.sort((a, b) =>
      new Date(a[1].lastSeenAt) - new Date(b[1].lastSeenAt)
    );

    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    for (const [key] of toRemove) {
      this.users.delete(key);
    }
    console.log('[Session] 古いユーザーを削除:', toRemove.length, '件');
  }

  /**
   * メッセージを処理して累計を更新
   * @returns {Object} 検出されたイベント情報
   */
  processMessage(message) {
    const channelId = message.authorChannelId;
    if (!channelId) return { events: [] };

    const user = this.getUser(channelId);
    const events = [];
    const now = new Date().toISOString();

    // 初コメント判定
    const isFirstComment = user.messageCount === 0;

    // メッセージカウント更新
    user.messageCount++;
    user.lastSeenAt = now;

    // FirstComment イベント（セッション初コメ）
    if (isFirstComment && this.eventSettings.firstComment?.enabled) {
      events.push({
        type: 'FirstComment',
        payload: {
          message: message.message
        }
      });
    }

    // NewViewer 判定（全期間初コメ）- カウントは常に追跡
    if (isFirstComment) {
      const isNewViewer = storage.addGlobalViewer(channelId);
      if (isNewViewer) {
        this.newViewerCount++;
        // イベント送信は設定で有効な場合のみ
        if (this.eventSettings.newViewer?.enabled) {
          events.push({
            type: 'NewViewer',
            payload: {
              message: message.message,
              globalViewerCount: storage.getGlobalViewersCount(),
              sessionNewViewerCount: this.newViewerCount
            }
          });
        }
      }
    }

    // グローバルユーザー情報を更新
    this._updateGlobalUser(message, user, isFirstComment);

    // スーパーチャット処理
    if (message.superchat) {
      const amount = this._parseAmount(message.superchat);
      const isFirstSuperchat = user.superChatCount === 0;

      user.superChatTotal += amount;
      user.superChatCount++;

      if (this.eventSettings.superChat?.enabled) {
        events.push({
          type: 'SuperChat',
          payload: {
            amount,
            amountMicros: parseInt(message.superchat.amountMicros) || 0,
            amountDisplayString: message.superchat.amount,
            currency: message.superchat.currency || 'JPY',
            tier: message.superchat.tier || 0,
            message: message.message,
            sessionTotal: user.superChatTotal,
            superChatCount: user.superChatCount,
            isFirstSuperchat
          }
        });
      }
    }

    // スーパーステッカー処理
    if (message.superSticker) {
      const amount = this._parseAmount(message.superSticker);
      const isFirstSuperchat = user.superChatCount === 0;

      user.superChatTotal += amount;
      user.superChatCount++;

      if (this.eventSettings.superSticker?.enabled) {
        events.push({
          type: 'SuperSticker',
          payload: {
            amount,
            amountMicros: parseInt(message.superSticker.amountMicros) || 0,
            amountDisplayString: message.superSticker.amount,
            currency: message.superSticker.currency || 'JPY',
            tier: message.superSticker.tier || 0,
            stickerId: message.superSticker.stickerId || '',
            altText: message.superSticker.altText || '',
            sessionTotal: user.superChatTotal,
            superChatCount: user.superChatCount,
            isFirstSuperchat
          }
        });
      }
    }

    // メンバーシップギフト処理
    if (message.membershipGift && this.eventSettings.membershipGift?.enabled) {
      const isFirstGift = user.giftCount === 0;
      const count = message.membershipGift.count || 1;

      user.giftCount += count;

      events.push({
        type: 'MembershipGift',
        payload: {
          count,
          levelName: message.membershipGift.levelName || '',
          sessionGiftTotal: user.giftCount,
          isFirstGift
        }
      });
    }

    // 新規メンバーシップ処理
    if (message.newSponsor) {
      this.newMemberCount++;

      if (this.eventSettings.membership?.enabled) {
        events.push({
          type: 'Membership',
          payload: {
            type: 'new',
            levelName: message.memberLevelName || ''
          }
        });
      }
    }

    // メンバーマイルストーン（マイルストーンチャット）処理
    if (message.memberMilestone && this.eventSettings.memberMilestone?.enabled) {
      events.push({
        type: 'MemberMilestone',
        payload: {
          memberMonth: message.memberMilestone.memberMonth,
          memberLevelName: message.memberMilestone.memberLevelName,
          userComment: message.memberMilestone.userComment
        }
      });
    }

    // ロールベースイベント（通常コメント時のみ、スパチャ等は除く）
    if (!message.superchat && !message.membershipGift && !message.newSponsor) {
      // 配信者コメント
      if (message.isOwner && this.eventSettings.ownerComment?.enabled) {
        events.push({
          type: 'OwnerComment',
          payload: {
            message: message.message
          }
        });
      }
      // モデレーターコメント（配信者は除外）
      else if (message.isModerator && !message.isOwner && this.eventSettings.moderatorComment?.enabled) {
        events.push({
          type: 'ModeratorComment',
          payload: {
            message: message.message
          }
        });
      }
      // メンバーコメント（配信者・モデレーターは除外）
      else if (message.isMember && !message.isOwner && !message.isModerator && this.eventSettings.memberComment?.enabled) {
        events.push({
          type: 'MemberComment',
          payload: {
            message: message.message
          }
        });
      }
    }

    return {
      events,
      user,
      isFirstComment
    };
  }

  /**
   * 金額をパース（円換算）
   */
  _parseAmount(superchat) {
    // amountMicrosから計算（1,000,000 = 1通貨単位）
    if (superchat.amountMicros) {
      const micros = parseInt(superchat.amountMicros);
      return Math.round(micros / 1000000);
    }

    // 表示文字列からパース
    if (superchat.amount) {
      const match = superchat.amount.match(/[\d,]+/);
      if (match) {
        return parseInt(match[0].replace(/,/g, ''));
      }
    }

    return 0;
  }

  /**
   * UserContext形式でユーザー情報を取得
   */
  getUserContext(message) {
    const user = this.getUser(message.authorChannelId);
    if (!user) return null;

    return {
      channelId: message.authorChannelId,
      displayName: message.authorName,
      profileImageUrl: message.authorProfileImage || '',
      isOwner: message.isOwner || false,
      isModerator: message.isModerator || false,
      isMember: message.isMember || false,
      session: {
        messageCount: user.messageCount,
        superChatTotal: user.superChatTotal,
        superChatCount: user.superChatCount,
        giftCount: user.giftCount,
        firstSeenAt: user.firstSeenAt
      }
    };
  }

  /**
   * セッション統計を取得
   */
  getStats() {
    let totalMessages = 0;
    let totalSuperChat = 0;
    let totalSuperChatCount = 0;
    let totalGifts = 0;

    for (const user of this.users.values()) {
      totalMessages += user.messageCount;
      totalSuperChat += user.superChatTotal;
      totalSuperChatCount += user.superChatCount;
      totalGifts += user.giftCount;
    }

    return {
      sessionId: this.sessionId,
      liveChatId: this.currentLiveChatId,
      startedAt: this.startedAt,
      uniqueUsers: this.users.size,
      totalMessages,
      totalSuperChat,
      totalSuperChatCount,
      totalGifts,
      totalNewMembers: this.newMemberCount,
      totalMembersWithGifts: this.newMemberCount + totalGifts,
      totalNewViewers: this.newViewerCount,
      youtube: {
        concurrentViewers: this.youtubeStats.concurrentViewers,
        likeCount: this.youtubeStats.likeCount,
        viewCount: this.youtubeStats.viewCount
      },
      customCounters: Object.fromEntries(this.customCounters)
    };
  }

  /**
   * YouTube統計を更新
   * @param {Object} stats - { concurrentViewers, likeCount, viewCount }
   * @returns {Object} 前回との差分情報
   */
  updateYouTubeStats(stats) {
    // 前回値を保存
    this.previousYoutubeStats = { ...this.youtubeStats };

    // 現在値を更新
    this.youtubeStats = {
      concurrentViewers: stats.concurrentViewers || 0,
      likeCount: stats.likeCount || 0,
      viewCount: stats.viewCount || 0,
      lastUpdated: new Date().toISOString()
    };

    console.log('[Session] YouTube統計更新:', this.youtubeStats);

    return {
      current: this.youtubeStats,
      previous: this.previousYoutubeStats
    };
  }

  /**
   * YouTube統計を取得
   */
  getYouTubeStats() {
    return {
      current: { ...this.youtubeStats },
      previous: { ...this.previousYoutubeStats }
    };
  }

  /**
   * カスタムカウンターをインクリメント
   * @param {string} name - カウンター名
   * @param {number} amount - 増加量（デフォルト: 1）
   * @returns {number} 更新後のカウント値
   */
  incrementCounter(name, amount = 1) {
    if (!name) return 0;
    const current = this.customCounters.get(name) || 0;
    const newValue = current + amount;
    this.customCounters.set(name, newValue);
    console.log(`[Session] カウンター更新: ${name} = ${newValue}`);
    return newValue;
  }

  /**
   * カスタムカウンターを取得
   * @param {string} name - カウンター名
   * @returns {number} カウント値
   */
  getCounter(name) {
    return this.customCounters.get(name) || 0;
  }

  /**
   * 全カスタムカウンターを取得
   * @returns {Object} カウンターオブジェクト
   */
  getCustomCounters() {
    return Object.fromEntries(this.customCounters);
  }

  /**
   * グローバルユーザー情報を更新（プライベートメソッド）
   * @param {Object} message - メッセージオブジェクト
   * @param {Object} user - セッションユーザー情報
   * @param {boolean} isFirstComment - セッション内初コメントかどうか
   */
  _updateGlobalUser(message, user, isFirstComment) {
    const channelId = message.authorChannelId;
    if (!channelId) return;

    // スーパーチャット金額を計算
    let superChatAmount = 0;
    let superChatIncrement = 0;
    if (message.superchat) {
      superChatAmount = this._parseAmount(message.superchat);
      superChatIncrement = 1;
    }

    // ギフト数を計算
    let giftIncrement = 0;
    if (message.membershipGift) {
      giftIncrement = message.membershipGift.count || 1;
    }

    // ユーザー情報を更新
    storage.updateGlobalUser(channelId, {
      displayName: message.authorName,
      profileImage: message.authorProfileImage || '',
      isMember: message.isMember || false,
      isModerator: message.isModerator || false,
      isOwner: message.isOwner || false,
      messageIncrement: 1,
      superChatAmount: superChatAmount,
      superChatIncrement: superChatIncrement,
      giftIncrement: giftIncrement,
      newSession: isFirstComment,
      lastMessage: {
        text: message.message || '',
        timestamp: new Date().toISOString()
      }
    });
  }
}
