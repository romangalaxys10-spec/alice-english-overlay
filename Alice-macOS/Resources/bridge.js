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

  // Pending translation callbacks
  var callbacks = {};

  window.__aliceNativeCallback = function (id, ok, text, error) {
    var cb = callbacks[id];
    if (cb) {
      delete callbacks[id];
      try {
        if (ok) {
          cb({ ok: true, text: text });
        } else {
          cb({ ok: false, error: error || 'Translation failed' });
        }
      } catch (err) {
        console.error('[AliceNativeBridge] Callback error:', err);
      }
    }
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
        window.webkit.messageHandlers.aliceBridge.postMessage({
          type: 'translate',
          id: reqId,
          text: msg.text || ''
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
