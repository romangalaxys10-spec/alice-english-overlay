var KEYS = ['enReplies', 'translateBtn', 'chips', 'hideUpsell', 'carryContext', 'modeBar'];
var DEFAULTS = { enReplies: true, translateBtn: true, chips: true, hideUpsell: true, carryContext: true, modeBar: true };

chrome.storage.sync.get(DEFAULTS, function (res) {
  KEYS.forEach(function (k) {
    var el = document.getElementById('t-' + k);
    if (el) el.checked = !!res[k];
  });
});

KEYS.forEach(function (k) {
  var el = document.getElementById('t-' + k);
  if (!el) return;
  el.addEventListener('change', function () {
    var next = {};
    next[k] = el.checked;
    chrome.storage.sync.set(next);
    // keep page localStorage in sync for instant apply
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.indexOf('alice.yandex.ru') > -1) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'aliceEnxSettingsChanged' }).catch(function () {});
      }
    });
  });
});

document.getElementById('open').addEventListener('click', function () {
  chrome.tabs.create({ url: 'https://alice.yandex.ru/' });
});
