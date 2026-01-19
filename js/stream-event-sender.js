/**
 * StreamEventSender - Live Stream Event APIでイベントを送信
 */
class StreamEventSender {
  /**
   * @param {OBSController} obsController
   * @param {SessionManager} sessionManager
   */
  constructor(obsController, sessionManager) {
    this.obsController = obsController;
    this.sessionManager = sessionManager;

    // 設定
    this.config = {
      eventName: 'LiveStreamEvent',
      includeOriginal: false,
      enabled: true
    };
  }

  /**
   * 設定を適用（storage.loadEventSettings()の結果を受け取る）
   */
  applySettings(eventSettings) {
    // 全体設定を適用
    this.config.enabled = eventSettings.enabled !== false;
    this.config.eventName = eventSettings.eventName || 'LiveStreamEvent';
    this.config.includeOriginal = eventSettings.includeOriginal || false;

    // SessionManagerにも設定を渡す
    this.sessionManager.setEventSettings(eventSettings);

    console.log('[StreamEvent] 設定適用:', this.config);
  }

  /**
   * チャットメッセージを処理してイベントを送信
   * @param {Object} message 内部形式のチャットメッセージ
   */
  async processAndSend(message) {
    if (!this.config.enabled) return;
    if (!this.obsController.connected) return;

    // 通常コメント転送（スパチャ等は除く）
    if (this.sessionManager.eventSettings.forwardComments?.enabled) {
      if (!message.superchat && !message.membershipGift && !message.newSponsor) {
        await this.sendCommentEvent(message);
      }
    }

    // セッションマネージャーでイベントを検出
    const result = this.sessionManager.processMessage(message);

    // 検出されたイベントを送信
    for (const event of result.events) {
      await this.sendEvent(event.type, event.payload, message);
    }

    // スパチャまたはギフト時にセッション統計を送信
    if (message.superchat || message.membershipGift) {
      if (this.sessionManager.eventSettings.sessionStats?.enabled) {
        await this.sendSessionStats();
      }
    }

    return result;
  }

  /**
   * セッション統計イベントを送信（5秒毎 + スパチャ/ギフト時）
   */
  async sendSessionStats() {
    if (!this.config.enabled) return false;
    if (!this.sessionManager.eventSettings.sessionStats?.enabled) return false;

    const stats = this.sessionManager.getStats();

    return this.sendEvent('SessionStats', {
      superChatTotal: stats.totalSuperChat,
      giftTotal: stats.totalGifts,
      newMemberTotal: stats.totalNewMembers,
      uniqueUsers: stats.uniqueUsers,
      totalMessages: stats.totalMessages,
      youtube: stats.youtube
    });
  }

  /**
   * 通常コメントを転送
   */
  async sendCommentEvent(message) {
    return this.sendEvent('Comment', {
      message: message.message
    }, message);
  }

  /**
   * イベントを送信
   */
  async sendEvent(type, payload, originalMessage = null) {
    if (!this.obsController.connected || !this.obsController.obs) {
      console.warn('[StreamEvent] OBS未接続のためイベント送信スキップ');
      return false;
    }

    const userContext = originalMessage
      ? this.sessionManager.getUserContext(originalMessage)
      : null;

    const eventData = {
      type,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionManager.sessionId,
      user: userContext,
      payload
    };

    // 元メッセージを含める場合
    if (this.config.includeOriginal && originalMessage) {
      eventData.original = originalMessage;
    }

    try {
      await this.obsController.obs.call('BroadcastCustomEvent', {
        eventData: {
          eventName: this.config.eventName,
          eventData
        }
      });
      console.log(`[StreamEvent] 送信: ${type}`, payload);
      return true;
    } catch (error) {
      console.error('[StreamEvent] 送信エラー:', error);
      return false;
    }
  }

  /**
   * カスタムイベントを送信（ルールから呼び出し）
   */
  async sendCustomEvent(customEventType, ruleId, ruleName, message, customData = null) {
    const payload = {
      eventType: customEventType,
      ruleId,
      ruleName,
      message: message.message
    };

    if (customData) {
      payload.customData = customData;
    }

    return this.sendEvent('Custom', payload, message);
  }

  /**
   * 設定を更新
   */
  configure(config) {
    Object.assign(this.config, config);
  }

  /**
   * 有効/無効を切り替え
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    console.log('[StreamEvent]', enabled ? '有効' : '無効');
  }
}
