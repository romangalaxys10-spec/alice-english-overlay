/* Alice English Overlay — MV3 background: machine-translation proxy (page CSP blocks direct fetch) */
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'aliceEnxTranslate') return;
  translateText(msg.text).then(
    function (t) { sendResponse({ ok: true, text: t }); },
    function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
  );
  return true; // async
});

function gtx(text) {
  var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(text);
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('gtx HTTP ' + r.status);
    return r.json();
  }).then(function (data) {
    if (!data || !data[0]) throw new Error('bad gtx payload');
    return data[0].map(function (seg) { return seg && seg[0] ? seg[0] : ''; }).join('');
  });
}

function myMemoryAll(text) {
  var chunks = [];
  var rest = String(text);
  while (rest.length) {
    var cut = Math.min(480, rest.length);
    if (cut < rest.length) {
      for (var p = cut; p > 200; p--) {
        var ch = rest[p];
        if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') { cut = p + 1; break; }
      }
    }
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return Promise.all(chunks.map(function (chunk) {
    var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(chunk) + '&langpair=ru|en';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.responseData && j.responseData.translatedText && j.responseStatus === 200 && !/MYMEMORY WARNING/i.test(j.responseData.translatedText)) {
        return j.responseData.translatedText;
      }
      throw new Error('mymemory failed');
    });
  })).then(function (parts) { return parts.join(' ').replace(/\s+/g, ' ').trim(); });
}

function translateText(text) {
  text = String(text || '').trim();
  if (!text) return Promise.resolve('');
  return gtx(text).catch(function () { return myMemoryAll(text); });
}
