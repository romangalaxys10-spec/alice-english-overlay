var KEYS = ['targetLang', 'enReplies', 'translateBtn', 'chips', 'hideUpsell', 'carryContext', 'modeBar', 'customInstructions'];
var DEFAULTS = { targetLang: 'en', enReplies: true, translateBtn: true, chips: true, hideUpsell: true, carryContext: true, modeBar: true, customInstructions: '' };

chrome.storage.sync.get(DEFAULTS, function (res) {
  KEYS.forEach(function (k) {
    var el = document.getElementById('t-' + k);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!res[k];
    else el.value = res[k] || '';
  });
});

function notifyChange(next) {
  chrome.storage.sync.set(next);
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.indexOf('alice.yandex.ru') > -1) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'aliceEnxSettingsChanged' }).catch(function () {});
    }
  });
}

KEYS.forEach(function (k) {
  var el = document.getElementById('t-' + k);
  if (!el) return;
  var evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
  el.addEventListener(evt, function () {
    var next = {};
    next[k] = el.type === 'checkbox' ? el.checked : el.value;
    notifyChange(next);
  });
});

document.getElementById('open').addEventListener('click', function () {
  chrome.tabs.create({ url: 'https://alice.yandex.ru/' });
});
