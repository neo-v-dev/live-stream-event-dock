/**
 * サンプルオーバーレイ
 * OBS WebSocket経由でコメントドックからイベントを受信
 */

// DOM要素
const alertContainer = document.getElementById('alert-container');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertBox = document.querySelector('.alert-box');
const eventList = document.getElementById('event-list');

// アラート表示キュー
let alertQueue = [];
let isShowingAlert = false;

// OBS WebSocket接続
let obsSocket = null;
let obsConnected = false;

/**
 * OBS WebSocketに接続
 */
async function connectToOBS() {
  // 設定を取得（localStorageから、またはデフォルト値）
  const settings = JSON.parse(localStorage.getItem('streamManagerSettings') || '{}');
  const address = settings.obsAddress || 'ws://localhost:4455';
  const password = settings.obsPassword || '';

  console.log('[Overlay] OBS WebSocket接続開始:', address);
  addDebugLog('system', { message: `OBS接続中: ${address}` });

  try {
    obsSocket = new WebSocket(address);

    obsSocket.onopen = () => {
      console.log('[Overlay] WebSocket接続成功');
    };

    obsSocket.onclose = () => {
      console.log('[Overlay] WebSocket切断');
      obsConnected = false;
      addDebugLog('system', { message: 'OBS切断 - 5秒後に再接続' });
      // 5秒後に再接続
      setTimeout(connectToOBS, 5000);
    };

    obsSocket.onerror = (err) => {
      console.error('[Overlay] WebSocketエラー:', err);
      addDebugLog('error', { message: 'WebSocketエラー' });
    };

    obsSocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await handleOBSMessage(message, password);
      } catch (e) {
        console.error('[Overlay] メッセージ解析エラー:', e);
      }
    };

  } catch (error) {
    console.error('[Overlay] 接続エラー:', error);
    setTimeout(connectToOBS, 5000);
  }
}

/**
 * OBSメッセージを処理
 */
async function handleOBSMessage(message, password) {
  const { op, d } = message;

  switch (op) {
    case 0: // Hello
      console.log('[Overlay] Hello受信, 認証開始');
      await identify(d, password);
      break;

    case 2: // Identified
      console.log('[Overlay] OBS認証成功');
      obsConnected = true;
      addDebugLog('system', { message: 'OBS接続完了 - イベント待機中' });
      break;

    case 5: // Event
      if (d.eventType === 'CustomEvent') {
        // カスタムイベントを受信
        const eventData = d.eventData;
        console.log('[Overlay] カスタムイベント受信:', eventData);
        handleCustomEvent(eventData);
      }
      break;
  }
}

/**
 * OBS認証
 */
async function identify(helloData, password) {
  const identifyData = {
    rpcVersion: 1,
    eventSubscriptions: 1 // General events (includes CustomEvent)
  };

  // 認証が必要な場合
  if (helloData.authentication && password) {
    identifyData.authentication = await generateAuth(
      password,
      helloData.authentication.salt,
      helloData.authentication.challenge
    );
  }

  sendToOBS(1, identifyData);
}

/**
 * 認証文字列を生成
 */
async function generateAuth(password, salt, challenge) {
  const encoder = new TextEncoder();

  const step1Data = encoder.encode(password + salt);
  const step1Hash = await crypto.subtle.digest('SHA-256', step1Data);
  const step1Base64 = btoa(String.fromCharCode(...new Uint8Array(step1Hash)));

  const step2Data = encoder.encode(step1Base64 + challenge);
  const step2Hash = await crypto.subtle.digest('SHA-256', step2Data);
  const step2Base64 = btoa(String.fromCharCode(...new Uint8Array(step2Hash)));

  return step2Base64;
}

/**
 * OBSにメッセージ送信
 */
function sendToOBS(op, data) {
  if (obsSocket && obsSocket.readyState === WebSocket.OPEN) {
    obsSocket.send(JSON.stringify({ op, d: data }));
  }
}

/**
 * カスタムイベントを処理
 */
function handleCustomEvent(eventData) {
  const { type, payload, timestamp } = eventData;

  // デバッグログに追加
  addDebugLog(type, payload);

  // イベントタイプに応じて処理
  switch (type) {
    case 'alert':
      queueAlert({
        title: payload.title || 'アラート',
        message: payload.message || '',
        icon: payload.icon || '🎉',
        duration: payload.duration || 5000,
        style: 'default'
      });
      break;

    case 'superchat-alert':
      queueAlert({
        title: `${payload.user} さんからスパチャ！`,
        message: `${payload.amount} - ${payload.message || ''}`,
        icon: '💰',
        duration: 8000,
        style: 'superchat'
      });
      break;

    case 'membership-alert':
      queueAlert({
        title: `${payload.user} さんがメンバーになりました！`,
        message: 'ありがとうございます！',
        icon: '⭐',
        duration: 5000,
        style: 'default'
      });
      break;

    case 'custom':
      if (payload.alert) {
        queueAlert(payload.alert);
      }
      break;

    default:
      // 汎用イベント - ユーザー情報を表示
      if (payload.user && payload.message) {
        queueAlert({
          title: payload.user,
          message: payload.message,
          icon: '💬',
          duration: 5000,
          style: 'default'
        });
      } else {
        console.log('未処理のイベント:', type, payload);
      }
  }
}

/**
 * アラートをキューに追加
 */
function queueAlert(alertData) {
  alertQueue.push(alertData);
  processAlertQueue();
}

/**
 * アラートキューを処理
 */
function processAlertQueue() {
  if (isShowingAlert || alertQueue.length === 0) return;

  isShowingAlert = true;
  const alert = alertQueue.shift();
  showAlert(alert);
}

/**
 * アラートを表示
 */
function showAlert(data) {
  const { title, message, icon, duration, style } = data;

  // スタイル設定
  alertBox.className = 'alert-box';
  if (style && style !== 'default') {
    alertBox.classList.add(style);
  }

  // アイコン設定
  const alertIcon = document.querySelector('.alert-icon');
  alertIcon.textContent = icon || '🎉';

  // テキスト設定
  alertTitle.textContent = title || '';
  alertMessage.textContent = message || '';

  // 表示
  alertContainer.classList.remove('hidden');

  // 指定時間後に非表示
  setTimeout(() => {
    hideAlert();
  }, duration || 5000);
}

/**
 * アラートを非表示
 */
function hideAlert() {
  alertBox.classList.add('fadeOut');

  setTimeout(() => {
    alertContainer.classList.add('hidden');
    alertBox.classList.remove('fadeOut');
    isShowingAlert = false;

    // 次のアラートを処理
    processAlertQueue();
  }, 500);
}

/**
 * デバッグログに追加
 */
function addDebugLog(type, payload) {
  const item = document.createElement('div');
  item.className = 'debug-item';
  item.textContent = `[${new Date().toLocaleTimeString()}] ${type}: ${JSON.stringify(payload).substring(0, 100)}`;

  eventList.insertBefore(item, eventList.firstChild);

  // 最大件数制限
  while (eventList.children.length > 20) {
    eventList.removeChild(eventList.lastChild);
  }
}

/**
 * テスト用: 手動でアラートを表示
 */
window.testAlert = function(title = 'テストアラート', message = 'これはテストです') {
  queueAlert({
    title,
    message,
    icon: '🧪',
    duration: 3000,
    style: 'default'
  });
};

// 起動時にOBSに接続
console.log('サンプルオーバーレイ: OBS WebSocket経由でイベント待機...');
connectToOBS();
