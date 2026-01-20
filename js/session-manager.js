/**
 * SessionManager - 配信セッションとユーザー累計情報を管理
 */
class SessionManager {
  constructor() {
    // セッションID（配信ごとにユニーク）
    this.sessionId = this._generateSessionId();

    // ユーザーデータ: channelId -> UserSession
    this.users = new Map();

    // セッション開始時刻
    this.startedAt = new Date().toISOString();

    // セッションレベルのカウンター
    this.newMemberCount = 0;
    this.newViewerCount = 0;  // セッション内の新規視聴者数

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
      superChat: { enabled: true },
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
      superChat: settings.superChat || { enabled: true },
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
   */
  reset() {
    this.sessionId = this._generateSessionId();
    this.users.clear();
    this.startedAt = new Date().toISOString();
    this.newMemberCount = 0;
    this.newViewerCount = 0;

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

    console.log('[Session] 新しいセッション開始:', this.sessionId);
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
      startedAt: this.startedAt,
      newMemberCount: this.newMemberCount,
      newViewerCount: this.newViewerCount,
      users: usersArray
    };
  }

  /**
   * セッションデータをインポート（復元用）
   */
  importData(data) {
    if (!data) return false;

    try {
      this.sessionId = data.sessionId || this._generateSessionId();
      this.startedAt = data.startedAt || new Date().toISOString();
      this.newMemberCount = data.newMemberCount || 0;
      this.newViewerCount = data.newViewerCount || 0;

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

      console.log('[Session] セッション復元:', this.sessionId, `(${this.users.size}ユーザー)`);
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
      }
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
}
