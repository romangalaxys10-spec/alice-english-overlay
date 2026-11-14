/* Alice AI — Native macOS WebKit Bridge */
(function () {
  'use strict';
  if (window.__ALICE_NATIVE_BRIDGE_INSTALLED) return;
  window.__ALICE_NATIVE_BRIDGE_INSTALLED = true;
  window.__ALICE_MAC_APP = true;

  // Initialize default settings in localStorage if missing
  var DEFAULTS = {
    enReplies: true,
    translateBtn: true,
    chips: true,
    hideUpsell: true,
    carryContext: true,
    modeBar: true
  };
  try {
    var raw = localStorage.getItem('aliceEnxSettings');
    if (!raw) {
      localStorage.setItem('aliceEnxSettings', JSON.stringify(DEFAULTS));
    }
  } catch (e) {}

  // Pending native callbacks
  var callbacks = {};

  window.__aliceNativeCallback = function (id, ok, data, error) {
    var cb = callbacks[id];
    if (cb) {
      delete callbacks[id];
      try {
        if (ok) {
          cb({ ok: true, data: data, text: typeof data === 'string' ? data : (data && data.text) });
        } else {
          cb({ ok: false, error: error || 'Action failed', data: data });
        }
      } catch (err) {
        console.error('[AliceNativeBridge] Callback error:', err);
      }
    }
  };

  function sendNative(type, payload, callback) {
    var reqId = type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    if (typeof callback === 'function') {
      callbacks[reqId] = callback;
    }
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.aliceBridge) {
      var msg = Object.assign({ type: type, id: reqId }, payload || {});
      window.webkit.messageHandlers.aliceBridge.postMessage(msg);
    } else if (typeof callback === 'function') {
      callback({ ok: false, error: 'Native bridge unavailable in this environment' });
    }
  }

  window.__aliceTerminalRun = function (command, cwd, callback) {
    sendNative('terminalRun', { command: command, cwd: cwd }, callback);
  };
  window.__aliceReadFile = function (path, callback) {
    sendNative('readFile', { path: path }, callback);
  };
  window.__aliceWriteFile = function (path, content, callback) {
    sendNative('writeFile', { path: path, content: content }, callback);
  };
  window.__aliceGitSync = function (message, callback) {
    sendNative('gitSync', { message: message }, callback);
  };
  window.__aliceComputerUse = function (action, params, callback) {
    sendNative('computerUse', { action: action, params: params }, callback);
  };

  window.__aliceGetSystemInfo = function (callback) {
    sendNative('computerUse', { action: 'getSystemInfo' }, callback);
  };
  window.__ALICE_SYSTEM_INFO = null;
  window.__aliceGetSystemInfo(function (res) {
    if (res && res.ok && res.data) {
      window.__ALICE_SYSTEM_INFO = res.data;
    }
  });

  window.__aliceHarness = {
    isAvailable: true,
    run: window.__aliceTerminalRun,
    read: window.__aliceReadFile,
    write: window.__aliceWriteFile,
    gitSync: window.__aliceGitSync,
    computer: window.__aliceComputerUse,
    getSystemInfo: window.__aliceGetSystemInfo
  };

  // Polyfill Chrome Extension runtime API for content.js
  window.chrome = window.chrome || {};
  window.chrome.runtime = window.chrome.runtime || {};
  window.chrome.runtime.id = 'alice-native-osx';

  window.chrome.runtime.sendMessage = function (msg, callback) {
    if (!msg) return;
    if (msg.type === 'aliceEnxTranslate') {
      var reqId = 'tr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      if (typeof callback === 'function') {
        callbacks[reqId] = callback;
      }
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.aliceBridge) {
        var lang = msg.targetLang || (window.__ALICE_ENX && window.__ALICE_ENX.settings && window.__ALICE_ENX.settings.targetLang) || 'en';
        window.webkit.messageHandlers.aliceBridge.postMessage({
          type: 'translate',
          id: reqId,
          text: msg.text || '',
          targetLang: lang
        });
      } else if (typeof callback === 'function') {
        callback({ ok: false, error: 'Bridge not available' });
      }
    }
  };

  // Apply settings from native macOS preferences window
  window.__aliceApplySettings = function (newSettings) {
    try {
      if (window.__ALICE_ENX && typeof window.__ALICE_ENX.applySettings === 'function') {
        window.__ALICE_ENX.applySettings(newSettings);
      } else {
        localStorage.setItem('aliceEnxSettings', JSON.stringify(newSettings));
      }
    } catch (e) {
      console.error('[AliceNativeBridge] Apply settings error:', e);
    }
  };

  // Helper to switch modes from native macOS toolbar or menus
  window.__aliceSetMode = function (mode) {
    try {
      if (mode === 'newChat') {
        var newBtn = document.querySelector('[data-testid="chat-list-new-chat-button"], button[aria-label="Новый чат"], button[aria-label="New chat"]');
        if (newBtn) {
          newBtn.click();
        } else {
          window.location.href = 'https://alice.yandex.ru/';
        }
        return;
      }

      // Check if mode bar pill exists
      var pill = document.querySelector('[data-alice-enx-pill="' + mode + '"]');
      if (pill) {
        pill.click();
        return;
      }

      // Fallback: trigger dropdown
      if (mode === 'auto' || mode === 'expert') {
        var trig = document.querySelector('button[aria-label="Выбор режима интеллекта Алисы"], button[aria-label*="режима интеллекта"], button[aria-label="Choose Alice\'s intelligence mode"]');
        if (trig) {
          trig.click();
          setTimeout(function () {
            var items = Array.prototype.slice.call(document.querySelectorAll('[role="menuitem"],[role="option"]'));
            for (var i = 0; i < items.length; i++) {
              var txt = (items[i].textContent || '').trim();
              if (mode === 'auto' && /^(Авто|Auto)/i.test(txt)) { items[i].click(); break; }
              if (mode === 'expert' && /^(Эксперт|Expert)/i.test(txt)) { items[i].click(); break; }
            }
          }, 80);
        }
      }
    } catch (e) {
      console.error('[AliceNativeBridge] Set mode error:', e);
    }
  };
})();
