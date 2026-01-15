/**
 * OBSWebSocketClient - obs-websocket v5プロトコルの軽量実装
 * ライブラリ不要、純粋なWebSocket APIを使用
 */
class OBSWebSocketClient {
  constructor() {
    this.socket = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.identified = false;

    // コールバック
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
    this.onEvent = null;
  }

  /**
   * OBSに接続
   */
  async connect(url = 'ws://localhost:4455', password = '') {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          console.log('[OBSClient] WebSocket接続成功');
        };

        this.socket.onclose = (event) => {
          console.log('[OBSClient] WebSocket切断:', event.code, event.reason);
          this.identified = false;
          this.onClose?.(event);
        };

        this.socket.onerror = (error) => {
          console.error('[OBSClient] WebSocketエラー:', error);
          this.onError?.(error);
          reject(new Error('WebSocket接続エラー'));
        };

        this.socket.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await this._handleMessage(message, password, resolve, reject);
          } catch (e) {
            console.error('[OBSClient] メッセージ解析エラー:', e);
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * メッセージハンドラ
   */
  async _handleMessage(message, password, resolve, reject) {
    const { op, d } = message;

    switch (op) {
      case 0: // Hello
        console.log('[OBSClient] Hello受信, 認証開始');
        await this._identify(d, password);
        break;

      case 2: // Identified
        console.log('[OBSClient] 認証成功');
        this.identified = true;
        this.onOpen?.();
        resolve({ negotiatedRpcVersion: d.negotiatedRpcVersion });
        break;

      case 5: // Event
        this.onEvent?.(d.eventType, d.eventData);
        break;

      case 7: // RequestResponse
        this._handleRequestResponse(d);
        break;

      case 9: // RequestBatchResponse
        this._handleRequestResponse(d);
        break;
    }
  }

  /**
   * 認証処理
   */
  async _identify(helloData, password) {
    const identifyData = {
      rpcVersion: 1
    };

    // 認証が必要な場合
    if (helloData.authentication && password) {
      const auth = await this._generateAuth(
        password,
        helloData.authentication.salt,
        helloData.authentication.challenge
      );
      identifyData.authentication = auth;
    }

    this._send(1, identifyData); // op 1 = Identify
  }

  /**
   * 認証文字列を生成
   */
  async _generateAuth(password, salt, challenge) {
    // SHA256ハッシュを計算
    const encoder = new TextEncoder();

    // Step 1: password + salt をSHA256
    const step1Data = encoder.encode(password + salt);
    const step1Hash = await crypto.subtle.digest('SHA-256', step1Data);
    const step1Base64 = btoa(String.fromCharCode(...new Uint8Array(step1Hash)));

    // Step 2: step1結果 + challenge をSHA256
    const step2Data = encoder.encode(step1Base64 + challenge);
    const step2Hash = await crypto.subtle.digest('SHA-256', step2Data);
    const step2Base64 = btoa(String.fromCharCode(...new Uint8Array(step2Hash)));

    return step2Base64;
  }

  /**
   * メッセージ送信
   */
  _send(op, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocketが接続されていません');
    }
    this.socket.send(JSON.stringify({ op, d: data }));
  }

  /**
   * リクエストを送信してレスポンスを待つ
   */
  async call(requestType, requestData = {}) {
    if (!this.identified) {
      throw new Error('OBSに認証されていません');
    }

    const requestId = String(this.requestId++);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this._send(6, { // op 6 = Request
        requestType,
        requestId,
        requestData
      });

      // タイムアウト
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`リクエストタイムアウト: ${requestType}`));
        }
      }, 10000);
    });
  }

  /**
   * リクエストレスポンスを処理
   */
  _handleRequestResponse(data) {
    const { requestId, requestStatus, responseData } = data;
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      this.pendingRequests.delete(requestId);

      if (requestStatus.result) {
        pending.resolve(responseData || {});
      } else {
        pending.reject(new Error(requestStatus.comment || `エラーコード: ${requestStatus.code}`));
      }
    }
  }

  /**
   * 切断
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.identified = false;
    this.pendingRequests.clear();
  }

  /**
   * 接続状態
   */
  get connected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN && this.identified;
  }
}

// グローバルに公開
window.OBSWebSocketClient = OBSWebSocketClient;
