/**
 * YouTubeChatCollector - YouTube Data API v3を使用したライブチャット取得
 */
class YouTubeChatCollector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.liveChatId = null;
    this.nextPageToken = null;
    this.pollingInterval = 10000;  // 最小10秒
    this.minPollingInterval = 10000;  // 最小間隔
    this.pollingTimer = null;
    this.isRunning = false;
    this.processedIds = new Set();
    this.channelNameCache = new Map();  // チャンネル名キャッシュ
    this.commentedUsers = new Set();    // コメント済みユーザー（初コメント判定用）

    // API呼び出しカウンター（デバッグ用）
    this.apiCallCount = { videos: 0, messages: 0, channels: 0 };

    // コールバック
    this.onMessage = null;
    this.onError = null;
    this.onStatusChange = null;
  }

  /**
   * APIキーを設定
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * 動画URLまたはIDからビデオIDを抽出
   */
  extractVideoId(input) {
    if (!input) return null;

    // 既にビデオIDの場合
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }

    // URLから抽出
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * 配信に接続
   */
  async connect(videoIdOrUrl) {
    if (this.isRunning) {
      await this.disconnect();
    }

    const videoId = this.extractVideoId(videoIdOrUrl);
    if (!videoId) {
      throw new Error('無効な動画URLまたはIDです');
    }

    this._setStatus('connecting');

    try {
      // liveChatIdを取得
      this.liveChatId = await this._getLiveChatId(videoId);
      if (!this.liveChatId) {
        throw new Error('ライブ配信が見つかりません。配信中の動画URLを指定してください。');
      }

      // ポーリング開始
      this.isRunning = true;
      this._setStatus('connected');
      this._startPolling();

      return true;
    } catch (error) {
      this._setStatus('error');
      throw error;
    }
  }

  /**
   * 切断
   */
  async disconnect() {
    console.log(`[YT] 切断 - API呼び出し統計: videos=${this.apiCallCount.videos}, messages=${this.apiCallCount.messages}, channels=${this.apiCallCount.channels}`);
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.liveChatId = null;
    this.nextPageToken = null;
    this.processedIds.clear();
    this.commentedUsers.clear();  // 初コメント判定をリセット
    // チャンネル名キャッシュは保持（再接続時に再利用）
    // APIカウンターもリセットしない（累計を確認するため）
    this._setStatus('disconnected');
  }

  /**
   * チャンネルIDからチャンネル名を取得（バッチ対応）
   */
  async _fetchChannelNames(channelIds) {
    // キャッシュにないIDのみ取得
    const uncachedIds = channelIds.filter(id => !this.channelNameCache.has(id));
    if (uncachedIds.length === 0) return;

    // 最大50件ずつ取得（API制限）
    const batchSize = 50;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      const ids = batch.join(',');

      try {
        this.apiCallCount.channels++;
        console.log(`[YT] API呼び出し: channels.list (${batch.length}件, 累計: ${this.apiCallCount.channels})`);

        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${ids}&key=${this.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.items) {
          for (const item of data.items) {
            this.channelNameCache.set(item.id, item.snippet.title);
          }
        }
      } catch (error) {
        console.error('チャンネル名取得エラー:', error);
      }
    }

    // キャッシュサイズ制限（メモリリーク防止）
    if (this.channelNameCache.size > 500) {
      const entries = Array.from(this.channelNameCache.entries());
      this.channelNameCache = new Map(entries.slice(-250));
    }
  }

  /**
   * ビデオIDからliveChatIdを取得
   */
  async _getLiveChatId(videoId) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${this.apiKey}`;

    this.apiCallCount.videos++;
    console.log(`[YT] API呼び出し: videos.list (累計: ${this.apiCallCount.videos})`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'YouTube API エラー');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('動画が見つかりません');
    }

    return data.items[0]?.liveStreamingDetails?.activeLiveChatId || null;
  }

  /**
   * チャットメッセージを取得
   */
  async _fetchMessages() {
    if (!this.liveChatId || !this.isRunning) return [];

    let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${this.liveChatId}&part=snippet,authorDetails&key=${this.apiKey}`;
    if (this.nextPageToken) {
      url += `&pageToken=${this.nextPageToken}`;
    }

    try {
      this.apiCallCount.messages++;
      console.log(`[YT] API呼び出し: liveChat/messages.list (累計: ${this.apiCallCount.messages})`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        // 配信終了などのエラー
        if (data.error.code === 403 || data.error.code === 404) {
          this.disconnect();
          this.onError?.(new Error('配信が終了したか、チャットが利用できません'));
        }
        throw new Error(data.error.message || 'YouTube API エラー');
      }

      this.nextPageToken = data.nextPageToken;
      // APIの推奨間隔と最小間隔の大きい方を採用
      const apiInterval = data.pollingIntervalMillis || 10000;
      this.pollingInterval = Math.max(apiInterval, this.minPollingInterval);
      console.log(`[YT] ポーリング間隔: API推奨=${apiInterval}ms, 実際=${this.pollingInterval}ms, 次回予定=${new Date(Date.now() + this.pollingInterval).toLocaleTimeString()}`);

      // 新しいメッセージのみを返す
      const newMessages = [];
      const channelIdsToFetch = [];

      for (const item of data.items || []) {
        if (!this.processedIds.has(item.id)) {
          this.processedIds.add(item.id);
          const msg = this._parseMessage(item);
          newMessages.push(msg);

          // キャッシュにないチャンネルIDを収集
          if (msg.authorChannelId && !this.channelNameCache.has(msg.authorChannelId)) {
            channelIdsToFetch.push(msg.authorChannelId);
          }
        }
      }

      // チャンネル名を一括取得
      if (channelIdsToFetch.length > 0) {
        await this._fetchChannelNames(channelIdsToFetch);
      }

      // キャッシュからチャンネル名を適用
      for (const msg of newMessages) {
        if (msg.authorChannelId && this.channelNameCache.has(msg.authorChannelId)) {
          msg.authorName = this.channelNameCache.get(msg.authorChannelId);
        }
      }

      // メモリリーク防止: 古いIDを削除
      if (this.processedIds.size > 1000) {
        const idsArray = Array.from(this.processedIds);
        this.processedIds = new Set(idsArray.slice(-500));
      }

      return newMessages;
    } catch (error) {
      console.error('チャット取得エラー:', error);
      this.onError?.(error);
      return [];
    }
  }

  /**
   * APIレスポンスをパース
   */
  _parseMessage(item) {
    const snippet = item.snippet || {};
    const authorDetails = item.authorDetails || {};
    const type = snippet.type || 'textMessageEvent';
    const channelId = authorDetails.channelId || '';

    // 初コメント判定
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    const message = {
      id: item.id,
      type: type,
      authorName: authorDetails.displayName || '',
      authorChannelId: channelId,
      authorProfileImage: authorDetails.profileImageUrl || '',
      message: snippet.displayMessage || '',
      timestamp: new Date(snippet.publishedAt),
      isOwner: authorDetails.isChatOwner || false,
      isModerator: authorDetails.isChatModerator || false,
      isMember: authorDetails.isChatSponsor || false,
      isFirstComment: isFirstComment,  // 初コメントフラグ
      superchat: null,
      membershipGift: null,
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

    return message;
  }

  /**
   * ポーリング開始
   */
  _startPolling() {
    console.log(`[YT] ポーリング開始 (初期間隔: ${this.pollingInterval}ms)`);
    let pollCount = 0;
    const startTime = Date.now();

    const poll = async () => {
      if (!this.isRunning) return;

      pollCount++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[YT] ポーリング実行 #${pollCount} (経過時間: ${elapsed}秒)`);

      const messages = await this._fetchMessages();
      for (const msg of messages) {
        this.onMessage?.(msg);
      }

      // 次のポーリングをスケジュール
      if (this.isRunning) {
        this.pollingTimer = setTimeout(poll, this.pollingInterval);
      }
    };

    poll();
  }

  /**
   * API呼び出し統計を取得
   */
  getApiCallStats() {
    return { ...this.apiCallCount };
  }

  /**
   * ステータス変更通知
   */
  _setStatus(status) {
    this.onStatusChange?.(status);
  }
}
