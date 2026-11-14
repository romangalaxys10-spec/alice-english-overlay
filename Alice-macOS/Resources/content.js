/* Alice English Overlay — Part A: settings, dictionary, translator, machine translation */
(function () {
  'use strict';
  if (window.__ALICE_ENX) return;

  var A = { version: '1.0.0' };

  /* ---------------- environment ---------------- */
  var GMX = null;
  try {
    if (typeof GM !== 'undefined' && GM.xmlHttpRequest) GMX = GM.xmlHttpRequest;
    else if (typeof GM_xmlhttpRequest !== 'undefined') GMX = GM_xmlhttpRequest;
  } catch (e) {}
  var EXT = false;
  try { EXT = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage); } catch (e) {}
  var HAS_SYNC = false;
  try { HAS_SYNC = EXT && !!(chrome.storage && chrome.storage.sync); } catch (e) {}

  /* ---------------- settings ---------------- */
  var DEFAULTS = {
    enReplies: true,      // silently append "Please answer in English."
    translateBtn: true,   // "EN" machine-translation button on Alice's replies
    chips: true,          // English starter prompt cards
    hideUpsell: true,     // hide login / Pro banners
    carryContext: true,   // attach a recap when opening a new chat
    modeBar: true         // chat.z.ai-like mode bar
  };
  var settings = Object.assign({}, DEFAULTS);
  var listeners = [];

  function onSettings(fn) { listeners.push(fn); }
  function applySettings(next) {
    settings = Object.assign({}, DEFAULTS, settings, next || {});
    try { localStorage.setItem('aliceEnxSettings', JSON.stringify(settings)); } catch (e) {}
    if (HAS_SYNC) { try { chrome.storage.sync.set(settings); } catch (e) {} }
    listeners.forEach(function (fn) { try { fn(settings); } catch (e) {} });
  }
  function loadSettings() {
    var local = {};
    try { local = JSON.parse(localStorage.getItem('aliceEnxSettings') || '{}') || {}; } catch (e) {}
    Object.assign(settings, DEFAULTS, local);
    if (HAS_SYNC) {
      chrome.storage.sync.get(DEFAULTS, function (res) {
        Object.assign(settings, DEFAULTS, res);
        listeners.forEach(function (fn) { try { fn(settings); } catch (e) {} });
      });
      try {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area !== 'sync') return;
          var next = {};
          Object.keys(changes).forEach(function (k) { next[k] = changes[k].newValue; });
          Object.assign(settings, DEFAULTS, next);
          listeners.forEach(function (fn) { try { fn(settings); } catch (e) {} });
        });
      } catch (e) {}
    }
  }
  loadSettings();

  /* ---------------- helpers ---------------- */
  var CYR = /[\u0400-\u04FF]/;
  function norm(s) {
    return String(s).replace(/\u00a0/g, ' ').replace(/[\s\u200b]+/g, ' ').trim();
  }

  /* ---------------- dictionary (RU -> EN) ---------------- */
  var EXACT = {
    // header / sidebar
    'Войти': 'Log in', 'Войдите': 'Log in', 'Войти с Яндекс ID': 'Log in with Yandex ID',
    'Яндекс ID': 'Yandex ID', 'Новый чат': 'New chat', 'Новая задача': 'New task',
    'Настройки': 'Settings', 'Студия': 'Studio', 'Для учёбы': 'For studies',
    'Проекты': 'Projects', 'Персонажи': 'Characters', 'Персонаж': 'Character',
    'Моя память': 'My memory', 'Лайфлог': 'Lifelog', 'Брони': 'Bookings',
    'Записи и брони': 'Bookings & records', 'Покупки и записи': 'Purchases & records',
    'Регулярные покупки': 'Regular purchases', 'Мои заказы': 'My orders',
    'Почта': 'Mail', 'Меню': 'Menu', 'Профиль': 'Profile',
    'Свернуть боковую панель': 'Collapse sidebar', 'Развернуть боковую панель': 'Expand sidebar',
    'Здесь будет история ваших чатов': 'Your chat history will appear here',
    'Войдите в аккаунт, чтобы создавать новые чаты и хранить их историю': 'Log in to create new chats and keep their history',
    'Скачать приложение': 'Get the app', 'Условия сервиса и обработки данных': 'Terms of service and data processing',
    'Бесплатный тариф': 'Free plan', 'Алиса Плюс активна': 'Alice Plus is active',
    'Алиса AI Бизнес активна': 'Alice AI Business is active', 'Главный чат': 'Main chat',
    'Недавние': 'Recent', 'Сегодня': 'Today', 'Вчера': 'Yesterday', 'Не прочитано': 'Unread',
    'Ролплей': 'Roleplay', 'Встречи': 'Meetings', 'Базы знаний': 'Knowledge bases',
    'Готовые команды': 'Ready prompts', 'Мои работы': 'My works', 'Выполненные': 'Completed',
    'ЕГЭ по математике': 'Exam prep: math', 'Математика — разбор по фото': 'Math — solve from a photo',
    'Репетитор': 'Tutor', 'История': 'History',
    // main screen
    'Привет!': 'Hi there!', 'Чем помочь сегодня?': 'How can I help today?',
    'Создадим шедевр вместе?': 'Shall we create a masterpiece together?',
    'Над чем работаем сегодня?': 'What are we working on today?',
    'Спросите о чём угодно': 'Ask me anything', 'Опишите, что поискать': 'Describe what to search for',
    'Что нужно сделать?': 'What needs to be done?',
    'Опишите задачу — Алиса доведёт её до результата.': 'Describe the task — Alice will see it through to the result.',
    'Создавайте задачи, ищите в подключенных плагинах': 'Create tasks, search in connected plugins',
    'Вставьте ссылку или опишите товар': 'Paste a link or describe a product',
    'Вставьте ссылку на товар': 'Paste a product link',
    'Напишите, что поменять в Браузере': 'Tell me what to change in Yandex Browser',
    'Что будем переводить?': 'What should we translate?',
    'Попробуйте AI-агентов!': 'Try the AI agents!',
    'Попробовать AI-агентов': 'Try the AI agents',
    'Нажмите, чтобы перейти к выбору режима': 'Click to choose a mode',
    'Найти дешевле': 'Find a better price', 'Выбрать кино': 'Pick a movie',
    'Забронировать': 'Book', 'Забронировать столик': 'Book a table',
    'Записаться в салон': 'Book a salon visit', 'Позвонить': 'Call',
    'Найду ресторан и сделаю резерв': 'I will find a restaurant and reserve a table',
    'Подберу мастера и запишу': 'I will pick a specialist and book a visit',
    'Перенеси стрижку на завтра': 'Move my haircut to tomorrow',
    'Отмени бронь в ресторане': 'Cancel my restaurant booking',
    'Записать в мою память': 'Save to My Memory', 'Посмотреть': 'View',
    'Исследовать': 'Explore', 'Изменить': 'Edit', 'Управлять Браузером': 'Control Yandex Browser',
    'Спросить по истории Браузера': 'Ask about Browser history',
    'Научиться математике': 'Learn math',
    // input & modes
    'Интеллект': 'Intelligence', 'Интеллект:': 'Intelligence:', ': Авто': ': Auto',
    'Интеллект: Авто': 'Intelligence: Auto', 'Интеллект: Экспертный': 'Intelligence: Expert',
    'Выбор режима интеллекта Алисы': "Choose Alice's intelligence mode",
    'Авто': 'Auto', 'Экспертный': 'Expert',
    'Алиса сама выберет необходимый уровень интеллекта для вашей задачи': 'Alice picks the right intelligence level for your task',
    'Повышенный уровень интеллекта для специализированных, сложных задач': 'Extra intelligence for specialized, complex tasks',
    'Подробнее о режимах интеллекта Алисы': "More about Alice's intelligence modes",
    'Добавить фото или файл': 'Add photo or file', 'Нарисовать картинку': 'Draw a picture',
    'Нарисовать': 'Draw', 'Оживить фото': 'Animate photo', 'Оживить': 'Animate',
    'Реставрировать фото': 'Restore photo', 'Объединить фото': 'Combine photos',
    'Объединить': 'Combine', 'Камера': 'Camera', 'Фото': 'Photo',
    'Распознать речь': 'Voice typing', 'Алиса, начни слушать': 'Alice, start listening',
    'Отправить': 'Send', 'Прокрутить вниз': 'Scroll to bottom', 'Выключить звук': 'Mute',
    'Без звука': 'Muted', 'Стоп': 'Stop', 'Приостановить': 'Pause',
    'Режим «Эксперт»': 'Expert mode', 'Интеллект, Режим «Эксперт»': 'Intelligence — Expert mode',
    'Студия, Реставрировать фото': 'Studio — Restore photo',
    'Генерация изображений': 'Image generation', 'Работа с файлами': 'Working with files',
    'Перевод текста': 'Text translation', 'Начать': 'Start', 'Режим инкогнито': 'Incognito mode',
    'Приватный': 'Private',
    // generation status (visible in assistant area)
    'Готовлю ответ, подождите немного...': 'Preparing the answer, one moment...',
    'Готовлю ответ, подождите немного': 'Preparing the answer, one moment',
    'Анализирую информацию, готовлю ответ...': 'Analyzing information, preparing the answer...',
    'Подождите, ответ ещё генерируется...': 'Hold on — the answer is still generating...',
    'Подождите еще чуть-чуть, пожалуйста...': 'Just a little longer, please...',
    'Завершаю генерацию ответа...': 'Finishing the answer...',
    'Отвечу в течение минуты': 'I will answer within a minute',
    'Отвечу в течение минуты. Пожалуйста, не закрывайте окно': 'I will answer within a minute. Please keep this window open',
    'Составляю план...': 'Making a plan...', 'Выполняю действие': 'Carrying out the action',
    'Запускаю агента управления устройством...': 'Starting the device-control agent...',
    'Анализирую видео…': 'Analyzing video…', 'Анализирую видео...': 'Analyzing video...',
    'Анализирую документ…': 'Analyzing document…', 'Анализирую документ...': 'Analyzing document...',
    'Ищу товары...': 'Searching products...', 'Ищу организации в Картах...': 'Searching Maps for organizations...',
    'Изменяю местоположение': 'Changing the location',
    'Фраза от ИИ, что идет поиск результатов по запросу': 'Searching for results',
    'Ответ сгенерирован': 'Answer is ready', 'Ошибка': 'Error', 'Загружаю...': 'Loading...',
    'Ссылка скопирована': 'Link copied', 'Создаю ссылку': 'Creating a link',
    'Не удалось создать ссылку': 'Could not create a link',
    'Не удалось открыть URL из сноски в ответе': 'Could not open the footnote URL from the answer',
    'Хороший ответ': 'Good answer', 'Плохой ответ': 'Bad answer', 'Пожаловаться': 'Report',
    'Скопировать': 'Copy', 'Копировать': 'Copy', 'Скачать': 'Download', 'Поделиться': 'Share',
    'Читать вслух': 'Read aloud', 'Сгенерировать ещё': 'Generate more', 'Ещё': 'More',
    'Спасибо за отзыв': 'Thanks for the feedback',
    // free-tier / load notices
    'Это ответ менее мощной модели': 'This reply comes from a less powerful model',
    'Из-за высокой нагрузки последняя версия Alice AI будет доступна позже': 'Due to high load, the latest Alice AI model will be available a bit later',
    'Алиса старается, но может ошибаться — проверяйте важное.': 'Alice tries hard but can make mistakes — double-check important things.',
    'Алиса может ошибаться — проверяйте важное.': 'Alice can make mistakes — double-check important things.',
    'Алиса AI может ошибаться.': 'Alice AI can make mistakes.',
    'Подробнее': 'Learn more',
    'Войдите, чтобы открыть все возможности нейросети': 'Log in to unlock everything the neural network can do',
    'Оформить опцию Алиса Плюс': 'Get Alice Plus', 'Обновить тариф': 'Upgrade plan',
    // files
    'Файлы': 'Files', 'Добавить файл': 'Add file', 'Не удалось загрузить файл': 'Could not upload the file',
    'Формат файла не поддерживается': 'File format is not supported', 'Ошибка обработки': 'Processing error',
    'Файлы не загружены': 'No files uploaded', 'Здесь файлы не поддерживаются': 'Files are not supported here',
    'Чтобы отправить файл, авторизуйтесь': 'Log in to send files',
    // products
    'Не удалось добавить товар': 'Could not add the product',
    'Здесь товары не поддерживаются': 'Products are not supported here',
    'Товары ещё загружаются': 'Products are still loading',
    // voice / notifications
    'Включите микрофон': 'Enable the microphone',
    'Чтобы общаться голосом, разрешите приложению использовать микрофон': 'To talk by voice, allow the app to use the microphone',
    'Чтобы общаться голосом, разрешите браузеру использовать микрофон': 'To talk by voice, allow your browser to use the microphone',
    'Как настроить': 'How to set up', 'Алиса отвечает только текстом': 'Alice is replying in text only',
    'Уведомления отключены': 'Notifications are off',
    'Чтобы не пропустить ответ — включите уведомления и Алиса напишет, когда всё будет готово': 'To not miss the answer, enable notifications and Alice will message you when it is ready',
    'Включите уведомления': 'Enable notifications',
    'Результат займёт время — Алиса AI сообщит о готовности': 'This will take a while — Alice AI will notify you when it is ready',
    'Режим «Без звука» можно отключить в настройках': 'Mute mode can be turned off in settings',
    // settings dialog / privacy
    'Фильтрация контента': 'Content filtering', 'Умеренная фильтрация': 'Moderate filtering',
    'Семейный режим': 'Family mode', 'Детский режим': 'Kids mode',
    'Чат будет удалён после его закрытия и не будет использован для обучения моделей': 'The chat is deleted once closed and is not used for model training',
    // browser-extension style dialogs
    'Алиса AI открылась автоматически': 'Alice AI opened automatically',
    'Разрешите отправку данных': 'Allow data sharing',
    'Можно в любой момент остановить отправку данных на серверы в настройках Яндекс Браузера — раздел Персональные данные': 'You can stop data sharing anytime in Yandex Browser settings, section "Personal data"',
    'Понятно': 'Got it', 'Отмена': 'Cancel', 'Отменить': 'Cancel', 'Повторить': 'Retry',
    'Обновить': 'Refresh', 'Разрешить': 'Allow', 'Включить': 'Enable', 'Закрыть': 'Close',
    'Назад': 'Back', 'Далее': 'Next', 'Готово': 'Done', 'Сохранить': 'Save',
    // page analysis prompts
    'Перескажи кратко эту страницу': 'Summarize this page briefly',
    'Перескажи кратко это видео': 'Summarize this video briefly',
    'Перескажи кратко этот документ': 'Summarize this document briefly',
    'Перескажи кратко': 'Summarize briefly', 'Что тут главное?': 'What is the key point here?',
    // share page
    'Это копия разговора между человеком': 'This is a copy of a conversation between a human',
    'и Алисой AI.': 'and Alice AI.', 'и AI персонажем.': 'and an AI character.',
    'и Алисой AI, персональные цены и скидки могут': 'and Alice AI; personal prices and discounts may',
    'быть неактуальны.': 'be out of date.',
    'Вы продолжили этот чат': 'You continued this chat',
    'Сообщения ниже видны только вам': 'The messages below are visible only to you',
    'Не удалось загрузить чат. Попробуйте ещё раз': 'Could not load the chat. Please try again',
    // errors
    'Отсутствует подключение к интернету.': 'No internet connection.',
    'Ой, у меня что-то сломалось. Попробуйте повторить свой вопрос': 'Oops, something broke on my side. Please try your question again',
    'Я проанализировала страницу. Могу ответить на вопросы по ней.': 'I have analyzed the page — ask me anything about it.',
    'Я проанализировала видео. Могу ответить на вопросы по нему.': 'I have analyzed the video — ask me anything about it.',
    'Я не смогла проанализировать видео, что-то пошло не так. Вы можете задать любой вопрос: ответ я буду искать в интернете.': 'I could not analyze the video. You can still ask anything — I will search the web for the answer.',
    'Спросите меня о чём угодно! Я с удовольствием отвечу, но пока не смогу учесть содержание этой страницы.': 'Ask me anything! I will gladly answer, though I cannot read this page yet.',
    'Здесь всё та же самая я, Алиса! Спросите меня о чём угодно, а я с удовольствием отвечу.': 'It is still me, Alice! Ask me anything and I will gladly answer.',
    'Это персонаж, а не человек или Алиса.': 'This is a character, not a human or Alice.',
    'Это ролплей, а не Алиса.': 'This is a roleplay, not Alice.',
    'Ответы персонажа собраны из произведений Л. Н. Толстого': 'The character answers come from works of Leo Tolstoy',
    'Погода AI здесь недавно — могут быть неточности': 'Weather AI is new here — results may be imprecise',
    'Свои Плюсы AI здесь недавно — могут быть неточности': 'Custom Plus answers are new here — results may be imprecise'
  };

  /* regex rules for templated strings; [pattern, replacement] with $1 groups */
  var RULES = [
    [/^Ищу (.+?) в интернете\.\.\.$/, 'Searching the web for "$1"...'],
    [/^Ищу (.+?) в картинках\.\.\.$/, 'Searching images for "$1"...'],
    [/^Ищу (.+?) в видео\.\.\.$/, 'Searching videos for "$1"...'],
    [/^Смотрю в магазинах (.+)$/, 'Checking stores for "$1"'],
    [/^Читаю сайт: (.+)$/, 'Reading: $1'],
    [/^Читаю (\d+)\s*(?:сайт|сайта|сайтов): (.*)$/, 'Reading $1 sites: $2'],
    [/^На основе (\d+)\s*(?:источника|источников|источник)\s*[—:]?\s*$/, 'Based on $1 sources:'],
    [/^(.+?) файл(?:а|ов)? превышает (.+)$/, '$1 file exceeds $2'],
    [/^Максимальное количество товаров\s*[—-]\s*(\d+)$/, 'Maximum number of products — $1'],
    [/^Спикер (\d+)$/, 'Speaker $1'],
    [/^Отвечу в течение минуты(.*)$/, 'I will answer within a minute$1'],
    [/^Алиса старается, но может ошибаться(.*)$/, 'Alice tries hard but can make mistakes — double-check important things.$1'],
    [/^Алиса может ошибаться(.*)$/, 'Alice can make mistakes — double-check important things.$1'],
    [/^Ой, у меня что-то сломалось(.*)$/, 'Oops, something broke on my side. Please try your question again'],
    [/^Войдите в аккаунт, чтобы(.*)$/, 'Log in to your account to$1'],
    [/^Ищу (.+?)\.\.\.$/, 'Searching for "$1"...']
  ];

  /* whitelist of statuses translatable INSIDE assistant message bubbles */
  var INSIDE_EXACT = {
    'Хороший ответ': 'Good answer', 'Плохой ответ': 'Bad answer', 'Пожаловаться': 'Report',
    'Скопировать': 'Copy', 'Копировать': 'Copy', 'Скачать': 'Download', 'Поделиться': 'Share',
    'Читать вслух': 'Read aloud', 'Сгенерировать ещё': 'Generate more', 'Ещё': 'More',
    'Спасибо за отзыв': 'Thanks for the feedback', 'Ссылка скопирована': 'Link copied',
    'Ответ сгенерирован': 'Answer is ready', 'Ошибка': 'Error', 'Загружаю...': 'Loading...',
    'Это ответ менее мощной модели': 'This reply comes from a less powerful model',
    'Из-за высокой нагрузки последняя версия Alice AI будет доступна позже': 'Due to high load, the latest Alice AI model will be available a bit later'
  };
  var INSIDE_RULES = [
    [/^Готовлю ответ/, 'Preparing the answer, one moment...'],
    [/^Анализирую/, 'Analyzing…'],
    [/^Ищу/, 'Searching…'],
    [/^Читаю/, 'Reading…'],
    [/^Составляю план/, 'Making a plan...'],
    [/^Завершаю/, 'Finishing the answer...'],
    [/^Подождите/, 'One moment...'],
    [/^Отвечу в течение минуты/, 'I will answer within a minute'],
    [/^Выполняю действие/, 'Carrying out the action'],
    [/^Запускаю агента/, 'Starting the agent...'],
    [/^Смотрю в магазинах/, 'Checking stores…'],
    [/^Создаю ссылку/, 'Creating a link'],
    [/^Не удалось/, 'Something went wrong']
  ];

  var TITLE_MAP = {
    'Нейросеть Алиса AI - бесплатный ии-чат Яндекса с генерацией текстов и изображений': 'Alice AI — Yandex\'s free AI chat with text and image generation'
  };

  function lookup(map, normed) {
    if (Object.prototype.hasOwnProperty.call(map, normed)) return map[normed];
    return null;
  }
  function translateText(raw, insideMessage) {
    if (!raw || !CYR.test(raw)) return null;
    var n = norm(raw);
    if (!n) return null;
    if (insideMessage) {
      var hit = lookup(INSIDE_EXACT, n) || lookup(EXACT, n);
      if (hit) return hit;
      for (var i = 0; i < INSIDE_RULES.length; i++) {
        if (INSIDE_RULES[i][0].test(n)) return n.replace(INSIDE_RULES[i][0], INSIDE_RULES[i][1]);
      }
      return null;
    }
    var hit2 = lookup(EXACT, n);
    if (hit2) return hit2;
    for (var j = 0; j < RULES.length; j++) {
      if (RULES[j][0].test(n)) return n.replace(RULES[j][0], RULES[j][1]);
    }
    return null;
  }

  /* ---------------- DOM translation ---------------- */
  var SKIP_SEL = '[data-alice-enx],textarea,input,[contenteditable="true"],[contenteditable=""],script,style,noscript,template,iframe';
  function skipped(node) {
    var el = node.nodeType === 3 ? node.parentElement : node;
    if (!el) return true;
    var p = el;
    while (p && p !== document.body) {
      if (p.closest && p.closest(SKIP_SEL)) return true;
      p = p.parentElement;
    }
    return false;
  }
  function roleOf(el) {
    var m = el.closest && el.closest('[data-message-role]');
    if (m) return m.getAttribute('data-message-role');
    var mm = el.closest && el.closest('.Message');
    if (mm) {
      if (/\bMessage_from_user\b/.test(mm.className)) return 'user';
      return 'assistant';
    }
    return null;
  }
  function handleTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var txt = node.nodeValue;
    if (!txt || !CYR.test(txt)) return;
    if (skipped(node)) return;
    var role = roleOf(node.parentElement);
    var en = translateText(txt, role === 'assistant');
    if (en && en !== txt) node.nodeValue = en;
  }
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var ATTR_SKIP_SEL = '[data-alice-enx],[contenteditable="true"],[contenteditable=""],script,style,noscript,template,iframe';
  function handleElAttrs(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.closest && el.closest(ATTR_SKIP_SEL)) return;
    var role = roleOf(el);
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var v = el.getAttribute(a);
      if (!v || !CYR.test(v)) continue;
      var en = translateText(v, role === 'assistant');
      if (en && en !== v) { try { el.setAttribute(a, en); } catch (e) {} }
    }
  }
  function sweep(root) {
    root = root || document.body;
    if (!root || !root.querySelectorAll) return;
    if (root.nodeType === 3) { handleTextNode(root); return; }
    if (root.closest && root.closest(SKIP_SEL) && root.nodeType === 1) {
      // still translate our own? no — skip entirely
      if (root.closest('[data-alice-enx]')) return;
    }
    var walker;
    try {
      walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) { return CYR.test(n.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
      });
    } catch (e) { return; }
    var nodes = [];
    var cur = walker.nextNode();
    while (cur) { nodes.push(cur); cur = walker.nextNode(); }
    for (var i = 0; i < nodes.length; i++) handleTextNode(nodes[i]);
    var els = root.querySelectorAll('[placeholder],[aria-label],[title],[alt]');
    for (var k = 0; k < els.length; k++) handleElAttrs(els[k]);
  }
  function translateDocument() {
    sweep(document.body);
    try {
      var t = document.title;
      if (t && CYR.test(t)) {
        var mapped = lookup(TITLE_MAP, norm(t)) || lookup(EXACT, norm(t));
        if (mapped) document.title = mapped;
      }
    } catch (e) {}
    try { document.documentElement.setAttribute('lang', 'en'); } catch (e) {}
  }

  var pending = new Set();
  var timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      var batch = Array.from(pending);
      pending.clear();
      batch.forEach(function (n) { sweep(n); });
    }, 150);
  }
  function startObserver() {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (!n) continue;
            if (n.nodeType === 1 && n.closest && n.closest('[data-alice-enx]')) continue;
            pending.add(n.nodeType === 3 ? (n.parentElement || document.body) : n);
          }
        } else if (m.type === 'attributes') {
          if (!(m.target && m.target.closest && m.target.closest('[data-alice-enx]'))) pending.add(m.target);
        } else if (m.type === 'characterData' && m.target) {
          pending.add(m.target.parentElement || document.body);
        }
      }
      schedule();
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    var k = 0;
    var iv = setInterval(function () { translateDocument(); if (++k >= 40) clearInterval(iv); }, 1500);
    translateDocument();
  }

  /* ---------------- machine translation service ---------------- */
  var EN_MARKER = 'Answer strictly in English only.';

  function gtxUrl(text) {
    return 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(text);
  }
  function parseGtx(body) {
    var data = JSON.parse(body);
    if (!data || !data[0]) throw new Error('bad gtx payload');
    return data[0].map(function (seg) { return seg && seg[0] ? seg[0] : ''; }).join('');
  }
  function myMemory(text, cb) {
    var chunks = [];
    var rest = String(text);
    while (rest.length) {
      var cut = Math.min(480, rest.length);
      if (cut < rest.length) {
        var idx = -1;
        for (var p = cut; p > 200; p--) { var ch = rest[p]; if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') { idx = p + 1; break; } }
        if (idx > 0) cut = idx;
      }
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    var out = [], done = 0, failed = false;
    if (!chunks.length) { cb(null); return; }
    chunks.forEach(function (chunk, i) {
      var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(chunk) + '&langpair=ru|en';
      function fin() {
        done++;
        if (done === chunks.length) cb(failed ? null : out.join(' ').replace(/\s+/g, ' ').trim());
      }
      function useJson(j) {
        try {
          if (j && j.responseData && j.responseData.translatedText && j.responseStatus === 200 && /MYMEMORY WARNING/i.test(j.responseData.translatedText) === false) {
            out[i] = j.responseData.translatedText;
          } else { failed = true; }
        } catch (e) { failed = true; }
        fin();
      }
      fetch(url).then(function (r) { return r.json(); }).then(useJson).catch(function () { failed = true; fin(); });
    });
  }
  function gtxViaGM(text, cb) {
    GMX({
      method: 'GET', url: gtxUrl(text), timeout: 15000,
      onload: function (r) { try { cb(parseGtx(r.responseText)); } catch (e) { myMemory(text, cb); } },
      onerror: function () { myMemory(text, cb); },
      ontimeout: function () { myMemory(text, cb); }
    });
  }
  function mt(text, cb) {
    text = String(text || '').trim();
    if (!text) { cb(null); return; }
    if (GMX) { gtxViaGM(text, cb); return; }
    if (EXT) {
      try {
        chrome.runtime.sendMessage({ type: 'aliceEnxTranslate', text: text }, function (res) {
          if (chrome.runtime.lastError) { myMemory(text, cb); return; }
          if (res && res.ok && res.text) cb(res.text); else myMemory(text, cb);
        });
        return;
      } catch (e) { /* fall through */ }
    }
    myMemory(text, cb);
  }

  /* ---------------- send-time textarea helper ---------------- */
  function setNativeValue(el, value) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLInputElement ? HTMLInputElement.prototype
      : Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------------- export ---------------- */
  A.GMX = GMX; A.EXT = EXT;
  A.settings = settings; A.applySettings = applySettings; A.onSettings = onSettings;
  A.norm = norm; A.translateText = translateText; A.translateDocument = translateDocument;
  A.startObserver = startObserver; A.sweep = sweep;
  A.mt = mt; A.EN_MARKER = EN_MARKER; A.setNativeValue = setNativeValue;
  A.mark = function (el) { if (el) el.setAttribute('data-alice-enx', '1'); return el; };
  window.__ALICE_ENX = A;
})();
/* Alice English Overlay — Part B: UI (mode bar, chips, reply tools, EN replies, notices) */
(function () {
  'use strict';
  var A = window.__ALICE_ENX;
  if (!A) return;
  var S = A.settings;
  var EN_MARKER = A.EN_MARKER;

  /* ---------------- shared state ---------------- */
  var state = { pendingRecap: null, lastTool: null };

  /* ---------------- CSS ---------------- */
  var CSS = [
    '.alice-enx-root{all:initial}',
    '*[data-alice-enx]{font-family:-apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box}',
    '.alice-enx-modebar{position:fixed;z-index:2147483000;display:flex;align-items:center;gap:2px;padding:5px;border-radius:999px;',
      'background:rgba(255,255,255,.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
      'border:1px solid rgba(20,20,30,.09);box-shadow:0 10px 30px rgba(10,10,30,.13);max-width:min(94vw,700px);overflow-x:auto;scrollbar-width:none;box-sizing:border-box}',
    '.alice-enx-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:999px;border:none;background:transparent;cursor:pointer;',
      'font:500 12.5px/1 -apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,sans-serif;color:#454551;white-space:nowrap;transition:background .15s,color .15s}',
    '.alice-enx-pill:hover{background:rgba(108,76,240,.08);color:#2b2b33}',
    '.alice-enx-pill.alice-enx-active{background:rgba(108,76,240,.13);color:#5b3fd6;font-weight:600}',
    '.alice-enx-pill svg{width:14px;height:14px;flex:0 0 auto}',
    '.alice-enx-pill.alice-enx-busy{opacity:.55;pointer-events:none}',
    '.alice-enx-sep{width:1px;height:16px;background:rgba(20,20,30,.12);margin:0 3px}',
    '.alice-enx-gear{color:#8a8a95}',
    '@media (prefers-color-scheme:dark){',
      '.alice-enx-modebar{background:rgba(26,26,32,.86);border-color:rgba(255,255,255,.10);box-shadow:0 10px 30px rgba(0,0,0,.45)}',
      '.alice-enx-pill{color:#c9c9d2}.alice-enx-pill:hover{background:rgba(139,109,255,.14);color:#e8e8ee}',
      '.alice-enx-pill.alice-enx-active{background:rgba(139,109,255,.20);color:#c0b2ff}',
      '.alice-enx-sep{background:rgba(255,255,255,.14)}.alice-enx-gear{color:#8f8f9c}}',
    '@media (max-width:680px){',
      '.alice-enx-modebar{padding:3px 5px;gap:1px;max-width:96vw}',
      '.alice-enx-pill{padding:5px 8px;font-size:11.5px;gap:3px}',
      '.alice-enx-pill svg{width:12px;height:12px}',
    '}',
    '@media (max-width:490px){',
      '.alice-enx-pill span{display:none}',
      '.alice-enx-pill{padding:6px 9px}',
      '.alice-enx-sep{display:none}',
    '}',
    '@media (max-height:720px){',
      '.alice-enx-chips{margin:8px auto 44px;gap:6px}',
      '.alice-enx-chip{padding:8px 12px}',
    '}',
    /* chips */
    '.alice-enx-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;max-width:680px;margin:14px auto 58px;padding:0 12px}',
    '@media (max-width:640px){.alice-enx-chips{grid-template-columns:1fr;margin:10px auto 48px}}',
    '.AliceChat-Messages,[class*="MessagesList"]{padding-bottom:56px !important}',
    '[data-testid="alice-chat-message"]:last-child,.AliceChat-Message:last-child{margin-bottom:52px !important}',
    '.alice-enx-chip{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;cursor:pointer;text-align:left;',
      'background:rgba(255,255,255,.75);border:1px solid rgba(20,20,30,.08);',
      'font:400 13.5px/1.45 -apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,sans-serif;color:#3c3c46;',
      'transition:border-color .15s,box-shadow .15s,transform .15s}',
    '.alice-enx-chip:hover{border-color:rgba(108,76,240,.45);box-shadow:0 6px 18px rgba(108,76,240,.12);transform:translateY(-1px)}',
    '.alice-enx-chip b{display:block;font-weight:600;font-size:13.5px;color:#26262e}',
    '.alice-enx-chip span{display:block;font-weight:400;font-size:12px;color:#8b8b96;margin-top:2px}',
    '@media (prefers-color-scheme:dark){',
      '.alice-enx-chip{background:rgba(32,32,40,.72);border-color:rgba(255,255,255,.09);color:#c6c6cf}',
      '.alice-enx-chip b{color:#e9e9f0}.alice-enx-chip span{color:#96969f}',
      '.alice-enx-chip:hover{border-color:rgba(139,109,255,.55)}}',
    /* reply tool buttons */
    '.alice-enx-toolsbar{display:flex;align-items:center;gap:4px;margin-top:6px}',
    '.alice-enx-rbtn{display:inline-flex;align-items:center;gap:5px;border:none;background:transparent;cursor:pointer;padding:5px 8px;border-radius:8px;',
      'font:500 12.5px/1 -apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,sans-serif;color:#8a8a95;transition:background .15s,color .15s}',
    '.alice-enx-rbtn:hover{background:rgba(108,76,240,.10);color:#5b3fd6}',
    '.alice-enx-rbtn svg{width:13px;height:13px}',
    /* machine-translation block */
    '.alice-enx-mt{margin:10px 0 2px;padding:10px 12px;border-left:3px solid rgba(108,76,240,.55);border-radius:8px;background:rgba(108,76,240,.06);',
      'font:400 13.5px/1.55 -apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,sans-serif;color:#3a3a44}',
    '.alice-enx-mt-label{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b6ff0;margin-bottom:4px}',
    '@media (prefers-color-scheme:dark){.alice-enx-mt{background:rgba(139,109,255,.08);color:#d3d3dc}}',
    /* notice bar */
    '.alice-enx-notice{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483100;display:flex;align-items:center;gap:10px;max-width:min(680px,92vw);',
      'padding:10px 12px 10px 14px;border-radius:14px;background:rgba(30,28,44,.94);color:#eae6ff;',
      'box-shadow:0 12px 34px rgba(10,10,30,.35);border:1px solid rgba(139,109,255,.35);',
      'font:400 13px/1.5 -apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,sans-serif}',
    '.alice-enx-notice b{font-weight:600}',
    '.alice-enx-notice button{border:none;border-radius:8px;background:rgba(139,109,255,.18);color:#d9d0ff;cursor:pointer;padding:5px 10px;font:500 12px/1 inherit}',
    '.alice-enx-notice button:hover{background:rgba(139,109,255,.3)}',
    '.alice-enx-notice .alice-enx-x{background:transparent;color:#9d96b8;padding:5px 6px;font-size:14px}',
    /* context bar */
    '.alice-enx-ctxbar{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-radius:12px;',
      'background:rgba(255,247,230,.95);border:1px solid rgba(190,140,40,.35);box-shadow:0 10px 26px rgba(120,80,10,.15);',
      'font:400 12.5px/1.4 -apple-system,BlinkMacSystemFont,"YS Text","Segoe UI",Roboto,sans-serif;color:#5c4a1e}',
    '.alice-enx-ctxbar button{border:none;border-radius:8px;cursor:pointer;padding:5px 10px;font:500 12px/1 inherit}',
    '.alice-enx-ctxbar .alice-enx-keep{background:#6C4CF0;color:#fff}',
    '.alice-enx-ctxbar .alice-enx-discard{background:transparent;color:#8a7a55}',
    '@media (prefers-color-scheme:dark){.alice-enx-ctxbar{background:rgba(44,38,24,.94);border-color:rgba(220,180,90,.3);color:#eadfc2}}',
    /* upsell hiding */
    'html.alice-enx-hide-upsell [data-testid="chat-list-login-button"],',
    'html.alice-enx-hide-upsell .ChatListLoginPanel,',
    'html.alice-enx-hide-upsell .AdvCard,html.alice-enx-hide-upsell .AdvSnippet,',
    'html.alice-enx-hide-upsell .alice-enx-upsell{display:none !important}',
    'html.alice-enx-suggests-off .MainPageSuggests-Item{display:none !important}',
    '.alice-enx-hidden{display:none !important}'
  ].join('');

  function injectCSS() {
    var st = document.createElement('style');
    st.setAttribute('data-alice-enx', '1');
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------------- icons ---------------- */
  function svg(paths, vb) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', vb || '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = paths;
    s.appendChild(g);
    return s;
  }
  var ICONS = {
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    spark: '<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/>',
    brain: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1.4"/><circle cx="15" cy="9" r="1.4"/><circle cx="12" cy="15" r="1.4"/>',
    tag: '<path d="M3 10V4a1 1 0 0 1 1-1h6l11 11-7 7L3 10z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    sigma: '<path d="M18 5H7l6 7-6 7h11"/>',
    clip: '<path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 5a3.7 3.7 0 0 1 5.2 5.2l-8.3 8.3a1.9 1.9 0 0 1-2.6-2.6L15 8"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    lang: '<path d="M4 5h7M7.5 5c0 4-1.5 7-4.5 9"/><path d="M6 8.5C7 11 9 13.5 11 14.5"/><path d="M13 20l4-10 4 10M14.6 17h4.8"/>'
  };

  /* ---------------- mode bar ---------------- */
  var modeBar = null;
  var pillEls = {};

  function pill(id, label, icon, onClick, title) {
    var b = document.createElement('button');
    b.className = 'alice-enx-pill';
    b.setAttribute('data-alice-enx', '1');
    b.setAttribute('data-alice-enx-pill', id);
    if (title) b.title = title;
    b.appendChild(svg(ICONS[icon]));
    var t = document.createElement('span');
    t.textContent = label;
    b.appendChild(t);
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(b); });
    pillEls[id] = { btn: b, label: t };
    return b;
  }

  function findModeTrigger() {
    return document.querySelector('button[aria-label="Выбор режима интеллекта Алисы"], button[aria-label*="режима интеллекта"], button[aria-label="Choose Alice\'s intelligence mode"]');
  }
  function findMoreTrigger() {
    return document.querySelector('[data-testid="InputControls-More-Button"]');
  }
  function realClick(el) {
    var r = el.getBoundingClientRect();
    var opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + Math.min(r.height / 2, 20), button: 0 };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
    } catch (e) { el.click(); }
  }
  function clickMenuItem(matchFn, done) {
    var t0 = Date.now();
    (function tryFind() {
      var items = Array.prototype.slice.call(document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"]'));
      var target = null;
      for (var i = 0; i < items.length; i++) {
        if (matchFn(A.norm(items[i].textContent || ''), items[i])) { target = items[i]; break; }
      }
      if (target) {
        realClick(target);
        setTimeout(function () { document.body && document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }, 60);
        done && done(true);
      } else if (Date.now() - t0 < 2500) {
        setTimeout(tryFind, 100);
      } else { done && done(false); }
    })();
  }
  function busy(btn, on) { if (btn) btn.classList[on ? 'add' : 'remove']('alice-enx-busy'); }

  function switchIntelligence(mode) { // 'auto' | 'expert'
    var trig = findModeTrigger();
    if (!trig) return;
    trig.click();
    clickMenuItem(function (txt) {
      return mode === 'auto' ? /^(Авто|Auto)/.test(txt) : /^(Эксперт|Expert)/.test(txt);
    });
  }
  function isAnonymous() {
    return !!document.querySelector('[data-testid="chat-list-login-button"], .ChatListLoginPanel');
  }
  function toolMode(mode) { // 'draw' | 'deals' | 'math' | 'attach'
    if (isAnonymous()) {
      showNotice('This mode needs a free Yandex login (agents, drawing and file tools are account-gated). Chat, Auto and Expert modes below work without any account.');
      return;
    }
    var trig = findMoreTrigger();
    if (!trig) return;
    var map = {
      draw: /^(Нарисовать картинку|Draw a picture)/,
      deals: /^(Найти дешевле|Find a better price)/,
      math: /^(Научиться математике|Learn math)/,
      attach: /^(Добавить фото или файл|Add photo or file)/
    };
    trig.click();
    clickMenuItem(function (txt) { return map[mode].test(txt); }, function (ok) {
      if (ok && (mode === 'draw' || mode === 'deals' || mode === 'math')) { state.lastTool = mode; refreshPills(); }
    });
  }
  function dictate() {
    var b = document.querySelector('[data-testid="button-dictation-button"]');
    if (b) b.click();
  }
  function harvestRecap() {
    var msgs = document.querySelectorAll('[data-testid="alice-chat-message"],.AliceChat-Message');
    if (msgs.length < 2) return null;
    var lines = [];
    var total = 0;
    var max = 12;
    for (var i = Math.max(0, msgs.length - max); i < msgs.length; i++) {
      var m = msgs[i];
      var roleEl = m.querySelector('.Message_from_user, [data-message-role="user"]');
      var isUser = !!(roleEl && m.contains(roleEl) && roleEl.closest('.AliceChat-Message,[data-testid="alice-chat-message"]') === m);
      if (!isUser) {
        var um = m.querySelector('.Message.Message_from_user');
        isUser = !!um;
      }
      var text = A.norm((m.innerText || '').replace(EN_MARKER, ''));
      text = text.replace(/^(Good answer|Bad answer|Report|Copy|Download|Share|Read aloud|Хороший ответ|Плохой ответ|Пожаловаться|Скопировать|Скачать|Поделиться|Читать вслух)+\s*$/, '');
      if (!text) continue;
      if (text.length > 300) text = text.slice(0, 300) + '…';
      var who = isUser ? 'You' : 'Alice';
      var line = who + ': ' + text;
      total += line.length;
      lines.push(line);
      if (total > 1600) break;
    }
    if (!lines.length) return null;
    return lines.join('\n');
  }
  function newChat() {
    if (isAnonymous()) {
      showNotice('Anonymous free mode keeps ONE ongoing chat. Log in with a free Yandex ID to start new chats and save history — meanwhile, switching modes below keeps your context.');
      return;
    }
    var recap = null;
    if (S.carryContext) recap = harvestRecap();
    var btn = document.querySelector('[data-testid="new-chat-button"]');
    if (btn) {
      if (recap) { try { sessionStorage.setItem('aliceEnxRecap', recap); } catch (e) {} state.pendingRecap = recap; }
      btn.click();
      setTimeout(function () { maybeShowCtxBar(); }, 600);
    }
  }
  function stashToPending() {
    try { var r = sessionStorage.getItem('aliceEnxRecap'); if (r) state.pendingRecap = r; } catch (e) {}
    maybeShowCtxBar();
  }
  function clearRecap() {
    state.pendingRecap = null;
    try { sessionStorage.removeItem('aliceEnxRecap'); } catch (e) {}
    if (ctxBar && ctxBar.parentNode) ctxBar.parentNode.removeChild(ctxBar);
  }
  var ctxBar = null;
  function maybeShowCtxBar() {
    if (!S.carryContext || !state.pendingRecap) return;
    if (document.querySelector('[data-testid="alice-chat-message"],.AliceChat-Message')) return; // not a fresh chat
    if (ctxBar && ctxBar.isConnected) return;
    var ta = document.querySelector('textarea');
    if (!ta) return;
    ctxBar = A.mark(document.createElement('div'));
    ctxBar.className = 'alice-enx-ctxbar';
    var msg = document.createElement('span');
    msg.textContent = 'Context from your previous chat will ride along with your first message.';
    ctxBar.appendChild(msg);
    var keep = document.createElement('button');
    keep.className = 'alice-enx-keep'; keep.textContent = 'Keep';
    keep.addEventListener('click', function () { placeBar(); });
    var discard = document.createElement('button');
    discard.className = 'alice-enx-discard'; discard.textContent = 'Discard';
    discard.addEventListener('click', clearRecap);
    ctxBar.appendChild(keep); ctxBar.appendChild(discard);
    document.body.appendChild(ctxBar);
    placeBar();
    setTimeout(function () { if (state.pendingRecap && (!ctxBar || !ctxBar.isConnected)) { /* kept silently */ } }, 50);
  }

  function isActiveMode(id) {
    var trig = findModeTrigger();
    var label = trig ? A.norm(trig.textContent || '') : '';
    var low = (label + ' ' + (trig ? trig.getAttribute('aria-label') || '' : '')).toLowerCase();
    if (id === 'auto') return /авто|auto/.test(low);
    if (id === 'expert') return /эксперт|expert/.test(low);
    if (id === 'draw' || id === 'deals' || id === 'math') {
      var names = { draw: /^(Нарисовать картинку|Draw a picture)$/, deals: /^(Найти дешевле|Find a better price)$/, math: /^(Научиться математике|Learn math)$/ };
      var probe = false;
      var cands = document.querySelectorAll('[class*="Chip"],[class*="chip"],[class*="Tag"],[class*="Pill"],[class*="Tool"],[class*="Mode"]');
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i];
        if (el.closest && el.closest('[data-alice-enx],[role="menu"],[role="listbox"],[role="tooltip"]')) continue;
        if (el.children && el.children.length > 3) continue;
        var t = A.norm(el.textContent || '');
        if (t === names[id]) { probe = true; break; }
      }
      return probe || state.lastTool === id;
    }
    return false;
  }
  function refreshPills() {
    ['auto', 'expert', 'draw', 'deals', 'math'].forEach(function (id) {
      var p = pillEls[id];
      if (p) p.btn.classList[isActiveMode(id) ? 'add' : 'remove']('alice-enx-active');
    });
  }
  setInterval(refreshPills, 900);

  function buildModeBar() {
    modeBar = A.mark(document.createElement('div'));
    modeBar.className = 'alice-enx-modebar';
    modeBar.appendChild(pill('new', 'New', 'plus', newChat, 'Start a new chat'));
    modeBar.appendChild(sep());
    modeBar.appendChild(pill('auto', 'Auto', 'spark', function () { switchIntelligence('auto'); }, 'Auto intelligence — Alice picks the level'));
    modeBar.appendChild(pill('expert', 'Expert', 'brain', function () { switchIntelligence('expert'); }, 'Expert intelligence — deeper reasoning'));
    modeBar.appendChild(pill('draw', 'Draw', 'palette', function () { toolMode('draw'); }, 'Image generation mode'));
    modeBar.appendChild(pill('deals', 'Deals', 'tag', function () { toolMode('deals'); }, 'Shopping — find a better price'));
    modeBar.appendChild(pill('math', 'Math', 'sigma', function () { toolMode('math'); }, 'Math tutor mode'));
    var gear = pill('gear', '', 'gear', function (b) { toggleSettingsPanel(b); }, 'Overlay settings');
    gear.className += ' alice-enx-gear';
    modeBar.appendChild(gear);
    document.body.appendChild(modeBar);
    placeBar();
    refreshPills();
  }
  function sep() { var s = document.createElement('div'); s.className = 'alice-enx-sep'; s.setAttribute('data-alice-enx', '1'); return s; }

  function findInputBox() {
    var ta = document.querySelector('textarea');
    if (!ta) return null;
    var cont = ta.closest('.StandaloneInput-Container, .AliceInput, form');
    if (cont) return cont;
    var cur = ta;
    for (var i = 0; i < 4; i++) {
      if (!cur.parentElement || cur.parentElement === document.body) break;
      cur = cur.parentElement;
      if (cur.offsetHeight >= 48 && cur.offsetWidth >= ta.offsetWidth) {
        return cur;
      }
    }
    return ta;
  }

  function placeBar() {
    if (!modeBar) return;
    var box = findInputBox();
    if (!box) { modeBar.style.display = 'none'; return; }
    var r = box.getBoundingClientRect();
    if (!r || r.width === 0 || r.top < 40) { modeBar.style.display = 'none'; return; }
    modeBar.style.display = 'inline-flex';

    var centerX = Math.round(r.left + r.width / 2);
    modeBar.style.left = centerX + 'px';
    modeBar.style.transform = 'translateX(-50%)';

    var bottom = Math.max(10, Math.round(window.innerHeight - r.top + 10));
    modeBar.style.bottom = bottom + 'px';

    if (ctxBar && ctxBar.isConnected) {
      ctxBar.style.left = centerX + 'px';
      ctxBar.style.transform = 'translateX(-50%)';
      var mb = modeBar.getBoundingClientRect();
      ctxBar.style.bottom = (bottom + (mb.height || 36) + 8) + 'px';
    }
  }
  window.addEventListener('resize', placeBar);
  window.addEventListener('scroll', placeBar, true);
  if (typeof ResizeObserver !== 'undefined') {
    try {
      var ro = new ResizeObserver(function () { placeBar(); });
      ro.observe(document.body);
    } catch (e) {}
  }
  setInterval(placeBar, 400);

  /* ---------------- settings panel ---------------- */
  var panel = null;
  function toggleSettingsPanel(anchor) {
    if (panel && panel.isConnected) { panel.remove(); panel = null; return; }
    panel = A.mark(document.createElement('div'));
    panel.style.cssText = 'position:fixed;z-index:2147483100;min-width:250px;padding:14px;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 16px 44px rgba(10,10,30,.22);border:1px solid rgba(20,20,30,.1);backdrop-filter:blur(14px)';
    var title = document.createElement('div');
    title.textContent = 'Alice English Overlay';
    title.style.cssText = 'font:600 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#2b2b33;margin-bottom:10px';
    panel.appendChild(title);
    var items = [
      ['enReplies', 'Reply in English (auto)'],
      ['translateBtn', '"EN" translate button on replies'],
      ['chips', 'English prompt chips'],
      ['hideUpsell', 'Hide ads & login upsells'],
      ['carryContext', 'Carry context to new chats'],
      ['modeBar', 'Show mode bar']
    ];
    items.forEach(function (it) {
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:7px 2px;cursor:pointer;font:400 12.5px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#454551';
      var lbl = document.createElement('span');
      lbl.textContent = it[1];
      var tg = document.createElement('input');
      tg.type = 'checkbox';
      tg.checked = !!S[it[0]];
      tg.style.cssText = 'accent-color:#6C4CF0;width:15px;height:15px;cursor:pointer';
      tg.addEventListener('change', function () {
        var next = {}; next[it[0]] = tg.checked;
        A.applySettings(next);
      });
      row.appendChild(lbl); row.appendChild(tg);
      panel.appendChild(row);
    });
    var foot = document.createElement('div');
    foot.textContent = 'v' + A.version + ' — free anonymous Alice, in English';
    foot.style.cssText = 'margin-top:10px;font:400 10.5px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#a0a0aa';
    panel.appendChild(foot);
    document.body.appendChild(panel);
    function reposition() {
      var r = anchor.getBoundingClientRect();
      var pw = panel.offsetWidth || 260;
      var ph = panel.offsetHeight || 280;
      var top = r.top - ph - 10;
      if (top < 10) top = r.bottom + 10;
      if (top + ph > window.innerHeight - 10) top = Math.max(10, window.innerHeight - ph - 10);
      panel.style.top = top + 'px';
      var left = r.left;
      if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
      panel.style.left = Math.max(10, left) + 'px';
    }
    reposition();
    setTimeout(function () {
      document.addEventListener('click', function onDoc(e) {
        if (panel && !panel.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
          if (panel) { panel.remove(); panel = null; }
          document.removeEventListener('click', onDoc);
        }
      });
    }, 30);
  }
  A.onSettings(function (next) {
    S = next;
    document.documentElement.classList.toggle('alice-enx-hide-upsell', !!S.hideUpsell);
    document.documentElement.classList.toggle('alice-enx-suggests-off', !!S.chips);
    if (modeBar) modeBar.style.display = S.modeBar ? '' : 'none';
    if (!S.chips && chipsEl && chipsEl.isConnected) chipsEl.remove();
    if (S.chips) ensureChips();
    scanUpsells();
  });

  /* ---------------- EN replies + context carry (send interception) ---------------- */
  function toolBlocksInjection() {
    return state.lastTool === 'draw' || state.lastTool === 'deals';
  }
  function beforeSend(ta) {
    if (!ta) return;
    var v = ta.value || '';
    if (!v.trim()) return;
    var changed = false;
    var parts = [];
    if (S.enReplies && !toolBlocksInjection() && v.indexOf(EN_MARKER) === -1) parts.push(EN_MARKER);
    if (state.pendingRecap && v.indexOf('Context from our previous chat') === -1) {
      parts.push('Context from our previous chat (summary):\n' + state.pendingRecap);
      clearRecap();
      changed = true;
    }
    if (parts.length) {
      A.setNativeValue(ta, parts.join('\n\n') + '\n\n' + v.replace(/^\s+/, ''));
      changed = true;
    }
    return changed;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    var t = e.target;
    if (!t || !t.matches || !t.matches('textarea')) return;
    if (!S.enReplies && !state.pendingRecap) return;
    beforeSend(t);
  }, true);
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button[aria-label="Отправить"],button[aria-label="Send"],[data-testid="oknyx"]') : null;
    if (!btn) return;
    if (btn.getAttribute('aria-label') === 'Алиса, начни слушать' || (btn.textContent || '').indexOf('слушать') > -1) return;
    var ta = document.querySelector('textarea');
    if (!ta || !(ta.value || '').trim()) return;
    if (!S.enReplies && !state.pendingRecap) return;
    beforeSend(ta);
  }, true);

  /* ---------------- prompt chips ---------------- */
  var STARTERS = [
    ['Explain something simply', 'Explain how neural networks learn, in simple words'],
    ['Plan my week', 'Help me plan my week: 5 focus tasks, realistic timing'],
    ['Draft an email', 'Draft a short polite email asking my landlord to fix the heating'],
    ['Brainstorm ideas', 'Brainstorm 10 creative gift ideas for a friend who loves hiking']
  ];
  var chipsEl = null;
  function ensureChips() {
    if (!S.chips || chipsEl && chipsEl.isConnected) return;
    var ta = document.querySelector('textarea');
    if (!ta) return;
    if (document.querySelector('[data-testid="alice-chat-message"],.AliceChat-Message')) return;
    var suggests = document.querySelector('.MainPageSuggests, [class*="MainPageSuggests"]');
    var host = null;
    if (suggests && suggests.parentNode) { host = suggests.parentNode; host.insertBefore(chipsRow(), suggests); }
    else {
      var form = ta.closest('form') || ta.parentElement;
      var col = form && form.parentElement;
      if (col) col.insertBefore(chipsRow(), col.contains(form) ? form : null);
    }
  }
  function chipsRow() {
    chipsEl = A.mark(document.createElement('div'));
    chipsEl.className = 'alice-enx-chips';
    STARTERS.forEach(function (st) {
      var c = document.createElement('button');
      c.className = 'alice-enx-chip';
      c.type = 'button';
      var wrap = document.createElement('div');
      var b = document.createElement('b'); b.textContent = st[0];
      var s = document.createElement('span'); s.textContent = st[1].length > 64 ? st[1].slice(0, 64) + '…' : st[1];
      wrap.appendChild(b); wrap.appendChild(s);
      c.appendChild(wrap);
      c.addEventListener('click', function () {
        var ta = document.querySelector('textarea');
        if (!ta) return;
        A.setNativeValue(ta, st[1]);
        ta.focus();
        try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
      });
      chipsEl.appendChild(c);
    });
    return chipsEl;
  }

  /* ---------------- reply tools (copy + EN translate) ---------------- */
  function msgText(rootEl) {
    var clone = rootEl.cloneNode(true);
    clone.querySelectorAll('[data-alice-enx],[class*="Actions"],[class*="actions"]').forEach(function (n) { n.remove(); });
    var t = (clone.innerText || clone.textContent || '').replace(EN_MARKER, '').trim();
    return t.replace(/\n{3,}/g, '\n\n');
  }
  function buildToolbar(msgRoot, bar) {
    var copy = A.mark(document.createElement('button'));
    copy.className = 'alice-enx-rbtn'; copy.type = 'button';
    copy.appendChild(svg(ICONS.copy));
    var ct = document.createElement('span'); ct.textContent = 'Copy';
    copy.appendChild(ct);
    copy.addEventListener('click', function () {
      var text = msgText(msgRoot);
      function done() { ct.textContent = 'Copied'; setTimeout(function () { ct.textContent = 'Copy'; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });
    var en = A.mark(document.createElement('button'));
    en.className = 'alice-enx-rbtn'; en.type = 'button';
    en.appendChild(svg(ICONS.lang));
    var et = document.createElement('span'); et.textContent = 'EN';
    en.appendChild(et);
    en.addEventListener('click', function () {
      var existing = msgRoot.querySelector('.alice-enx-mt');
      if (existing) { existing.remove(); et.textContent = 'EN'; return; }
      et.textContent = '…';
      var text = msgText(msgRoot);
      A.mt(text, function (res) {
        var block = A.mark(document.createElement('div'));
        block.className = 'alice-enx-mt';
        var lbl = document.createElement('span');
        lbl.className = 'alice-enx-mt-label'; lbl.textContent = 'English translation';
        block.appendChild(lbl);
        var body = document.createElement('div');
        body.textContent = res || 'Translation is unavailable here (blocked or quota reached).';
        block.appendChild(body);
        var anchor = msgRoot.querySelector('.alice-enx-toolsbar') || msgRoot;
        if (anchor.parentNode === msgRoot) msgRoot.insertBefore(block, anchor);
        else msgRoot.appendChild(block);
        et.textContent = res ? 'EN' : 'EN!';
      });
    });
    bar.appendChild(copy);
    bar.appendChild(en);
  }
  function ensureReplyTools() {
    if (!S.translateBtn) return;
    var msgs = document.querySelectorAll('.Message:not(.Message_from_user)');
    for (var i = 0; i < msgs.length; i++) {
      var msgRoot = msgs[i];
      if (!A.norm(msgRoot.textContent || '')) continue;
      if (msgRoot.querySelector(':scope > .alice-enx-toolsbar')) continue; // React may wipe it; next tick re-adds
      var bar = document.createElement('div');
      bar.className = 'alice-enx-toolsbar';
      bar.setAttribute('data-alice-enx', '1');
      buildToolbar(msgRoot, bar);
      msgRoot.appendChild(bar);
    }
  }

  /* ---------------- upsell hider ---------------- */
  var UPSELL_RE = /(войдите, чтобы открыть|войдите в аккаунт, чтобы создавать|оформить опцию|обновить тариф|попробуйте ai-агентов|скачать приложение)/i;
  var UPSELL_SEL = '[class*="Banner"],[class*="banner"],[class*="Promo"],[class*="promo"],[class*="LoginPanel"],[class*="Upsell"],[class*="Rate"],[class*="Widget"],[class*="Infobox"],[class*="Teaser"]';
  function scanUpsells() {
    if (!S.hideUpsell) return;
    var candidates = document.querySelectorAll(UPSELL_SEL);
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.classList.contains('alice-enx-upsell')) continue;
      if (el.closest('[data-alice-enx],[data-message-role],.Message')) continue;
      var raw = el.textContent || '';
      if (raw.length > 300) continue;
      if (!UPSELL_RE.test(raw)) continue;
      if (el.querySelector('textarea')) continue;
      el.classList.add('alice-enx-upsell');
    }
  }

  /* ---------------- limits / load notice ---------------- */
  var noticeEl = null;
  var NOTICE_RULES = [
    [/из-за высокой нагрузки/i, 'Free mode is busy — you are getting the standard model. The full Alice AI unlocks a bit later, or right away with a free Yandex login.'],
    [/это ответ менее мощной модели/i, 'You are on the free standard model. Log in with a free Yandex ID (or wait out the busy period) to unlock the full Alice AI.'],
    [/превышен лимит|слишком много запросов/i, 'Free-mode limit reached — responses pause for a while. Wait a bit, or log in to restore full access.'],
    [/попробуйте позже/i, 'Alice is overloaded right now. Try again in a minute — free access resumes automatically.']
  ];
  function scanNotices() {
    var texts = document.querySelectorAll('.Message,[data-message-role],[class*="Notice"],[class*="Banner"],[class*="banner"],[class*="Hint"],[class*="hint"],[class*="Warning"]');
    for (var i = 0; i < texts.length; i++) {
      var el = texts[i];
      var raw = el.textContent || '';
      if (raw.length > 400) continue;
      for (var j = 0; j < NOTICE_RULES.length; j++) {
        if (NOTICE_RULES[j][0].test(raw)) { showNotice(NOTICE_RULES[j][1]); return; }
      }
    }
  }
  function showNotice(message) {
    if (noticeEl && noticeEl.isConnected) {
      var txt = noticeEl.querySelector('[data-alice-enx-msg]');
      if (txt && txt.textContent === message) return;
      noticeEl.remove();
    }
    noticeEl = A.mark(document.createElement('div'));
    noticeEl.className = 'alice-enx-notice';
    var msg = document.createElement('span');
    msg.setAttribute('data-alice-enx-msg', '1');
    msg.innerHTML = '<b>Free mode:</b> ' + message.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    noticeEl.appendChild(msg);
    var open = document.createElement('button');
    open.textContent = 'Log in';
    open.addEventListener('click', function () {
      var b = document.querySelector('[data-testid="login-button"]');
      if (b) b.click(); else window.open('https://passport.yandex.ru/', '_blank');
    });
    var x = document.createElement('button');
    x.className = 'alice-enx-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', function () { if (noticeEl) noticeEl.remove(); });
    noticeEl.appendChild(open); noticeEl.appendChild(x);
    document.body.appendChild(noticeEl);
    setTimeout(function () { if (noticeEl && noticeEl.isConnected) noticeEl.remove(); }, 20000);
  }

  /* ---------------- wiring ---------------- */
  var mo2Timer = null;
  var mo2 = new MutationObserver(function () {
    if (mo2Timer) return;
    mo2Timer = setTimeout(function () {
      mo2Timer = null;
      ensureReplyTools();
      ensureChips();
      stashToPending();
      scanUpsells();
      scanNotices();
    }, 250);
  });
  function boot() {
    injectCSS();
    A.startObserver();
    A.translateDocument();
    buildModeBar();
    document.documentElement.classList.toggle('alice-enx-hide-upsell', !!S.hideUpsell);
    document.documentElement.classList.toggle('alice-enx-suggests-off', !!S.chips);
    setTimeout(function () { ensureChips(); ensureReplyTools(); scanUpsells(); }, 600);
    setTimeout(function () { ensureReplyTools(); }, 1200);
    mo2.observe(document.documentElement, { childList: true, subtree: true });
    stashToPending();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
/* Alice English Overlay — Part C: content-script bootstrap extras (MV3 popup sync) */
(function () {
  'use strict';
  var A = window.__ALICE_ENX;
  if (!A || !A.EXT) return;
  try {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === 'aliceEnxSettingsChanged') {
        chrome.storage.sync.get(A.settings, function (res) {
          Object.keys(res).forEach(function (k) {
            var next = {}; next[k] = res[k];
            A.applySettings(next);
          });
        });
      }
    });
  } catch (e) {}
})();
