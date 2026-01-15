/**
 * YouTubeChatCollector - InnerTube APIを使用したライブチャット取得
 * APIキー不要・クォータ制限なし
 * Cloudflare Workersプロキシ経由でCORS回避
 */
class YouTubeChatCollector {
  // プロキシURL（Cloudflare Workersデプロイ後に設定）
  // 例: 'https://youtube-cors-proxy.your-subdomain.workers.dev'
  static PROXY_URL = '';

  constructor() {
    this.continuation = null;
    this.pollingInterval = 3000;  // 3秒間隔
    this.pollingTimer = null;
    this.isRunning = false;
    this.processedIds = new Set();
    this.commentedUsers = new Set();  // コメント済みユーザー（初コメント判定用）

    // API呼び出しカウンター（デバッグ用）
    this.apiCallCount = { page: 0, chat: 0 };

    // InnerTube APIコンテキスト
    this.innertubeContext = {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00'
      }
    };

    // コールバック
    this.onMessage = null;
    this.onError = null;
    this.onStatusChange = null;
  }

  /**
   * プロキシURLを設定
   */
  static setProxyUrl(url) {
    YouTubeChatCollector.PROXY_URL = url;
  }

  /**
   * プロキシ経由でfetch
   */
  async _proxyFetch(url, options = {}) {
    const proxyUrl = YouTubeChatCollector.PROXY_URL;

    if (!proxyUrl) {
      throw new Error('プロキシURLが設定されていません。設定画面でCloudflare WorkersのURLを入力してください。');
    }

    const targetUrl = `${proxyUrl}?url=${encodeURIComponent(url)}`;

    return fetch(targetUrl, options);
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
      // 動画ページからcontinuationトークンを取得
      this.continuation = await this._getInitialContinuation(videoId);
      if (!this.continuation) {
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
    console.log(`[YT] 切断 - API呼び出し統計: page=${this.apiCallCount.page}, chat=${this.apiCallCount.chat}`);
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.continuation = null;
    this.processedIds.clear();
    this.commentedUsers.clear();
    this._setStatus('disconnected');
  }

  /**
   * 動画ページからライブチャットのcontinuationトークンを取得
   */
  async _getInitialContinuation(videoId) {
    this.apiCallCount.page++;
    console.log(`[YT] API呼び出し: ページ取得 (累計: ${this.apiCallCount.page})`);

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const response = await this._proxyFetch(url);
      const html = await response.text();

      // ytInitialDataからcontinuationを抽出
      const match = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/);
      if (!match) {
        throw new Error('動画データを取得できませんでした');
      }

      const data = JSON.parse(match[1]);

      // ライブチャットのcontinuationを探す
      const continuation = this._findLiveChatContinuation(data);
      return continuation;
    } catch (error) {
      console.error('初期データ取得エラー:', error);
      throw error;
    }
  }

  /**
   * ytInitialDataからライブチャットのcontinuationを探す
   */
  _findLiveChatContinuation(data) {
    try {
      // 方法1: conversationBarからの取得を試行
      const conversationBar = data?.contents?.twoColumnWatchNextResults?.conversationBar;
      if (conversationBar?.liveChatRenderer?.continuations) {
        const cont = conversationBar.liveChatRenderer.continuations[0];
        return cont?.reloadContinuationData?.continuation ||
               cont?.invalidationContinuationData?.continuation ||
               cont?.timedContinuationData?.continuation;
      }

      // 方法2: フレームワークのupdatesから取得
      const frameworkUpdates = data?.frameworkUpdates?.entityBatchUpdate?.mutations;
      if (frameworkUpdates) {
        for (const mutation of frameworkUpdates) {
          const payload = mutation?.payload?.liveChatRenderer?.continuations?.[0];
          if (payload) {
            return payload?.reloadContinuationData?.continuation ||
                   payload?.invalidationContinuationData?.continuation;
          }
        }
      }

      return null;
    } catch (e) {
      console.error('Continuation探索エラー:', e);
      return null;
    }
  }

  /**
   * InnerTube APIでチャットメッセージを取得
   */
  async _fetchMessages() {
    if (!this.continuation || !this.isRunning) return [];

    this.apiCallCount.chat++;
    console.log(`[YT] API呼び出し: live_chat/get_live_chat (累計: ${this.apiCallCount.chat})`);

    const url = 'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?prettyPrint=false';

    try {
      const response = await this._proxyFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: this.innertubeContext,
          continuation: this.continuation
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'InnerTube API エラー');
      }

      // 次のcontinuationを更新
      const continuations = data?.continuationContents?.liveChatContinuation?.continuations;
      if (continuations && continuations.length > 0) {
        const cont = continuations[0];
        this.continuation = cont?.invalidationContinuationData?.continuation ||
                           cont?.timedContinuationData?.continuation ||
                           cont?.reloadContinuationData?.continuation;

        // ポーリング間隔を更新（timedContinuationDataにtimeoutMsがある場合）
        if (cont?.timedContinuationData?.timeoutMs) {
          this.pollingInterval = Math.max(cont.timedContinuationData.timeoutMs, 1000);
        }
      }

      // チャットアクションを取得
      const actions = data?.continuationContents?.liveChatContinuation?.actions || [];
      const newMessages = [];

      for (const action of actions) {
        const item = action?.addChatItemAction?.item;
        if (!item) continue;

        const msg = this._parseMessage(item);
        if (msg && !this.processedIds.has(msg.id)) {
          this.processedIds.add(msg.id);
          newMessages.push(msg);
        }
      }

      // メモリリーク防止
      if (this.processedIds.size > 1000) {
        const idsArray = Array.from(this.processedIds);
        this.processedIds = new Set(idsArray.slice(-500));
      }

      console.log(`[YT] 取得: ${newMessages.length}件の新規メッセージ, 次回ポーリング: ${this.pollingInterval}ms`);
      return newMessages;

    } catch (error) {
      console.error('チャット取得エラー:', error);

      // 配信終了の可能性
      if (error.message?.includes('not found') || error.message?.includes('ended')) {
        this.disconnect();
        this.onError?.(new Error('配信が終了したか、チャットが利用できません'));
      } else {
        this.onError?.(error);
      }
      return [];
    }
  }

  /**
   * チャットアイテムをパース
   */
  _parseMessage(item) {
    // 通常のテキストメッセージ
    if (item.liveChatTextMessageRenderer) {
      return this._parseTextMessage(item.liveChatTextMessageRenderer);
    }

    // スーパーチャット
    if (item.liveChatPaidMessageRenderer) {
      return this._parsePaidMessage(item.liveChatPaidMessageRenderer);
    }

    // スーパーステッカー
    if (item.liveChatPaidStickerRenderer) {
      return this._parsePaidSticker(item.liveChatPaidStickerRenderer);
    }

    // 新規メンバー
    if (item.liveChatMembershipItemRenderer) {
      return this._parseMembershipItem(item.liveChatMembershipItemRenderer);
    }

    // メンバーシップギフト購入
    if (item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
      return this._parseMembershipGift(item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer);
    }

    // メンバーシップギフト受領
    if (item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
      return this._parseGiftRedemption(item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer);
    }

    return null;
  }

  /**
   * 通常テキストメッセージをパース
   */
  _parseTextMessage(renderer) {
    const channelId = renderer.authorExternalChannelId || '';
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    return {
      id: renderer.id,
      type: 'textMessageEvent',
      authorName: renderer.authorName?.simpleText || '',
      authorChannelId: channelId,
      authorProfileImage: renderer.authorPhoto?.thumbnails?.[0]?.url || '',
      message: this._extractMessageText(renderer.message),
      timestamp: new Date(parseInt(renderer.timestampUsec) / 1000),
      isOwner: renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.icon?.iconType === 'OWNER') || false,
      isModerator: renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.icon?.iconType === 'MODERATOR') || false,
      isMember: renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.customThumbnail) || false,
      isFirstComment: isFirstComment,
      superchat: null,
      membershipGift: null,
      newSponsor: false
    };
  }

  /**
   * スーパーチャットをパース
   */
  _parsePaidMessage(renderer) {
    const channelId = renderer.authorExternalChannelId || '';
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    // 金額をパース (例: "¥500", "$5.00")
    const amountText = renderer.purchaseAmountText?.simpleText || '';
    const amountMatch = amountText.match(/[\d,]+\.?\d*/);
    const amountValue = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
    const currency = amountText.replace(/[\d,.\s]+/g, '').trim() || 'JPY';

    return {
      id: renderer.id,
      type: 'superChatEvent',
      authorName: renderer.authorName?.simpleText || '',
      authorChannelId: channelId,
      authorProfileImage: renderer.authorPhoto?.thumbnails?.[0]?.url || '',
      message: this._extractMessageText(renderer.message),
      timestamp: new Date(parseInt(renderer.timestampUsec) / 1000),
      isOwner: false,
      isModerator: false,
      isMember: renderer.authorBadges?.some(b => b.liveChatAuthorBadgeRenderer?.customThumbnail) || false,
      isFirstComment: isFirstComment,
      superchat: {
        amount: amountText,
        amountMicros: String(Math.round(amountValue * 1000000)),
        currency: currency,
        tier: this._getSuperchatTier(renderer.headerBackgroundColor)
      },
      membershipGift: null,
      newSponsor: false
    };
  }

  /**
   * スーパーステッカーをパース
   */
  _parsePaidSticker(renderer) {
    const channelId = renderer.authorExternalChannelId || '';
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    const amountText = renderer.purchaseAmountText?.simpleText || '';
    const amountMatch = amountText.match(/[\d,]+\.?\d*/);
    const amountValue = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
    const currency = amountText.replace(/[\d,.\s]+/g, '').trim() || 'JPY';

    return {
      id: renderer.id,
      type: 'superStickerEvent',
      authorName: renderer.authorName?.simpleText || '',
      authorChannelId: channelId,
      authorProfileImage: renderer.authorPhoto?.thumbnails?.[0]?.url || '',
      message: renderer.sticker?.accessibility?.accessibilityData?.label || '(スタンプ)',
      timestamp: new Date(parseInt(renderer.timestampUsec) / 1000),
      isOwner: false,
      isModerator: false,
      isMember: false,
      isFirstComment: isFirstComment,
      superchat: {
        amount: amountText,
        amountMicros: String(Math.round(amountValue * 1000000)),
        currency: currency,
        tier: this._getSuperchatTier(renderer.backgroundColor)
      },
      membershipGift: null,
      newSponsor: false
    };
  }

  /**
   * 新規メンバーをパース
   */
  _parseMembershipItem(renderer) {
    const channelId = renderer.authorExternalChannelId || '';
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    return {
      id: renderer.id,
      type: 'newSponsorEvent',
      authorName: renderer.authorName?.simpleText || '',
      authorChannelId: channelId,
      authorProfileImage: renderer.authorPhoto?.thumbnails?.[0]?.url || '',
      message: this._extractMessageText(renderer.headerSubtext) || '新規メンバー',
      timestamp: new Date(parseInt(renderer.timestampUsec) / 1000),
      isOwner: false,
      isModerator: false,
      isMember: true,
      isFirstComment: isFirstComment,
      superchat: null,
      membershipGift: null,
      newSponsor: true
    };
  }

  /**
   * メンバーシップギフト購入をパース
   */
  _parseMembershipGift(renderer) {
    const header = renderer.header?.liveChatSponsorshipsHeaderRenderer;
    const channelId = header?.authorExternalChannelId || '';
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    // ギフト数を抽出
    const primaryText = header?.primaryText?.runs?.map(r => r.text).join('') || '';
    const giftMatch = primaryText.match(/(\d+)/);
    const giftCount = giftMatch ? parseInt(giftMatch[1]) : 1;

    return {
      id: renderer.id || `gift_${Date.now()}`,
      type: 'membershipGiftingEvent',
      authorName: header?.authorName?.simpleText || '',
      authorChannelId: channelId,
      authorProfileImage: header?.authorPhoto?.thumbnails?.[0]?.url || '',
      message: primaryText,
      timestamp: new Date(),
      isOwner: false,
      isModerator: false,
      isMember: true,
      isFirstComment: isFirstComment,
      superchat: null,
      membershipGift: {
        count: giftCount
      },
      newSponsor: false
    };
  }

  /**
   * メンバーシップギフト受領をパース
   */
  _parseGiftRedemption(renderer) {
    const channelId = renderer.authorExternalChannelId || '';
    const isFirstComment = channelId && !this.commentedUsers.has(channelId);
    if (channelId) {
      this.commentedUsers.add(channelId);
    }

    return {
      id: renderer.id,
      type: 'giftRedemptionEvent',
      authorName: renderer.authorName?.simpleText || '',
      authorChannelId: channelId,
      authorProfileImage: renderer.authorPhoto?.thumbnails?.[0]?.url || '',
      message: this._extractMessageText(renderer.message) || 'メンバーシップギフトを受け取りました',
      timestamp: new Date(parseInt(renderer.timestampUsec) / 1000),
      isOwner: false,
      isModerator: false,
      isMember: true,
      isFirstComment: isFirstComment,
      superchat: null,
      membershipGift: null,
      newSponsor: true
    };
  }

  /**
   * メッセージオブジェクトからテキストを抽出
   */
  _extractMessageText(message) {
    if (!message) return '';

    if (message.simpleText) {
      return message.simpleText;
    }

    if (message.runs) {
      return message.runs.map(run => {
        if (run.text) return run.text;
        if (run.emoji) return run.emoji.shortcuts?.[0] || run.emoji.emojiId || '';
        return '';
      }).join('');
    }

    return '';
  }

  /**
   * スーパーチャットのティアを背景色から推定
   */
  _getSuperchatTier(color) {
    if (!color) return 1;

    // YouTubeのスパチャ色に基づくティア
    // 青(1) → 水色(2) → 緑(3) → 黄(4) → オレンジ(5) → マゼンタ(6) → 赤(7)
    const tierColors = {
      4280191205: 1,  // 青
      4278248959: 2,  // 水色
      4278239141: 3,  // 緑
      4294947584: 4,  // 黄
      4293284096: 5,  // オレンジ
      4290910299: 6,  // マゼンタ
      4291821568: 7   // 赤
    };

    return tierColors[color] || 1;
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

  // 互換性のためのダミーメソッド（APIキーは不要）
  setApiKey(apiKey) {
    console.log('[YT] InnerTube APIを使用中 - APIキーは不要です');
  }
}
