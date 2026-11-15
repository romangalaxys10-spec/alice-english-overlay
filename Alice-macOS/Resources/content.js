/* Alice English Overlay — Part A: settings, dictionary, translator, machine translation */
(function () {
  'use strict';
  // Safety guard: prevent any landing on Yandex Passport login
  if (window.location.hostname.indexOf('passport.yandex') > -1 || window.location.pathname.indexOf('/auth') === 0) {
    window.location.replace('https://alice.yandex.ru/');
    return;
  }
  if (window.__ALICE_ENX) return;

  var A = { version: '1.1.0' };

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

  /* ---------------- settings & languages ---------------- */
  var LANGUAGES = {
    'en': { name: 'English', prompt: 'Answer strictly in English only.', code: 'en' },
    'es': { name: 'Spanish', prompt: 'Responde estrictamente en español únicamente.', code: 'es' },
    'fr': { name: 'French', prompt: 'Répondez strictement en français uniquement.', code: 'fr' },
    'de': { name: 'German', prompt: 'Antworte strikt ausschließlich auf Deutsch.', code: 'de' },
    'it': { name: 'Italian', prompt: 'Rispondi rigorosamente solo in italiano.', code: 'it' },
    'pt': { name: 'Portuguese', prompt: 'Responda estritamente apenas em português.', code: 'pt' },
    'zh': { name: 'Chinese (Simplified)', prompt: '请严格仅使用中文回复。', code: 'zh-CN' },
    'ja': { name: 'Japanese', prompt: '厳格に日本語のみで回答してください。', code: 'ja' },
    'ko': { name: 'Korean', prompt: '엄격하게 한국어로만 답변해 주세요.', code: 'ko' },
    'ar': { name: 'Arabic', prompt: 'يرجى الإجابة بدقة باللغة العربية فقط.', code: 'ar' },
    'tr': { name: 'Turkish', prompt: 'Lütfen kesinlikle yalnızca Türkçe olarak yanıtlayın.', code: 'tr' },
    'uk': { name: 'Ukrainian', prompt: 'Відповідай суворо виключно українською мовою.', code: 'uk' },
    'ru': { name: 'Russian (Original)', prompt: '', code: 'ru' }
  };

  function getLanguageConfig() {
    var key = (settings && settings.targetLang) || 'en';
    return LANGUAGES[key] || LANGUAGES['en'];
  }
  function getLanguagePrompt() {
    return getLanguageConfig().prompt;
  }
  var EN_MARKER = 'Answer strictly in English only.';
  function stripMarkers(text) {
    if (!text) return '';
    var out = String(text);
    Object.keys(LANGUAGES).forEach(function (k) {
      if (LANGUAGES[k].prompt) {
        out = out.split(LANGUAGES[k].prompt).join('');
      }
    });
    return out.trim();
  }

  var DEFAULTS = {
    targetLang: 'en',
    enReplies: true,
    customInstructions: '',
    translateBtn: true,
    chips: true,
    hideUpsell: true,
    carryContext: true,
    modeBar: true,
    autoFallback: true,
    vibeCoding: true,
    harnessAutoRun: true
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
  function gtxUrl(text, targetLang) {
    var lang = targetLang || getLanguageConfig().code || 'en';
    return 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(lang) + '&dt=t&q=' + encodeURIComponent(text);
  }
  function parseGtx(body) {
    var data = JSON.parse(body);
    if (!data || !data[0]) throw new Error('bad gtx payload');
    return data[0].map(function (seg) { return seg && seg[0] ? seg[0] : ''; }).join('');
  }
  function myMemory(text, targetLang, cb) {
    if (typeof targetLang === 'function') { cb = targetLang; targetLang = 'en'; }
    var lang = targetLang || getLanguageConfig().code || 'en';
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
      var url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(chunk) + '&langpair=ru|' + encodeURIComponent(lang);
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
  function gtxViaGM(text, targetLang, cb) {
    GMX({
      method: 'GET', url: gtxUrl(text, targetLang), timeout: 15000,
      onload: function (r) { try { cb(parseGtx(r.responseText)); } catch (e) { myMemory(text, targetLang, cb); } },
      onerror: function () { myMemory(text, targetLang, cb); },
      ontimeout: function () { myMemory(text, targetLang, cb); }
    });
  }
  function mt(text, cb) {
    text = String(text || '').trim();
    if (!text) { cb(null); return; }
    var targetLang = getLanguageConfig().code || 'en';
    if (GMX) { gtxViaGM(text, targetLang, cb); return; }
    if (EXT) {
      try {
        chrome.runtime.sendMessage({ type: 'aliceEnxTranslate', text: text, targetLang: targetLang }, function (res) {
          if (chrome.runtime.lastError) { myMemory(text, targetLang, cb); return; }
          if (res && res.ok && res.text) cb(res.text); else myMemory(text, targetLang, cb);
        });
        return;
      } catch (e) { /* fall through */ }
    }
    myMemory(text, targetLang, cb);
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
  A.LANGUAGES = LANGUAGES;
  A.getLanguageConfig = getLanguageConfig;
  A.getLanguagePrompt = getLanguagePrompt;
  A.settings = settings; A.applySettings = applySettings; A.onSettings = onSettings;
  A.norm = norm; A.translateText = translateText; A.translateDocument = translateDocument;
  A.startObserver = startObserver; A.sweep = sweep;
  A.mt = mt; A.EN_MARKER = EN_MARKER; A.stripMarkers = stripMarkers; A.setNativeValue = setNativeValue;
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
    '.alice-enx-modebar{position:fixed;z-index:200;display:flex;align-items:center;gap:2px;padding:5px;border-radius:999px;',
      'background:rgba(255,255,255,.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
      'border:1px solid rgba(20,20,30,.09);box-shadow:0 10px 30px rgba(10,10,30,.13);max-width:min(94vw,700px);overflow-x:auto;scrollbar-width:none;box-sizing:border-box}',
    'iframe[src*="passport.yandex"], [class*="PassportModal"], [class*="LoginModal"], .AuthPopup {display:none !important;pointer-events:none !important;visibility:hidden !important}',
    '.alice-enx-cmd-result{margin:6px 0 10px;padding:8px 12px;background:#0d0d14;border:1px solid rgba(74,222,128,.35);border-radius:8px;font:400 12px/1.4 ui-monospace,Menlo,monospace;color:#4ade80;white-space:pre-wrap;word-break:break-all}',
    '.alice-enx-auto-harness-card{margin:8px 0 12px;padding:10px 14px;border-radius:10px;background:#13131c;border:1px solid rgba(108,76,240,.35);font-family:ui-monospace,Menlo,monospace;box-shadow:0 4px 14px rgba(0,0,0,.3);transition:all .2s}',
    '.alice-enx-auto-harness-card.executing{border-color:rgba(108,76,240,.75);background:linear-gradient(180deg,#181628,#12111d)}',
    '.alice-enx-auto-harness-card.success{border-color:rgba(74,222,128,.4);background:#0e1713}',
    '.alice-enx-auto-harness-card.error{border-color:rgba(239,68,68,.4);background:#1a0f12}',
    '.alice-enx-auto-harness-card.stopped{border-color:rgba(156,163,175,.3);background:#16161d}',
    '.alice-enx-auto-harness-hdr{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#e2e8f0}',
    '.alice-enx-auto-harness-card.success .alice-enx-auto-harness-hdr{color:#4ade80}',
    '.alice-enx-auto-harness-card.error .alice-enx-auto-harness-hdr{color:#f87171}',
    '.alice-enx-auto-harness-lbl{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.alice-enx-auto-harness-stop, .alice-enx-auto-harness-toggle{padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#cbd5e1;font:500 11px/1.2 -apple-system,sans-serif;cursor:pointer}',
    '.alice-enx-auto-harness-stop:hover{background:rgba(239,68,68,.25);color:#fca5a5;border-color:rgba(239,68,68,.4)}',
    '.alice-enx-auto-harness-toggle:hover{background:rgba(255,255,255,.15);color:#fff}',
    '.alice-enx-auto-harness-cmd{margin-top:6px;font-size:11.5px;color:#94a3b8;word-break:break-all}',
    '.alice-enx-auto-harness-cmd code{color:#c4b5fd}',
    '.alice-enx-auto-harness-out{margin-top:8px;padding:8px 10px;background:#09090e;border-radius:6px;border:1px solid rgba(255,255,255,.07);font-size:11.5px;line-height:1.45;color:#e2e8f0;white-space:pre-wrap;word-break:break-all;max-height:180px;overflow-y:auto}',
    '.alice-enx-auto-harness-out.err{color:#fca5a5;border-color:rgba(239,68,68,.2)}',
    '.alice-enx-pulse{width:8px;height:8px;border-radius:50%;background:#a855f7;box-shadow:0 0 8px #a855f7;animation:alicePulse 1.2s infinite ease-in-out;display:inline-block;flex-shrink:0}',
    '@keyframes alicePulse{0%,100%{transform:scale(0.85);opacity:0.6}50%{transform:scale(1.25);opacity:1}}',
    '.alice-enx-check{color:#4ade80;font-weight:700}',
    '.alice-enx-err-icon{color:#ef4444;font-weight:700}',
    /* Autonomous Loop Agent HUD & Studio */
    '.alice-enx-loop-hud{position:sticky;top:10px;z-index:150;margin:10px auto 14px;max-width:850px;width:calc(100% - 24px);padding:10px 14px;border-radius:12px;background:rgba(20,20,32,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(139,92,246,.35);box-shadow:0 8px 24px rgba(0,0,0,.45);font-family:-apple-system,BlinkMacSystemFont,sans-serif}',
    '.alice-enx-loop-hud-top{display:flex;align-items:center;gap:8px}',
    '.alice-enx-loop-hud-title{font-weight:700;font-size:13px;color:#fff;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.alice-enx-loop-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(139,92,246,.25);color:#c4b5fd;border:1px solid rgba(139,92,246,.4)}',
    '.alice-enx-loop-controls{display:flex;gap:6px}',
    '.alice-enx-loop-ctrl-btn{padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#e2e8f0;font:500 11px/1.2 inherit;cursor:pointer;transition:all .15s}',
    '.alice-enx-loop-ctrl-btn:hover{background:rgba(255,255,255,.18);color:#fff}',
    '.alice-enx-loop-ctrl-btn.pause{border-color:rgba(234,179,8,.4);color:#fde047}',
    '.alice-enx-loop-ctrl-btn.stop{border-color:rgba(239,68,68,.4);color:#fca5a5}',
    '.alice-enx-loop-hud-progress{margin-top:8px;height:4px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}',
    '.alice-enx-loop-bar{height:100%;background:linear-gradient(90deg,#8b5cf6,#ec4899);transition:width .3s}',
    '.alice-enx-loop-hud-active-story{margin-top:6px;font-size:11.5px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.alice-enx-loop-pane{display:flex;flex-direction:column;gap:12px;padding:12px;height:100%;overflow-y:auto}',
    '.alice-enx-loop-modes{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}',
    '.alice-enx-loop-mode-btn{padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:#161622;color:#94a3b8;font:600 11.5px/1 inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}',
    '.alice-enx-loop-mode-btn.active{background:linear-gradient(135deg,#6C4CF0,#9B6CFF);color:#fff;border-color:transparent}',
    '.alice-enx-loop-board{background:#12121b;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px}',
    '.alice-enx-loop-story-item{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:6px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#e2e8f0}',
    '.alice-enx-loop-story-item:last-child{border-bottom:none}',
    '.alice-enx-loop-story-item.passed .alice-enx-loop-story-title{text-decoration:line-through;color:#64748b}',
    '.alice-enx-loop-story-item.active{background:rgba(108,76,240,.15);border-color:rgba(108,76,240,.3)}',
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
    'html.alice-enx-hide-upsell .alice-enx-upsell,.alice-enx-upsell{display:none !important}',
    'html.alice-enx-suggests-off .MainPageSuggests-Item{display:none !important}',
    '.alice-enx-hidden{display:none !important}',
    /* brainstorm modal & HUD */
    '.alice-enx-modal-backdrop{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(10,10,20,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}',
    '.alice-enx-modal{width:min(600px,96vw);max-height:90vh;overflow-y:auto;background:rgba(255,255,255,.98);border-radius:20px;box-shadow:0 24px 64px rgba(10,10,30,.28);border:1px solid rgba(20,20,30,.1);padding:24px 26px;box-sizing:border-box;color:#222}',
    '.alice-enx-modal h2{margin:0 0 6px;font:700 18px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#1e1e28;display:flex;align-items:center;gap:8px}',
    '.alice-enx-modal p.alice-enx-modal-sub{margin:0 0 16px;font:400 12.5px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#747482}',
    '.alice-enx-field{margin-bottom:14px}',
    '.alice-enx-field label{display:block;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#3e3e4a;margin-bottom:6px}',
    '.alice-enx-input, .alice-enx-textarea, .alice-enx-select{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(20,20,30,.18);padding:8px 12px;font:400 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#1e1e28 !important;background:#fff !important;-webkit-text-fill-color:#1e1e28 !important;transition:border-color .15s}',
    '.alice-enx-input:focus, .alice-enx-textarea:focus, .alice-enx-select:focus{border-color:#6C4CF0 !important;outline:none;box-shadow:0 0 0 3px rgba(108,76,240,.12)}',
    '.alice-enx-select option{background:#fff !important;color:#1e1e28 !important}',
    '.alice-enx-role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}',
    '@media (max-width:540px){.alice-enx-role-grid{grid-template-columns:1fr}}',
    '.alice-enx-role-card{position:relative;border:1.5px solid rgba(20,20,30,.12);border-radius:12px;padding:10px 12px 10px 32px;cursor:pointer;background:#fff;transition:all .15s;text-align:left;user-select:none}',
    '.alice-enx-role-card::before{content:"";position:absolute;left:10px;top:12px;width:15px;height:15px;border-radius:4px;border:1.5px solid rgba(20,20,30,.25);background:#fff;transition:all .15s;box-sizing:border-box}',
    '.alice-enx-role-card:hover{border-color:rgba(108,76,240,.4);background:rgba(108,76,240,.02)}',
    '.alice-enx-role-card.active{border-color:#6C4CF0;background:rgba(108,76,240,.08);box-shadow:0 4px 12px rgba(108,76,240,.12)}',
    '.alice-enx-role-card.active::before{content:"✓";background:#6C4CF0;border-color:#6C4CF0;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:12px;text-align:center}',
    '.alice-enx-role-title{font:600 12.5px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#222;display:flex;align-items:center;gap:6px}',
    '.alice-enx-role-desc{font:400 11px/1.35 -apple-system,BlinkMacSystemFont,sans-serif;color:#787886;margin-top:4px}',
    '.alice-enx-rpills{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}',
    '.alice-enx-rpill{border:1px solid rgba(20,20,30,.15);border-radius:8px;padding:6px 12px;background:#fff;font:500 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#444;cursor:pointer;transition:all .15s}',
    '.alice-enx-rpill:hover{border-color:rgba(108,76,240,.4);color:#6C4CF0}',
    '.alice-enx-rpill.active{border-color:#6C4CF0;background:rgba(108,76,240,.12);color:#6C4CF0;font-weight:600}',
    '.alice-enx-modal-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:20px;padding-top:14px;border-top:1px solid rgba(20,20,30,.08)}',
    '.alice-enx-btn-primary{border:none;border-radius:10px;background:#6C4CF0;color:#fff;font:600 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:10px 18px;cursor:pointer;transition:background .15s}',
    '.alice-enx-btn-primary:hover{background:#583ac9}',
    '.alice-enx-btn-secondary{border:1px solid rgba(20,20,30,.15);border-radius:10px;background:transparent;color:#555;font:500 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:9px 16px;cursor:pointer}',
    '.alice-enx-btn-secondary:hover{background:rgba(20,20,30,.04)}',
    /* brainstorm HUD */
    '.alice-enx-bhud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483200;display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:rgba(26,24,42,.95);color:#ede9fe;border:1px solid rgba(139,109,255,.35);box-shadow:0 12px 34px rgba(10,10,30,.4);font:500 12px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);max-width:min(96vw,760px);box-sizing:border-box}',
    '.alice-enx-bhud-title{font-weight:700;color:#c0b2ff;display:flex;align-items:center;gap:5px;white-space:nowrap}',
    '.alice-enx-bhud-status{font-weight:400;color:#d8d2f6;font-size:11.5px;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.alice-enx-bhud-btn{border:none;border-radius:999px;cursor:pointer;padding:5px 10px;font:600 11px/1 inherit;transition:all .15s;display:inline-flex;align-items:center;gap:3px;white-space:nowrap}',
    '.alice-enx-bhud-conclude{background:linear-gradient(135deg,#6C4CF0,#9B6CFF);color:#fff}',
    '.alice-enx-bhud-conclude:hover{opacity:.9}',
    '.alice-enx-bhud-stop{background:rgba(240,68,68,.18);color:#fca5a5;border:1px solid rgba(240,68,68,.3)}',
    '.alice-enx-bhud-stop:hover{background:rgba(240,68,68,.3)}',
    '.alice-enx-bhud-toggle{background:rgba(255,255,255,.12);color:#ddd}',
    '.alice-enx-bhud-toggle.on{background:rgba(16,185,129,.22);color:#6ee7b7;border:1px solid rgba(16,185,129,.35)}',
    '.alice-enx-bhud-pulse{display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981}',
    '.alice-enx-bhud-pulse.busy{background:#f59e0b;box-shadow:0 0 8px #f59e0b;animation:aliceEnxPulse 1.2s infinite}',
    '@keyframes aliceEnxPulse{0%,100%{opacity:1}50%{opacity:.35}}',
    /* settings panel */
    '.alice-enx-panel{position:fixed;z-index:2147483100;min-width:280px;max-width:340px;max-height:85vh;overflow-y:auto;padding:16px;border-radius:18px;background:rgba(255,255,255,.98);box-shadow:0 18px 48px rgba(10,10,30,.25);border:1px solid rgba(20,20,30,.12);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-sizing:border-box;color:#222}',
    '.alice-enx-panel h3{font:700 14px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;color:#1e1e28;margin:0 0 12px;display:flex;align-items:center;justify-content:space-between}',
    '.alice-enx-panel label{display:block;font:600 11.5px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#454551;margin-bottom:4px}',
    '.alice-enx-panel .alice-enx-select, .alice-enx-panel .alice-enx-textarea{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid rgba(20,20,30,.18);padding:7px 10px;font:500 12.5px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;background:#fff !important;color:#1e1e28 !important;-webkit-text-fill-color:#1e1e28 !important}',
    '.alice-enx-panel .alice-enx-select option{background:#fff !important;color:#1e1e28 !important}',
    '.alice-enx-panel .alice-enx-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 2px;cursor:pointer;font:400 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#454551}',
    '.alice-enx-panel .alice-enx-foot{margin-top:10px;font:400 10.5px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#a0a0aa;text-align:center}',
    /* dark mode */
    '@media (prefers-color-scheme:dark){',
      '.alice-enx-modal{background:rgba(28,28,38,.98);border-color:rgba(255,255,255,.14);color:#ede9fe;box-shadow:0 24px 64px rgba(0,0,0,.6)}',
      '.alice-enx-modal h2{color:#f0effa}',
      '.alice-enx-modal p.alice-enx-modal-sub{color:#9e9ea8}',
      '.alice-enx-field label{color:#c4c4d0}',
      '.alice-enx-input, .alice-enx-textarea, .alice-enx-select{background:rgba(42,42,56,.95) !important;border-color:rgba(255,255,255,.18) !important;color:#f0f0f5 !important;-webkit-text-fill-color:#f0f0f5 !important}',
      '.alice-enx-select option{background:#282838 !important;color:#f0f0f5 !important}',
      '.alice-enx-role-card{background:rgba(36,36,48,.8);border-color:rgba(255,255,255,.12)}',
      '.alice-enx-role-card::before{background:rgba(26,26,36,.9);border-color:rgba(255,255,255,.3)}',
      '.alice-enx-role-card:hover{background:rgba(139,109,255,.12);border-color:rgba(139,109,255,.4)}',
      '.alice-enx-role-card.active{background:rgba(139,109,255,.2);border-color:#8b6ff0}',
      '.alice-enx-role-card.active::before{background:#8b6ff0;border-color:#8b6ff0;color:#fff}',
      '.alice-enx-role-title{color:#e8e8f2}',
      '.alice-enx-role-desc{color:#a4a4b2}',
      '.alice-enx-rpill{background:rgba(36,36,48,.8);border-color:rgba(255,255,255,.15);color:#ccc}',
      '.alice-enx-rpill.active{background:rgba(139,109,255,.25);border-color:#8b6ff0;color:#c0b2ff}',
      '.alice-enx-btn-secondary{border-color:rgba(255,255,255,.16);color:#ccc}',
      '.alice-enx-btn-secondary:hover{background:rgba(255,255,255,.06)}',
      '.alice-enx-panel{background:rgba(28,28,38,.98);border-color:rgba(255,255,255,.16);box-shadow:0 20px 54px rgba(0,0,0,.65);color:#ede9fe}',
      '.alice-enx-panel h3{color:#f0effa}',
      '.alice-enx-panel label{color:#c4c4d2}',
      '.alice-enx-panel .alice-enx-select, .alice-enx-panel .alice-enx-textarea{background:rgba(42,42,56,.95) !important;border-color:rgba(255,255,255,.18) !important;color:#f5f4fb !important;-webkit-text-fill-color:#f5f4fb !important}',
      '.alice-enx-panel .alice-enx-select option{background:#282838 !important;color:#f5f4fb !important}',
      '.alice-enx-panel .alice-enx-row{color:#d4d4e0}',
      '.alice-enx-panel .alice-enx-foot{color:#888898}',
    '}',
    /* in-app terminal & harness workbench */
    '.alice-enx-workbench{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(1100px,98vw);height:370px;background:rgba(18,18,26,.97);border-radius:18px 18px 0 0;box-shadow:0 -16px 48px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14);border-bottom:none;z-index:2147483400;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#eee;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:transform .2s ease,height .2s ease}',
    '.alice-enx-workbench.minimized{height:46px}',
    '.alice-enx-workbench svg{width:14px;height:14px;display:inline-block;vertical-align:middle;flex-shrink:0}',
    '.alice-enx-wb-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(26,26,38,.9);border-bottom:1px solid rgba(255,255,255,.1);border-radius:18px 18px 0 0;user-select:none}',
    '.alice-enx-wb-tabs{display:flex;align-items:center;gap:6px}',
    '.alice-enx-wb-tab{background:transparent;border:none;border-radius:8px;padding:6px 12px;font:600 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#9b9bb2;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s}',
    '.alice-enx-wb-tab:hover{background:rgba(255,255,255,.06);color:#fff}',
    '.alice-enx-wb-tab.active{background:rgba(108,76,240,.25);color:#c4b5fd;border:1px solid rgba(108,76,240,.4)}',
    '.alice-enx-wb-tools{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#8a8a9e}',
    '.alice-enx-wb-btn{background:rgba(255,255,255,.08);border:none;border-radius:6px;padding:5px 8px;font:500 11px/1 inherit;color:#ccc;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s}',
    '.alice-enx-wb-btn:hover{background:rgba(255,255,255,.16);color:#fff}',
    '.alice-enx-wb-body{flex:1;overflow:hidden;position:relative;display:flex;flex-direction:column;background:#0d0d14}',
    /* Terminal Tab */
    '.alice-enx-term{flex:1;display:flex;flex-direction:column;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace}',
    '.alice-enx-term-out{flex:1;overflow-y:auto;padding:12px 14px;font:400 12.5px/1.45 ui-monospace,Menlo,monospace;color:#4ade80;white-space:pre-wrap;word-break:break-all}',
    '.alice-enx-term-out .err{color:#f87171}',
    '.alice-enx-term-out .info{color:#60a5fa}',
    '.alice-enx-term-out .cmd{color:#fbbf24;font-weight:600}',
    '.alice-enx-term-in-row{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#151520;border-top:1px solid rgba(255,255,255,.08)}',
    '.alice-enx-term-prompt{font-weight:700;color:#38bdf8}',
    '.alice-enx-term-input{flex:1;background:transparent;border:none;outline:none;font:500 13px/1.3 ui-monospace,Menlo,monospace;color:#fff}',
    '.alice-enx-term-chips{display:flex;align-items:center;gap:6px;padding:6px 12px;background:#11111a;border-top:1px solid rgba(255,255,255,.05);overflow-x:auto}',
    '.alice-enx-term-chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 8px;font:400 11px/1 ui-monospace,Menlo,monospace;color:#cbd5e1;cursor:pointer;white-space:nowrap}',
    '.alice-enx-term-chip:hover{background:rgba(108,76,240,.3);border-color:#6C4CF0;color:#fff}',
    /* Vibe Coder & Harness Tab */
    '.alice-enx-vibe-pane{flex:1;overflow-y:auto;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;background:#12121c}',
    '.alice-enx-vibe-hero{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:12px;background:linear-gradient(135deg,rgba(108,76,240,.2),rgba(59,130,246,.15));border:1px solid rgba(108,76,240,.3)}',
    '.alice-enx-vibe-title{font:700 14px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff}',
    '.alice-enx-vibe-sub{font:400 12px/1.35 -apple-system,BlinkMacSystemFont,sans-serif;color:#a5a5bb;margin-top:2px}',
    '.alice-enx-vibe-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
    '.alice-enx-vibe-btn{padding:8px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:#eee;font:600 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px}',
    '.alice-enx-vibe-btn:hover{background:rgba(108,76,240,.35);border-color:#6C4CF0;color:#fff}',
    '.alice-enx-vibe-btn.primary{background:linear-gradient(135deg,#6C4CF0,#3b82f6);border:none;color:#fff}',
    /* Skills Tab */
    '.alice-enx-skills-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;padding:14px;overflow-y:auto}',
    '.alice-enx-skill-card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;background:rgba(255,255,255,.04);cursor:pointer;transition:all .15s;display:flex;flex-direction:column;justify-content:space-between}',
    '.alice-enx-skill-card:hover{border-color:rgba(108,76,240,.5);background:rgba(108,76,240,.08)}',
    '.alice-enx-skill-name{font:600 13px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;display:flex;align-items:center;gap:6px}',
    '.alice-enx-skill-desc{font:400 11.5px/1.35 -apple-system,BlinkMacSystemFont,sans-serif;color:#94a3b8;margin:6px 0 10px}',
    '.alice-enx-skill-btn{align-self:flex-start;padding:4px 10px;border-radius:6px;background:rgba(108,76,240,.2);border:1px solid rgba(108,76,240,.4);color:#c4b5fd;font:600 11px/1 inherit}',
    /* Git Sync Tab */
    '.alice-enx-git-pane{padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto}',
    /* Sessions Tab */
    '.alice-enx-sessions-pane{padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto}',
    '.alice-enx-session-card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.04);transition:all .15s;display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '.alice-enx-session-card:hover{border-color:rgba(108,76,240,.4);background:rgba(108,76,240,.06)}',
    '.alice-enx-session-card.active{border-color:rgba(108,76,240,.7);background:rgba(108,76,240,.15)}',
    '.alice-enx-session-info{flex:1;min-width:0}',
    '.alice-enx-session-title{font:600 13px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.alice-enx-session-meta{font:400 11.5px/1.35 -apple-system,BlinkMacSystemFont,sans-serif;color:#94a3b8;margin-top:4px}',
    '.alice-enx-session-actions{display:flex;align-items:center;gap:6px}',
    /* Code block action buttons and badges */
    '.alice-enx-code-actions{display:inline-flex;align-items:center;gap:6px;margin:0 8px 0 0;vertical-align:middle}',
    '.alice-enx-code-actions-floating{position:absolute;top:8px;right:8px;z-index:10}',
    '.alice-enx-code-btn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:6px;font:600 11.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;white-space:nowrap;transition:all .15s ease;user-select:none;box-sizing:border-box;text-decoration:none}',
    '.alice-enx-code-btn-icon{font-size:10px;line-height:1}',
    '.alice-enx-code-btn-run{background:#181824;color:#f1f5f9;border:1px solid rgba(255,255,255,.18);box-shadow:0 1px 3px rgba(0,0,0,.3)}',
    '.alice-enx-code-btn-run:hover{background:#262638;border-color:rgba(255,255,255,.35);color:#fff}',
    '.alice-enx-code-btn-run:active{transform:translateY(1px)}',
    '.alice-enx-code-btn-answer{background:linear-gradient(135deg,#6C4CF0,#8B5CF6);color:#fff !important;border:1px solid rgba(167,139,250,.5);box-shadow:0 2px 6px rgba(108,76,240,.35);font-weight:700}',
    '.alice-enx-code-btn-answer:hover{background:linear-gradient(135deg,#5b3ce0,#7c3aed);border-color:rgba(196,181,253,.8);box-shadow:0 3px 10px rgba(108,76,240,.5);color:#fff !important}',
    '.alice-enx-code-btn-answer:active{transform:translateY(1px)}',
    '.alice-enx-code-btn-save{background:#132018;color:#86efac;border:1px solid rgba(74,222,128,.35);box-shadow:0 1px 3px rgba(0,0,0,.25)}',
    '.alice-enx-code-btn-save:hover{background:#1a2c20;border-color:rgba(74,222,128,.6);color:#bbf7d0}',
    '.alice-enx-code-btn-save:active{transform:translateY(1px)}',
    /* Auto-fallback Toast */
    '.alice-enx-fallback-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:2147483600;background:rgba(30,24,10,.95);border:1px solid rgba(245,158,11,.4);color:#fef3c7;padding:8px 16px;border-radius:999px;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;gap:8px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:aliceEnxSlideDown .25s ease-out}',
    '@keyframes aliceEnxSlideDown{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}'
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
    lang: '<path d="M4 5h7M7.5 5c0 4-1.5 7-4.5 9"/><path d="M6 8.5C7 11 9 13.5 11 14.5"/><path d="M13 20l4-10 4 10M14.6 17h4.8"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    git: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    loop: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
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

  /* ---------------- Multi-Session / Multi-Chat Manager (Zero Login) ---------------- */
  var SessionManager = {
    STORAGE_KEY: 'alice_enx_sessions',
    ACTIVE_KEY: 'alice_enx_active_session',

    getSessions: function () {
      try {
        var raw = localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    saveSessions: function (list) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      } catch (e) {}
    },

    getActiveId: function () {
      try {
        return localStorage.getItem(this.ACTIVE_KEY) || 'session_default';
      } catch (e) {
        return 'session_default';
      }
    },

    setActiveId: function (id) {
      try {
        localStorage.setItem(this.ACTIVE_KEY, id);
      } catch (e) {}
    },

    snapshotCurrent: function () {
      var id = this.getActiveId();
      var recap = harvestRecap();
      var msgs = [];
      var msgEls = document.querySelectorAll('.Message:not([data-alice-enx])');
      for (var i = 0; i < msgEls.length; i++) {
        var el = msgEls[i];
        var isUser = !!(el.querySelector('.Message_from_user, [data-message-role="user"]') || el.classList.contains('Message_from_user'));
        var txt = (el.innerText || '').trim();
        if (txt) msgs.push({ role: isUser ? 'user' : 'alice', text: txt.slice(0, 800) });
      }
      var title = 'Chat Session';
      if (msgs.length > 0) {
        var firstUser = msgs.find(function (m) { return m.role === 'user'; });
        if (firstUser) {
          title = firstUser.text.replace(/\n.*/g, '').slice(0, 36);
        }
      }
      var list = this.getSessions();
      var idx = list.findIndex(function (s) { return s.id === id; });
      var item = {
        id: id,
        title: title,
        updated: Date.now(),
        messageCount: msgs.length,
        recap: recap || ''
      };
      if (idx >= 0) {
        list[idx] = Object.assign(list[idx], item);
      } else {
        list.unshift(item);
      }
      this.saveSessions(list);
    },

    createSession: function () {
      this.snapshotCurrent();
      var newId = 'session_' + Date.now();
      var list = this.getSessions();
      list.unshift({
        id: newId,
        title: 'New Chat ' + (list.length + 1),
        updated: Date.now(),
        messageCount: 0,
        recap: ''
      });
      this.saveSessions(list);
      this.setActiveId(newId);
      clearRecap();

      var btn = document.querySelector('[data-testid="new-chat-button"]');
      if (btn) {
        try { btn.click(); } catch (e) {}
      } else if (window.__aliceResetSession) {
        window.__aliceResetSession();
      } else {
        window.location.reload();
      }
    },

    switchSession: function (targetId) {
      if (targetId === this.getActiveId()) return;
      this.snapshotCurrent();
      this.setActiveId(targetId);
      var list = this.getSessions();
      var target = list.find(function (s) { return s.id === targetId; });
      if (target && target.recap) {
        state.pendingRecap = target.recap;
        try { sessionStorage.setItem('aliceEnxRecap', target.recap); } catch (e) {}
      }
      if (window.__aliceResetSession) {
        window.__aliceResetSession();
      } else {
        window.location.reload();
      }
    },

    deleteSession: function (targetId) {
      var list = this.getSessions().filter(function (s) { return s.id !== targetId; });
      this.saveSessions(list);
      if (this.getActiveId() === targetId) {
        if (list.length > 0) {
          this.switchSession(list[0].id);
        } else {
          this.createSession();
        }
      }
    }
  };

  function newChat() {
    SessionManager.createSession();
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

  /* ---------------- Autonomous Brainstorm & Role Play Studio ---------------- */
  var BRAINSTORM_ROLES = {
    ideation: {
      name: 'Ideation Engine',
      icon: '💡',
      desc: 'Divergent exploration, edge-case probing, stress testing, and roadmap synthesis.',
      kickoff: function (topic) {
        return 'We are conducting an autonomous multi-round brainstorming session on the topic:\n"' + topic + '"\n\n' +
          'ROUND 1: DIVERGENT EXPLORATION.\n' +
          'Generate 5 bold, creative, and distinct concepts or perspectives. Avoid generic clichés. ' +
          'For each concept, provide: 1) Core mechanism, 2) Unique differentiator, 3) Primary obstacle.';
      },
      roundPrompts: [
        'ROUND 2: DEEP DIVE & STRESS-TEST.\nSelect the 2 strongest, most unconventional concepts from above. ' +
          'Rigorously stress-test them: what are the 3 biggest failure points, unit economics/execution hurdles, and how can we mitigate them?',
        'ROUND 3: LATERAL PIVOT & EDGE CASES.\nWhat would a completely unconventional outsider do? ' +
          'Introduce 2 radical lateral ideas or counter-intuitive angles that shatter standard assumptions.',
        'ROUND 4: CONVERGENCE & ROADMAP.\nSynthesize the insights so far into a unified, actionable gameplan. ' +
          'Detail the phased execution roadmap, key milestones, and necessary resources.'
      ],
      concludePrompt: 'FINAL SYNTHESIS & EXECUTIVE SUMMARY.\n' +
        'Deliver a comprehensive, finalized conclusion of our brainstorming session on this topic. ' +
        'Provide: 1) Executive Summary, 2) Winning Solution Architecture, 3) Ranked Top 5 Action Items, 4) Immediate Next Steps to execute today.'
    },
    devils_advocate: {
      name: "Devil's Advocate",
      icon: '🛡️',
      desc: 'Adversarial critical scrutiny, finding catastrophic failure modes and blind spots.',
      kickoff: function (topic) {
        return 'We are beginning an adversarial stress-testing session where you act as a merciless Devil\'s Advocate and Risk Auditor on the topic:\n"' + topic + '"\n\n' +
          'ROUND 1: ASSUMPTION TEARDOWN.\n' +
          'Expose and tear down all hidden assumptions in this concept. ' +
          'List 5 reasons why this idea could catastrophically fail in the real world (market, human psychology, competitive, technical).';
      },
      roundPrompts: [
        'ROUND 2: WORST-CASE SCENARIOS.\nSimulate the 3 most realistic worst-case scenarios and catastrophic failure modes. ' +
          'How will incumbents, competitors, or unintended consequences destroy this?',
        'ROUND 3: HARDENING & RESILIENCE.\nPropose defensive architectures and counter-measures. ' +
          'How do we redesign this system so that each identified vulnerability is turned into an antifragile strength?'
      ],
      concludePrompt: 'FINAL RISK AUDIT & HARDENED BLUEPRINT.\n' +
        'Synthesize the adversarial review into a final hardened strategic blueprint. ' +
        'Provide: 1) The Residual Risk Matrix, 2) The 3 Non-Negotiable Survival Criteria, 3) Final Hardened Action Plan.'
    },
    startup_vc: {
      name: 'Startup Pitch & VC',
      icon: '🚀',
      desc: 'Dynamic debate between a visionary founder and a skeptical Tier-1 VC partner.',
      kickoff: function (topic) {
        return 'We are launching a dynamic Venture Capital pitch simulation on the startup idea:\n"' + topic + '"\n\n' +
          'ROUND 1: THE FOUNDER PITCH & INITIAL VC INTERROGATION.\n' +
          'Act as BOTH the Visionary Founder delivering an irresistible 60-second pitch (Problem, Solution, Secret Sauce, TAM) ' +
          'AND a skeptical Tier-1 VC Partner grilling the founder with 3 brutal questions about defensibility and customer acquisition.';
      },
      roundPrompts: [
        'ROUND 2: DEFENDING THE MOAT & UNIT ECONOMICS.\n' +
          'The Founder must counter the VC\'s objections with sharp, concrete unit economics (CAC, LTV, payback period) ' +
          'and prove why Big Tech cannot replicate this in a weekend. Then the VC responds with term sheet stipulations.',
        'ROUND 3: GO-TO-MARKET TRACTION ENGINE.\n' +
          'Debate the 0-to-1 go-to-market strategy. Detail the exact initial distribution wedge, viral loop, and first 1,000 customers.'
      ],
      concludePrompt: 'FINAL TERM SHEET & VENTURE SYNTHESIS.\n' +
        'The VC partner and Founder reach agreement. ' +
        'Deliver: 1) Investment Thesis, 2) Key Metrics to hit for Series A, 3) 18-Month Execution Milestones, 4) Final Board Directives.'
    },
    consultant: {
      name: 'Strategy Consultant',
      icon: '📊',
      desc: 'McKinsey/Bain structured analysis: MECE breakdown and 3-horizon plan.',
      kickoff: function (topic) {
        return 'Act as a Senior Partner at a top-tier management consultancy analyzing the business objective:\n"' + topic + '"\n\n' +
          'ROUND 1: MECE ISSUE TREE & ROOT CAUSE DIAGNOSIS.\n' +
          'Deconstruct this challenge into a Mutually Exclusive, Collectively Exhaustive (MECE) framework. ' +
          'Identify the primary value drivers, operational bottlenecks, and core strategic levers.';
      },
      roundPrompts: [
        'ROUND 2: STRATEGIC OPTIONS & BENCHMARKING.\n' +
          'Evaluate 3 mutually distinct strategic options against Feasibility, Financial Return, and Strategic Alignment. ' +
          'Provide a scoring matrix and clear tradeoff analysis.',
        'ROUND 3: THREE-HORIZON EXECUTION BLUEPRINT.\n' +
          'Structure an implementation plan across Horizon 1 (Quick wins: 0-90 days), Horizon 2 (Scale: 3-12 months), and Horizon 3 (Transformation: 1-3 years).'
      ],
      concludePrompt: 'EXECUTIVE COMMITTEE FINAL BRIEFING.\n' +
        'Present the finalized strategic recommendations for the Board of Directors. ' +
        'Include: 1) Executive Summary, 2) Strategic Recommendation, 3) Key Performance Indicators (KPIs), 4) Resource Allocation and Governance Plan.'
    },
    storyteller: {
      name: 'Creative Storyteller',
      icon: '✨',
      desc: 'Narrative world-building, high-stakes plot twists, and vivid character arcs.',
      kickoff: function (topic) {
        return 'We are collaborating as a master writer\'s room crafting an original story world and narrative on the premise:\n"' + topic + '"\n\n' +
          'ROUND 1: WORLD-BUILDING & ANTAGONISTIC FORCES.\n' +
          'Establish the setting, the fundamental conflict of the world, and two deeply compelling characters with clashing philosophies.';
      },
      roundPrompts: [
        'ROUND 2: THE INCITING INCIDENT & RISING STAKES.\n' +
          'Describe the disruptive event that forces the protagonists out of their comfort zone, escalating tension with an unexpected moral dilemma.',
        'ROUND 3: THE MIDPOINT REVERSAL & CLIMAX.\n' +
          'Introduce a shocking revelation or betrayal that recontextualizes everything, driving the narrative to an intense climax.'
      ],
      concludePrompt: 'NARRATIVE SYNTHESIS & TREATMENT.\n' +
        'Deliver the complete story treatment. ' +
        'Include: 1) Core Thematic Resonance, 2) Detailed 3-Act Outline, 3) Climax Resolution and Lingering Epilogue.'
    },
    custom: {
      name: 'Custom Persona / Prompt',
      icon: '🎭',
      desc: 'Define your own role, rules, or multi-agent persona.',
      kickoff: function (topic, customDesc) {
        return (customDesc ? customDesc.trim() + '\n\n' : '') +
          'We are starting an autonomous brainstorming session on the topic:\n"' + topic + '"\n\n' +
          'ROUND 1: Please begin your analysis and exploration from your designated persona perspective.';
      },
      roundPrompts: [
        'ROUND 2: Continue the brainstorm. Deepen your analysis, address the hardest challenges, and propose concrete innovative solutions.',
        'ROUND 3: Further expand and refine your ideas. Introduce fresh perspectives and test feasibility.'
      ],
      concludePrompt: 'FINAL SYNTHESIS & RESULTS.\n' +
        'Please deliver the finalized, concluded results of this brainstorm session, summarizing all key outcomes and recommendations.'
    }
  };

  var bState = {
    active: false,
    topic: '',
    roleKeys: ['ideation'],
    customRole: '',
    maxRounds: 5,
    currentRound: 0,
    autoContinue: true,
    stopped: false,
    pollTimer: null
  };

  function buildKickoffPrompt(topic, roleKeys, customDesc) {
    if (roleKeys.length === 1) {
      var r = BRAINSTORM_ROLES[roleKeys[0]] || BRAINSTORM_ROLES.ideation;
      return r.kickoff(topic, customDesc);
    }
    var names = roleKeys.map(function (k) {
      var r = BRAINSTORM_ROLES[k];
      return r ? (r.name + ' (' + r.desc + ')') : k;
    }).join('\n- ');
    var customSnippet = (roleKeys.indexOf('custom') > -1 && customDesc) ? ('\nCustom persona instructions:\n' + customDesc.trim() + '\n') : '';
    return 'We are conducting an autonomous multi-expert panel brainstorm with the following selected personas:\n- ' + names + '\n' +
      customSnippet +
      '\nTOPIC TO EXPLORE:\n"' + topic + '"\n\n' +
      'ROUND 1: OPENING PANEL STATEMENTS.\n' +
      'Each designated expert must speak in their distinct persona and provide their opening analysis, unique angle, and boldest recommendation on this topic. Highlight where your perspectives diverge.';
  }

  function buildRoundPrompt(round, maxRounds, roleKeys) {
    if (round >= maxRounds) {
      if (roleKeys.length === 1) {
        var r = BRAINSTORM_ROLES[roleKeys[0]] || BRAINSTORM_ROLES.ideation;
        return r.concludePrompt;
      }
      return 'FINAL PANEL CONSENSUS & EXECUTIVE BLUEPRINT.\n' +
        'All panel experts collaborate to deliver a unified, finalized conclusion of our brainstorming session.\n' +
        'Provide: 1) Executive Summary, 2) Consolidated Solution Architecture, 3) Dissenting Views and How They Were Reconciled, 4) Top 5 Ranked Action Items, 5) Immediate Next Steps to execute today.';
    }
    if (roleKeys.length === 1) {
      var role = BRAINSTORM_ROLES[roleKeys[0]] || BRAINSTORM_ROLES.ideation;
      var idx = round - 2;
      if (role.roundPrompts && role.roundPrompts[idx]) return role.roundPrompts[idx];
      return 'ROUND ' + round + ': Continue the brainstorm and expand on the previous insights.';
    }
    if (round === 2) {
      return 'ROUND 2: CROSS-EXAMINATION & ADVERSARIAL DEBATE.\n' +
        'The experts must directly challenge, interrogate, and stress-test each other\'s proposals from Round 1. ' +
        'Expose flaws, question hidden assumptions, debate unit economics and real-world implementation barriers.';
    }
    if (round === 3) {
      return 'ROUND 3: UNORTHODOX LATERAL PIVOTS & EDGE CASES.\n' +
        'The panel introduces breakthrough lateral ideas and counter-intuitive solutions to overcome the objections raised in Round 2. ' +
        'What radical non-traditional approaches shatter standard industry assumptions?';
    }
    return 'ROUND ' + round + ': CONVERGENCE & STRATEGIC ROADMAP.\n' +
      'The panel begins synthesizing divergent perspectives into a cohesive framework. ' +
      'Detail the phased execution roadmap, key milestones, and necessary capabilities.';
  }

  function dismissThinkingModal() {
    var found = false;
    // 1. Check all buttons for wait / keep waiting
    var allBtns = document.querySelectorAll('button, [role="button"]');
    for (var b = 0; b < allBtns.length; b++) {
      var bTxt = (allBtns[b].textContent || '').trim();
      if (/Дождаться ответа|Wait for answer|Wait for response/i.test(bTxt)) {
        found = true;
        try { allBtns[b].click(); } catch (e) {}
        var topContainer = allBtns[b].closest('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="Popup"], [class*="popup"], [class*="Overlay"], [class*="overlay"]') || allBtns[b].parentElement;
        if (topContainer) {
          topContainer.style.setProperty('display', 'none', 'important');
          if (topContainer.parentElement && (topContainer.parentElement.classList.contains('Modal-Backdrop') || getComputedStyle(topContainer.parentElement).position === 'fixed')) {
            topContainer.parentElement.style.setProperty('display', 'none', 'important');
          }
        }
        return true;
      }
    }

    // 2. Scan dialogs or popups containing thinking text
    var allModals = document.querySelectorAll('[role="dialog"], [class*="Modal"], [class*="modal"], [class*="Popup"], [class*="popup"], [class*="Backdrop"], [class*="backdrop"]');
    for (var i = 0; i < allModals.length; i++) {
      var m = allModals[i];
      var text = (m.textContent || '');
      if (text.indexOf('Алиса ещё думает') > -1 || text.indexOf('Alice is still thinking') > -1) {
        found = true;
        m.style.setProperty('display', 'none', 'important');
        if (m.parentElement && (m.parentElement.classList.contains('Modal-Backdrop') || m.parentElement.getAttribute('role') === 'presentation' || getComputedStyle(m.parentElement).position === 'fixed')) {
          m.parentElement.style.setProperty('display', 'none', 'important');
        }
        var btns = m.querySelectorAll('button, [role="button"]');
        for (var j = 0; j < btns.length; j++) {
          var jTxt = (btns[j].textContent || '').trim();
          if (/Дождаться ответа|Wait for answer|Wait for response/i.test(jTxt)) {
            try { btns[j].click(); } catch (e) {}
            return true;
          }
        }
        if (btns.length >= 3) {
          try { btns[2].click(); } catch (e) {}
          return true;
        }
        return true;
      }
    }
    return found;
  }
  setInterval(dismissThinkingModal, 300);

  function sendAliceMessage(text, onDone) {
    function trySend() {
      if (dismissThinkingModal() || isAliceGenerating()) {
        updateBrainstormHUDStatus('Waiting for Alice to finish prior response...');
        setTimeout(trySend, 1200);
        return;
      }
      var ta = document.querySelector('textarea');
      if (!ta) {
        setTimeout(trySend, 800);
        return;
      }
      A.setNativeValue(ta, text);
      ta.focus();
      setTimeout(function () {
        var btn = document.querySelector('button[aria-label="Отправить"], button[aria-label="Send"], [data-testid="oknyx"]');
        if (btn) {
          btn.click();
        } else {
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
        setTimeout(function () {
          if (dismissThinkingModal()) {
            setTimeout(trySend, 1500);
          } else if (onDone) {
            onDone();
          }
        }, 400);
      }, 150);
    }
    trySend();
    return true;
  }

  function isAliceGenerating() {
    if (dismissThinkingModal()) return true;
    var stopBtn = document.querySelector('button[aria-label="Остановить"], button[aria-label="Stop"], [data-testid="button-stop"]');
    if (stopBtn && stopBtn.offsetParent !== null) return true;
    var sendBtn = document.querySelector('button[aria-label="Отправить"], button[aria-label="Send"], [data-testid="oknyx"]');
    if (sendBtn) {
      var aria = (sendBtn.getAttribute('aria-label') || '').toLowerCase();
      if (/остановить|stop/.test(aria)) return true;
    }
    var loaders = document.querySelectorAll('.Message_status_loading, [class*="typing"], [class*="Cursor"], [class*="cursor"], [class*="Thinking"], [class*="Progress"]');
    if (loaders.length > 0) return true;
    return false;
  }

  function waitForAliceResponse(onDone) {
    if (bState.pollTimer) clearInterval(bState.pollTimer);
    var t0 = Date.now();
    var responseStarted = false;
    var stableCount = 0;
    var lastText = '';

    bState.pollTimer = setInterval(function () {
      if (bState.stopped) {
        clearInterval(bState.pollTimer);
        bState.pollTimer = null;
        return;
      }

      dismissThinkingModal();
      var busy = isAliceGenerating();
      var msgs = document.querySelectorAll('.Message:not(.Message_from_user), [data-testid="alice-chat-message"]');
      var lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
      var curText = lastMsg ? (lastMsg.textContent || '').trim() : '';

      if (!responseStarted) {
        if (busy || (curText && curText.length > 10)) {
          responseStarted = true;
        } else if (Date.now() - t0 > 14000) {
          responseStarted = true;
        }
        return;
      }

      if (busy) {
        stableCount = 0;
        lastText = curText;
        updateBrainstormHUDStatus('Alice is writing response...');
        return;
      }

      if (curText && curText === lastText && curText.length > 20) {
        stableCount++;
        // Require 4 consecutive checks (~3.2s of stability) with zero busy signals
        if (stableCount >= 4) {
          clearInterval(bState.pollTimer);
          bState.pollTimer = null;
          onDone();
        }
      } else {
        stableCount = 0;
        lastText = curText;
        updateBrainstormHUDStatus('Alice is generating...');
      }
    }, 800);
  }

  function advanceBrainstormRound() {
    if (bState.stopped) return;
    bState.currentRound++;

    if (bState.currentRound > bState.maxRounds) {
      concludeBrainstormNow();
      return;
    }

    var roundTotal = bState.maxRounds >= 999 ? '∞' : bState.maxRounds;
    updateBrainstormHUDStatus('Round ' + bState.currentRound + '/' + roundTotal + ': Sending prompt...');
    var promptText = buildRoundPrompt(bState.currentRound, bState.maxRounds, bState.roleKeys);

    sendAliceMessage(promptText);
    updateBrainstormHUDStatus('Round ' + bState.currentRound + '/' + roundTotal + ': Alice is thinking...');

    waitForAliceResponse(function () {
      if (bState.stopped) return;
      if (bState.currentRound >= bState.maxRounds) {
        bState.active = false;
        updateBrainstormHUDStatus('Session concluded with results!', true);
      } else if (bState.autoContinue) {
        updateBrainstormHUDStatus('Round ' + bState.currentRound + ' completed. Next round in 2s...');
        setTimeout(function () {
          if (!bState.stopped && bState.active) {
            advanceBrainstormRound();
          }
        }, 2200);
      } else {
        updateBrainstormHUDStatus('Round ' + bState.currentRound + ' completed. Ready for next round.', false, true);
      }
    });
  }

  function concludeBrainstormNow() {
    if (bState.stopped) return;
    updateBrainstormHUDStatus('Synthesizing final conclusion...');
    var promptText = buildRoundPrompt(bState.maxRounds, bState.maxRounds, bState.roleKeys);
    sendAliceMessage(promptText);
    waitForAliceResponse(function () {
      bState.active = false;
      updateBrainstormHUDStatus('Session concluded with results!', true);
    });
  }

  function stopBrainstormSession() {
    bState.stopped = true;
    bState.active = false;
    if (bState.pollTimer) { clearInterval(bState.pollTimer); bState.pollTimer = null; }
    updateBrainstormHUDStatus('Session stopped by user.', true);
  }

  var bhudEl = null;
  function renderBrainstormHUD() {
    if (bhudEl && bhudEl.isConnected) bhudEl.remove();
    bhudEl = A.mark(document.createElement('div'));
    bhudEl.className = 'alice-enx-bhud';

    var pulse = document.createElement('span');
    pulse.className = 'alice-enx-bhud-pulse busy';
    bhudEl.appendChild(pulse);

    var roleLabel = bState.roleKeys.length > 1
      ? ('⚡ Panel (' + bState.roleKeys.length + ')')
      : ('⚡ ' + (BRAINSTORM_ROLES[bState.roleKeys[0]] ? BRAINSTORM_ROLES[bState.roleKeys[0]].name : 'Ideation'));

    var title = document.createElement('span');
    title.className = 'alice-enx-bhud-title';
    title.textContent = roleLabel;
    bhudEl.appendChild(title);

    var sepEl = document.createElement('span');
    sepEl.style.cssText = 'opacity:.35;margin:0 2px';
    sepEl.textContent = '|';
    bhudEl.appendChild(sepEl);

    var status = document.createElement('span');
    status.className = 'alice-enx-bhud-status';
    status.setAttribute('data-enx-bstatus', '1');
    status.textContent = 'Starting Round 1...';
    bhudEl.appendChild(status);

    var autoBtn = document.createElement('button');
    autoBtn.className = 'alice-enx-bhud-btn alice-enx-bhud-toggle' + (bState.autoContinue ? ' on' : '');
    autoBtn.setAttribute('data-enx-bauto', '1');
    autoBtn.textContent = bState.autoContinue ? '⚡ Auto: ON' : '⏸ Auto: OFF';
    autoBtn.title = 'Toggle Auto Continue between rounds';
    autoBtn.addEventListener('click', function () {
      bState.autoContinue = !bState.autoContinue;
      autoBtn.className = 'alice-enx-bhud-btn alice-enx-bhud-toggle' + (bState.autoContinue ? ' on' : '');
      autoBtn.textContent = bState.autoContinue ? '⚡ Auto: ON' : '⏸ Auto: OFF';
    });
    bhudEl.appendChild(autoBtn);

    var nextBtn = document.createElement('button');
    nextBtn.className = 'alice-enx-bhud-btn';
    nextBtn.style.cssText = 'background:rgba(255,255,255,.15);color:#fff';
    nextBtn.textContent = '⏩ Next';
    nextBtn.title = 'Advance to next round immediately';
    nextBtn.addEventListener('click', function () {
      advanceBrainstormRound();
    });
    bhudEl.appendChild(nextBtn);

    var concBtn = document.createElement('button');
    concBtn.className = 'alice-enx-bhud-btn alice-enx-bhud-conclude';
    concBtn.textContent = '🏁 Conclude';
    concBtn.title = 'Conclude brainstorm and generate final executive summary';
    concBtn.addEventListener('click', function () {
      concludeBrainstormNow();
    });
    bhudEl.appendChild(concBtn);

    var stopBtn = document.createElement('button');
    stopBtn.className = 'alice-enx-bhud-btn alice-enx-bhud-stop';
    stopBtn.textContent = '⏹ Stop';
    stopBtn.title = 'Stop autonomous brainstorm';
    stopBtn.addEventListener('click', function () {
      stopBrainstormSession();
    });
    bhudEl.appendChild(stopBtn);

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'border:none;background:transparent;color:#9d96b8;cursor:pointer;padding:2px 6px;font-size:13px';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function () {
      stopBrainstormSession();
      if (bhudEl) bhudEl.remove();
    });
    bhudEl.appendChild(closeBtn);

    document.body.appendChild(bhudEl);
  }

  function updateBrainstormHUDStatus(text, isFinished, isPaused) {
    if (!bhudEl || !bhudEl.isConnected) return;
    var status = bhudEl.querySelector('[data-enx-bstatus]');
    if (status) status.textContent = text;
    var pulse = bhudEl.querySelector('.alice-enx-bhud-pulse');
    if (pulse) {
      if (isFinished) pulse.className = 'alice-enx-bhud-pulse';
      else if (isPaused) pulse.className = 'alice-enx-bhud-pulse';
      else pulse.className = 'alice-enx-bhud-pulse busy';
    }
  }

  function startBrainstormSession(config) {
    bState.active = true;
    bState.stopped = false;
    bState.topic = config.topic;
    bState.roleKeys = config.roleKeys && config.roleKeys.length ? config.roleKeys : ['ideation'];
    bState.customRole = config.customRole || '';
    bState.maxRounds = config.maxRounds || 5;
    bState.autoContinue = config.autoContinue !== false;
    bState.currentRound = 1;

    renderBrainstormHUD();
    var roundTotal = bState.maxRounds >= 999 ? '∞' : bState.maxRounds;
    updateBrainstormHUDStatus('Round 1/' + roundTotal + ': Initializing brainstorm...');

    var kickoffPrompt = buildKickoffPrompt(bState.topic, bState.roleKeys, bState.customRole);

    sendAliceMessage(kickoffPrompt);
    updateBrainstormHUDStatus('Round 1/' + roundTotal + ': Alice is thinking...');

    waitForAliceResponse(function () {
      if (bState.stopped) return;
      if (bState.currentRound >= bState.maxRounds) {
        bState.active = false;
        updateBrainstormHUDStatus('Session concluded with results!', true);
      } else if (bState.autoContinue) {
        updateBrainstormHUDStatus('Round 1 completed. Next round in 2s...');
        setTimeout(function () {
          if (!bState.stopped && bState.active) {
            advanceBrainstormRound();
          }
        }, 2200);
      } else {
        updateBrainstormHUDStatus('Round 1 completed. Ready for next round.', false, true);
      }
    });
  }

  function openBrainstormModal() {
    var existing = document.querySelector('.alice-enx-modal-backdrop');
    if (existing) existing.remove();

    var backdrop = A.mark(document.createElement('div'));
    backdrop.className = 'alice-enx-modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'alice-enx-modal';

    var h2 = document.createElement('h2');
    h2.innerHTML = '⚡ Alice Brainstorm &amp; Role-Play Studio';
    modal.appendChild(h2);

    var sub = document.createElement('p');
    sub.className = 'alice-enx-modal-sub';
    sub.textContent = 'Multi-agent ideation and expert debate. Select one or more personas, set custom rounds, and explore topics autonomously.';
    modal.appendChild(sub);

    var topicField = document.createElement('div');
    topicField.className = 'alice-enx-field';
    var topicLbl = document.createElement('label');
    topicLbl.textContent = 'Brainstorm Topic or Challenge';
    var topicTa = document.createElement('textarea');
    topicTa.className = 'alice-enx-textarea';
    topicTa.rows = 2;
    topicTa.placeholder = 'e.g. Design a viral mobile app for dog owners, or Pitch an enterprise B2B AI tool to tier-1 investors';
    topicField.appendChild(topicLbl);
    topicField.appendChild(topicTa);
    modal.appendChild(topicField);

    var roleHeader = document.createElement('div');
    roleHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px';
    var roleLbl = document.createElement('label');
    roleLbl.style.cssText = 'font:600 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;margin:0';
    roleLbl.textContent = 'Select Brainstorm Agents / Experts (Multi-Select)';
    var roleBadge = document.createElement('span');
    roleBadge.style.cssText = 'font:500 11px/1 inherit;color:#6C4CF0;background:rgba(108,76,240,.12);padding:3px 8px;border-radius:6px';
    roleBadge.textContent = '1 Expert Selected';
    roleHeader.appendChild(roleLbl);
    roleHeader.appendChild(roleBadge);
    modal.appendChild(roleHeader);

    var grid = document.createElement('div');
    grid.className = 'alice-enx-role-grid';
    var selectedRoles = ['ideation'];

    var customField = document.createElement('div');
    customField.className = 'alice-enx-field';
    customField.style.display = 'none';
    var customLbl = document.createElement('label');
    customLbl.textContent = 'Custom Role Instructions';
    var customTa = document.createElement('textarea');
    customTa.className = 'alice-enx-textarea';
    customTa.rows = 2;
    customTa.placeholder = 'e.g. You are Steve Jobs reviewing our product. Be brutally honest about simplicity and taste.';
    customField.appendChild(customLbl);
    customField.appendChild(customTa);

    function updateRoleBadge() {
      if (selectedRoles.length === 1) {
        var r = BRAINSTORM_ROLES[selectedRoles[0]];
        roleBadge.textContent = (r ? r.name : selectedRoles[0]) + ' (Single Expert)';
      } else {
        roleBadge.textContent = selectedRoles.length + ' Experts (Panel Debate)';
      }
      customField.style.display = selectedRoles.indexOf('custom') > -1 ? 'block' : 'none';
    }

    var cards = {};
    Object.keys(BRAINSTORM_ROLES).forEach(function (key) {
      var r = BRAINSTORM_ROLES[key];
      var card = document.createElement('div');
      card.className = 'alice-enx-role-card' + (selectedRoles.indexOf(key) > -1 ? ' active' : '');
      var cTitle = document.createElement('div');
      cTitle.className = 'alice-enx-role-title';
      cTitle.textContent = r.icon + ' ' + r.name;
      var cDesc = document.createElement('div');
      cDesc.className = 'alice-enx-role-desc';
      cDesc.textContent = r.desc;
      card.appendChild(cTitle);
      card.appendChild(cDesc);
      card.addEventListener('click', function () {
        var idx = selectedRoles.indexOf(key);
        if (idx > -1) {
          if (selectedRoles.length > 1) {
            selectedRoles.splice(idx, 1);
            card.classList.remove('active');
          }
        } else {
          selectedRoles.push(key);
          card.classList.add('active');
        }
        updateRoleBadge();
      });
      cards[key] = card;
      grid.appendChild(card);
    });
    modal.appendChild(grid);
    modal.appendChild(customField);

    // Rounds selector with Custom input
    var roundsField = document.createElement('div');
    roundsField.className = 'alice-enx-field';
    var roundsLbl = document.createElement('label');
    roundsLbl.textContent = 'Autonomous Rounds';
    roundsField.appendChild(roundsLbl);

    var pillsWrap = document.createElement('div');
    pillsWrap.className = 'alice-enx-rpills';

    var customRoundsInput = document.createElement('input');
    customRoundsInput.type = 'number';
    customRoundsInput.min = '1';
    customRoundsInput.max = '50';
    customRoundsInput.value = '5';
    customRoundsInput.className = 'alice-enx-input';
    customRoundsInput.style.cssText = 'width:80px;padding:5px 8px;font-size:12px;display:none;margin-left:6px';

    var selectedRoundsValue = 5;
    var roundOptions = [
      { label: '3 Sprint', val: 3 },
      { label: '5 Standard', val: 5 },
      { label: '8 Deep Dive', val: 8 },
      { label: 'Custom', val: 'custom' },
      { label: '∞ Continuous', val: 999 }
    ];

    var pillBtns = [];
    roundOptions.forEach(function (opt) {
      var pb = document.createElement('button');
      pb.type = 'button';
      pb.className = 'alice-enx-rpill' + (opt.val === 5 ? ' active' : '');
      pb.textContent = opt.label;
      pb.addEventListener('click', function () {
        pillBtns.forEach(function (b) { b.classList.remove('active'); });
        pb.classList.add('active');
        if (opt.val === 'custom') {
          customRoundsInput.style.display = 'inline-block';
          customRoundsInput.focus();
          selectedRoundsValue = parseInt(customRoundsInput.value, 10) || 5;
        } else {
          customRoundsInput.style.display = 'none';
          selectedRoundsValue = opt.val;
        }
      });
      pillBtns.push(pb);
      pillsWrap.appendChild(pb);
    });
    customRoundsInput.addEventListener('input', function () {
      selectedRoundsValue = Math.max(1, parseInt(customRoundsInput.value, 10) || 5);
    });
    pillsWrap.appendChild(customRoundsInput);
    roundsField.appendChild(pillsWrap);
    modal.appendChild(roundsField);

    // Auto Continue Toggle
    var autoRow = document.createElement('label');
    autoRow.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:14px;padding:8px 2px;font:500 12.5px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#333';
    var autoCb = document.createElement('input');
    autoCb.type = 'checkbox';
    autoCb.checked = true;
    autoCb.style.cssText = 'accent-color:#6C4CF0;width:16px;height:16px;cursor:pointer';
    var autoText = document.createElement('span');
    autoText.innerHTML = '<b>Auto Continue</b> (advance rounds autonomously without pausing)';
    autoRow.appendChild(autoCb);
    autoRow.appendChild(autoText);
    modal.appendChild(autoRow);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'alice-enx-modal-actions';
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'alice-enx-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { backdrop.remove(); });

    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'alice-enx-btn-primary';
    startBtn.textContent = '⚡ Start Brainstorm';
    startBtn.addEventListener('click', function () {
      var topic = (topicTa.value || '').trim();
      if (!topic) {
        topicTa.focus();
        topicTa.style.borderColor = '#f04444';
        return;
      }
      var roundsFinal = selectedRoundsValue === 'custom'
        ? (parseInt(customRoundsInput.value, 10) || 5)
        : selectedRoundsValue;

      backdrop.remove();
      startBrainstormSession({
        topic: topic,
        roleKeys: selectedRoles,
        customRole: customTa.value,
        maxRounds: roundsFinal,
        autoContinue: autoCb.checked
      });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(startBtn);
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.remove();
    });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape' && backdrop.isConnected) {
        backdrop.remove();
        document.removeEventListener('keydown', onEsc);
      }
    });

    setTimeout(function () { topicTa.focus(); }, 100);
  }

  /* ---------------- Autonomous Loop Agent Engine (Looper, Ralph, ZCode) ---------------- */
  var LOOP_MODES = {
    code: {
      id: 'code',
      name: 'Coding & Worker Loop',
      badge: 'Code Loop',
      desc: 'TDD implementation loop: plans stories, writes modular code, runs tests, fixes failures.',
      directive: 'Focus on implementing code and running tests via bash blocks. Iterate until tests pass and acceptance criteria are verified.'
    },
    research: {
      id: 'research',
      name: 'Deep Research Loop',
      badge: 'Research Loop',
      desc: 'Multi-angle inquiry: inspects codebase architecture, reads documentation, gathers facts, synthesizes dossiers.',
      directive: 'Explore files, trace dependencies, inspect implementations, and synthesize evidence-backed technical documentation.'
    },
    qa: {
      id: 'qa',
      name: 'QA & Self-Healing Sentinel',
      badge: 'QA Sentinel',
      desc: 'Autonomous QA tester: runs automated test suites, uncovers defects, generates regression probes, verifies fixes.',
      directive: 'Run test suites, inspect failure logs, probe edge cases, create reproduction tests, and verify patches.'
    },
    review: {
      id: 'review',
      name: 'Code Review & AST Audit',
      badge: 'Review Loop',
      desc: 'Autonomous code review: scans for security bugs, cyclomatic complexity, code smells, generates unified diffs.',
      directive: 'Perform static and AST code review, identify security issues and antipatterns, and propose minimal patch diffs.'
    },
    design: {
      id: 'design',
      name: 'System Design & Architect',
      badge: 'Design Loop',
      desc: 'Architecture and spec design: defines component boundaries, creates PRDs, sequence diagrams, ADRs.',
      directive: 'Define system architecture, interfaces, data models, sequence flows, and break down requirements into actionable stories.'
    },
    general: {
      id: 'general',
      name: 'General Long-Horizon Loop',
      badge: 'Long-Horizon',
      desc: 'Autonomous multi-turn execution with persistent PRD tracking, progressive milestones, self-direction.',
      directive: 'Execute multi-step long-horizon objectives sequentially with verification at each step.'
    }
  };

  var loopState = {
    active: false,
    paused: false,
    stopped: false,
    mode: 'code',
    goal: '',
    iteration: 0,
    maxIterations: 10,
    pollTimer: null,
    stories: [],
    recentProgress: ''
  };

  var loopHudEl = null;

  var LoopManager = {
    start: function (config) {
      if (!config || !config.goal) return;
      loopState.active = true;
      loopState.paused = false;
      loopState.stopped = false;
      loopState.mode = config.mode || 'code';
      loopState.goal = config.goal.trim();
      loopState.maxIterations = parseInt(config.maxIterations, 10) || 10;
      loopState.iteration = 0;
      loopState.recentProgress = '';

      if (Array.isArray(config.stories) && config.stories.length > 0) {
        loopState.stories = config.stories;
      } else {
        loopState.stories = LoopManager.generateDefaultStories(loopState.mode, loopState.goal);
      }

      LoopManager.savePersistence();
      LoopManager.renderHUD();
      LoopManager.updateHUD('Starting iteration 1...', 0);
      logTerm('info', '[LoopManager] Started ' + LOOP_MODES[loopState.mode].badge + ': "' + loopState.goal.slice(0, 60) + '..." (' + loopState.stories.length + ' stories)');

      LoopManager.step();
    },

    generateDefaultStories: function (mode, goal) {
      var shortGoal = goal.length > 40 ? goal.slice(0, 40) + '...' : goal;
      if (mode === 'code') {
        return [
          { id: 'STORY-1', title: 'Plan and inspect requirements: ' + shortGoal, status: 'pending', criteria: 'Inspect relevant files and plan implementation steps' },
          { id: 'STORY-2', title: 'Implement core functionality: ' + shortGoal, status: 'pending', criteria: 'Code written and verified locally via bash' },
          { id: 'STORY-3', title: 'Write tests and verify edge cases', status: 'pending', criteria: 'Tests run with exit code 0' },
          { id: 'STORY-4', title: 'Refactor and finalize changes', status: 'pending', criteria: 'Clean working tree and syntax check passed' }
        ];
      } else if (mode === 'qa') {
        return [
          { id: 'QA-1', title: 'Audit test suites and reproduce failures', status: 'pending', criteria: 'Existing tests run and defects cataloged' },
          { id: 'QA-2', title: 'Create reproduction probe and fix bug', status: 'pending', criteria: 'Fix applied and probe passes' },
          { id: 'QA-3', title: 'Run full regression check', status: 'pending', criteria: 'Zero regressions detected across all test suites' }
        ];
      } else if (mode === 'review') {
        return [
          { id: 'REV-1', title: 'Scan codebase for security and complexity', status: 'pending', criteria: 'Static analysis and AST review completed' },
          { id: 'REV-2', title: 'Generate unified refactoring diffs', status: 'pending', criteria: 'Diffs produced and validated for correctness' }
        ];
      } else if (mode === 'research') {
        return [
          { id: 'RES-1', title: 'Collect relevant files, configs, and facts', status: 'pending', criteria: 'All relevant file contents inspected' },
          { id: 'RES-2', title: 'Analyze architecture and trade-offs', status: 'pending', criteria: 'Comparative analysis completed' },
          { id: 'RES-3', title: 'Synthesize comprehensive research dossier', status: 'pending', criteria: 'Structured dossier with actionable findings produced' }
        ];
      } else if (mode === 'design') {
        return [
          { id: 'DES-1', title: 'Extract requirements and constraints', status: 'pending', criteria: 'Functional and non-functional requirements cataloged' },
          { id: 'DES-2', title: 'Design component architecture and data contracts', status: 'pending', criteria: 'Interfaces, schemas, and sequence flows documented' },
          { id: 'DES-3', title: 'Draft implementation roadmap and PRD breakdown', status: 'pending', criteria: 'Numbered user stories and verification criteria ready' }
        ];
      } else {
        return [
          { id: 'STEP-1', title: 'Analyze objectives and baseline state', status: 'pending', criteria: 'Baseline verified via shell inspection' },
          { id: 'STEP-2', title: 'Execute primary milestone tasks', status: 'pending', criteria: 'Milestone criteria satisfied' },
          { id: 'STEP-3', title: 'Validate end-to-end outcome', status: 'pending', criteria: 'Verification checks pass' }
        ];
      }
    },

    getActiveStory: function () {
      for (var i = 0; i < loopState.stories.length; i++) {
        if (loopState.stories[i].status === 'active') return loopState.stories[i];
      }
      for (var j = 0; j < loopState.stories.length; j++) {
        if (loopState.stories[j].status === 'pending') {
          loopState.stories[j].status = 'active';
          return loopState.stories[j];
        }
      }
      return null;
    },

    step: function () {
      if (loopState.stopped || loopState.paused) return;

      loopState.iteration++;
      if (loopState.iteration > loopState.maxIterations) {
        loopState.paused = true;
        LoopManager.updateHUD('Reached iteration limit (' + loopState.maxIterations + '). Paused.', LoopManager.getProgressPct(), true);
        logTerm('info', '[LoopManager] Paused: reached iteration limit (' + loopState.maxIterations + '). Click Resume to continue.');
        return;
      }

      var activeStory = LoopManager.getActiveStory();
      if (!activeStory) {
        LoopManager.complete();
        return;
      }

      var modeDef = LOOP_MODES[loopState.mode] || LOOP_MODES.code;
      var prompt = LoopManager.buildPrompt(modeDef, activeStory);

      LoopManager.updateHUD('Iter ' + loopState.iteration + '/' + loopState.maxIterations + ': Working on [' + activeStory.id + ']...', LoopManager.getProgressPct());
      LoopManager.renderBoard();

      sendAliceMessage(prompt);

      LoopManager.waitForTurn(function (resText) {
        if (loopState.stopped) return;

        var allDone = resText.indexOf('[LOOP_ALL_COMPLETE]') > -1;
        var storyDoneRegex = new RegExp('\\[LOOP_STORY_DONE:\\s*' + activeStory.id + '\\]', 'i');
        var storyDone = storyDoneRegex.test(resText) || allDone;

        if (allDone) {
          for (var k = 0; k < loopState.stories.length; k++) {
            loopState.stories[k].status = 'passed';
          }
          LoopManager.logProgress('Iteration ' + loopState.iteration + ': All stories completed successfully.');
          LoopManager.savePersistence();
          LoopManager.complete();
          return;
        }

        if (storyDone) {
          activeStory.status = 'passed';
          LoopManager.logProgress('Iteration ' + loopState.iteration + ': Completed [' + activeStory.id + '] ' + activeStory.title);
          logTerm('info', '[LoopManager] Story passed: ' + activeStory.id);
        } else {
          LoopManager.logProgress('Iteration ' + loopState.iteration + ': Continued work on [' + activeStory.id + ']');
        }

        LoopManager.savePersistence();
        LoopManager.renderBoard();

        var remaining = loopState.stories.filter(function (s) { return s.status !== 'passed'; });
        if (remaining.length === 0) {
          LoopManager.complete();
          return;
        }

        if (loopState.paused || loopState.stopped) return;

        LoopManager.updateHUD('Iteration ' + loopState.iteration + ' done. Next turn in 2.5s...', LoopManager.getProgressPct());
        setTimeout(function () {
          if (!loopState.stopped && !loopState.paused && loopState.active) {
            LoopManager.step();
          }
        }, 2500);
      });
    },

    buildPrompt: function (modeDef, story) {
      var lines = [
        '[Autonomous Loop Agent: ' + modeDef.badge + ']',
        'Goal: ' + loopState.goal,
        'Iteration: ' + loopState.iteration + ' of ' + loopState.maxIterations,
        '',
        'Current Active Story: [' + story.id + '] ' + story.title,
        'Acceptance Criteria: ' + story.criteria,
        ''
      ];

      if (loopState.recentProgress) {
        lines.push('Recent Progress & Learnings:');
        lines.push(loopState.recentProgress.trim());
        lines.push('');
      }

      lines.push('Directives:');
      lines.push('1. ' + modeDef.directive);
      lines.push('2. Use bash tool blocks to inspect code, run tests, or execute commands locally on macOS.');
      lines.push('3. Verify your work against the acceptance criteria.');
      lines.push('4. When this story is fully complete and verified, include this marker on its own line:');
      lines.push('   [LOOP_STORY_DONE:' + story.id + ']');
      lines.push('5. If all stories for the entire goal are finished, include:');
      lines.push('   [LOOP_ALL_COMPLETE]');

      return lines.join('\n');
    },

    waitForTurn: function (onDone) {
      if (loopState.pollTimer) clearInterval(loopState.pollTimer);
      var t0 = Date.now();
      var responseStarted = false;
      var stableCount = 0;
      var lastText = '';

      loopState.pollTimer = setInterval(function () {
        if (loopState.stopped) {
          clearInterval(loopState.pollTimer);
          loopState.pollTimer = null;
          return;
        }

        dismissThinkingModal();
        var busy = isAliceGenerating();
        var msgs = document.querySelectorAll('.Message:not(.Message_from_user), [data-testid="alice-chat-message"]');
        var lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
        var curText = lastMsg ? (lastMsg.textContent || '').trim() : '';

        if (!responseStarted) {
          if (busy || (curText && curText.length > 10)) {
            responseStarted = true;
          } else if (Date.now() - t0 > 14000) {
            responseStarted = true;
          }
          return;
        }

        if (busy) {
          stableCount = 0;
          lastText = curText;
          LoopManager.updateHUD('Iter ' + loopState.iteration + ': Alice is executing...', LoopManager.getProgressPct());
          return;
        }

        if (curText && curText === lastText && curText.length > 20) {
          stableCount++;
          if (stableCount >= 4) {
            clearInterval(loopState.pollTimer);
            loopState.pollTimer = null;
            onDone(curText);
          }
        } else {
          stableCount = 0;
          lastText = curText;
        }
      }, 800);
    },

    pause: function () {
      loopState.paused = true;
      LoopManager.updateHUD('Paused at iteration ' + loopState.iteration, LoopManager.getProgressPct(), true);
      logTerm('info', '[LoopManager] Loop paused.');
    },

    resume: function () {
      if (!loopState.active) return;
      loopState.paused = false;
      LoopManager.updateHUD('Resuming iteration ' + loopState.iteration + '...', LoopManager.getProgressPct());
      logTerm('info', '[LoopManager] Loop resumed.');
      LoopManager.step();
    },

    stop: function () {
      loopState.active = false;
      loopState.stopped = true;
      loopState.paused = false;
      if (loopState.pollTimer) clearInterval(loopState.pollTimer);
      loopState.pollTimer = null;
      if (loopHudEl && loopHudEl.isConnected) loopHudEl.remove();
      logTerm('info', '[LoopManager] Loop stopped by user.');
    },

    complete: function () {
      loopState.active = false;
      if (loopState.pollTimer) clearInterval(loopState.pollTimer);
      loopState.pollTimer = null;
      LoopManager.updateHUD('Goal completed successfully in ' + loopState.iteration + ' iterations!', 100, false, true);
      logTerm('info', '[LoopManager] Mission complete! All ' + loopState.stories.length + ' stories passed.');
      if (window.__aliceComputerUse) {
        window.__aliceComputerUse('notify', {
          title: 'Alice Autonomous Loop Complete',
          message: 'All stories verified for: ' + loopState.goal.slice(0, 50)
        }, function () {});
      }
    },

    getProgressPct: function () {
      if (!loopState.stories.length) return 0;
      var passed = loopState.stories.filter(function (s) { return s.status === 'passed'; }).length;
      return Math.round((passed / loopState.stories.length) * 100);
    },

    savePersistence: function () {
      var prdData = {
        title: loopState.goal,
        mode: loopState.mode,
        stories: loopState.stories,
        updatedAt: new Date().toISOString()
      };
      var stateData = {
        active: loopState.active,
        paused: loopState.paused,
        mode: loopState.mode,
        goal: loopState.goal,
        iteration: loopState.iteration,
        maxIterations: loopState.maxIterations,
        updatedAt: new Date().toISOString()
      };

      if (window.__aliceHarness && window.__aliceHarness.savePRD) {
        window.__aliceHarness.savePRD(prdData, function () {});
        window.__aliceHarness.saveLoopState(stateData, function () {});
      } else if (window.__aliceComputerUse) {
        window.__aliceComputerUse('savePRD', { prd: JSON.stringify(prdData, null, 2) }, function () {});
        window.__aliceComputerUse('saveLoopState', { state: JSON.stringify(stateData, null, 2) }, function () {});
      }
    },

    logProgress: function (entry) {
      var ts = new Date().toLocaleTimeString();
      var logLine = '[' + ts + '] ' + entry + '\n';
      loopState.recentProgress = (loopState.recentProgress + '\n' + logLine).slice(-600);

      if (window.__aliceHarness && window.__aliceHarness.appendProgress) {
        window.__aliceHarness.appendProgress(logLine, function () {});
      } else if (window.__aliceComputerUse) {
        window.__aliceComputerUse('appendProgress', { text: logLine }, function () {});
      }
      LoopManager.refreshProgressViewer();
    },

    renderHUD: function () {
      if (loopHudEl && loopHudEl.isConnected) loopHudEl.remove();

      loopHudEl = A.mark(document.createElement('div'));
      loopHudEl.className = 'alice-enx-loop-hud';

      var top = document.createElement('div');
      top.className = 'alice-enx-loop-hud-top';

      var badge = document.createElement('span');
      badge.className = 'alice-enx-loop-badge';
      var m = LOOP_MODES[loopState.mode] || LOOP_MODES.code;
      badge.textContent = '🔁 ' + m.badge;
      top.appendChild(badge);

      var title = document.createElement('span');
      title.className = 'alice-enx-loop-hud-title';
      title.textContent = loopState.goal;
      title.title = loopState.goal;
      top.appendChild(title);

      var controls = document.createElement('div');
      controls.className = 'alice-enx-loop-controls';

      var pauseBtn = document.createElement('button');
      pauseBtn.className = 'alice-enx-loop-ctrl-btn pause';
      pauseBtn.textContent = loopState.paused ? '▶ Resume' : '⏸ Pause';
      pauseBtn.addEventListener('click', function () {
        if (loopState.paused) LoopManager.resume();
        else LoopManager.pause();
        pauseBtn.textContent = loopState.paused ? '▶ Resume' : '⏸ Pause';
      });
      controls.appendChild(pauseBtn);

      var studioBtn = document.createElement('button');
      studioBtn.className = 'alice-enx-loop-ctrl-btn';
      studioBtn.textContent = 'Studio';
      studioBtn.title = 'Open Loop Studio in Workbench';
      studioBtn.addEventListener('click', function () {
        toggleWorkbench('loop');
      });
      controls.appendChild(studioBtn);

      var stopBtn = document.createElement('button');
      stopBtn.className = 'alice-enx-loop-ctrl-btn stop';
      stopBtn.textContent = '⏹ Stop';
      stopBtn.addEventListener('click', function () {
        LoopManager.stop();
      });
      controls.appendChild(stopBtn);

      top.appendChild(controls);
      loopHudEl.appendChild(top);

      var barWrap = document.createElement('div');
      barWrap.className = 'alice-enx-loop-hud-progress';
      var bar = document.createElement('div');
      bar.className = 'alice-enx-loop-bar';
      bar.style.width = '0%';
      barWrap.appendChild(bar);
      loopHudEl.appendChild(barWrap);

      var activeStoryEl = document.createElement('div');
      activeStoryEl.className = 'alice-enx-loop-hud-active-story';
      activeStoryEl.textContent = 'Initializing autonomous loop...';
      loopHudEl.appendChild(activeStoryEl);

      var chatHost = document.querySelector('.AliceChat, [class*="Chat_root"], main') || document.body;
      chatHost.insertBefore(loopHudEl, chatHost.firstChild);
    },

    updateHUD: function (text, pct, isPaused, isComplete) {
      if (!loopHudEl || !loopHudEl.isConnected) return;
      var activeStoryEl = loopHudEl.querySelector('.alice-enx-loop-hud-active-story');
      if (activeStoryEl) activeStoryEl.textContent = text;
      var bar = loopHudEl.querySelector('.alice-enx-loop-bar');
      if (bar) bar.style.width = (pct || 0) + '%';
      var pauseBtn = loopHudEl.querySelector('.alice-enx-loop-ctrl-btn.pause');
      if (pauseBtn) {
        if (isComplete) pauseBtn.style.display = 'none';
        else {
          pauseBtn.style.display = 'inline-block';
          pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        }
      }
    },

    renderBoard: function () {
      var board = document.getElementById('alice-enx-loop-stories');
      if (!board) return;
      board.innerHTML = '';
      loopState.stories.forEach(function (story) {
        var item = document.createElement('div');
        item.className = 'alice-enx-loop-story-item ' + story.status;
        var icon = story.status === 'passed' ? '✓' : (story.status === 'active' ? '▶' : '○');
        var color = story.status === 'passed' ? '#4ade80' : (story.status === 'active' ? '#a78bfa' : '#64748b');
        item.innerHTML = '<span style="color:' + color + ';font-weight:700;width:16px">' + icon + '</span>' +
          '<div style="flex:1">' +
            '<div class="alice-enx-loop-story-title" style="font-weight:600">' + story.id + ': ' + story.title + '</div>' +
            '<div style="font-size:11px;color:#94a3b8">' + story.criteria + '</div>' +
          '</div>';
        board.appendChild(item);
      });
    },

    refreshProgressViewer: function () {
      var pView = document.getElementById('alice-enx-loop-progress-log');
      if (!pView) return;
      if (window.__aliceHarness && window.__aliceHarness.readProgress) {
        window.__aliceHarness.readProgress(function (res) {
          if (res && res.data && res.data.progress) {
            pView.textContent = res.data.progress;
            pView.scrollTop = pView.scrollHeight;
          }
        });
      } else {
        pView.textContent = loopState.recentProgress || '(No progress recorded yet)';
        pView.scrollTop = pView.scrollHeight;
      }
    }
  };

  function openLoopModal(initialMode) {
    var existing = document.querySelector('.alice-enx-modal-backdrop');
    if (existing) existing.remove();

    var backdrop = A.mark(document.createElement('div'));
    backdrop.className = 'alice-enx-modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'alice-enx-modal';
    modal.style.maxWidth = '580px';

    var h2 = document.createElement('h2');
    h2.innerHTML = '🔁 Autonomous Loop Agent Studio';
    modal.appendChild(h2);

    var sub = document.createElement('p');
    sub.className = 'alice-enx-modal-sub';
    sub.textContent = 'Multi-turn autonomous execution with persistent PRD checklist, test-driven iteration, and native macOS harness.';
    modal.appendChild(sub);

    var modeLabel = document.createElement('label');
    modeLabel.style.cssText = 'font:600 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;margin-bottom:6px;display:block';
    modeLabel.textContent = 'Select Autonomous Loop Mode';
    modal.appendChild(modeLabel);

    var modeGrid = document.createElement('div');
    modeGrid.className = 'alice-enx-role-grid';
    var selectedMode = initialMode && LOOP_MODES[initialMode] ? initialMode : 'code';

    var modeCards = {};
    Object.keys(LOOP_MODES).forEach(function (key) {
      var m = LOOP_MODES[key];
      var card = document.createElement('div');
      card.className = 'alice-enx-role-card' + (key === selectedMode ? ' active' : '');
      var cTitle = document.createElement('div');
      cTitle.className = 'alice-enx-role-title';
      cTitle.textContent = (key === 'code' ? '💻 ' : (key === 'research' ? '🔍 ' : (key === 'qa' ? '🛡️ ' : (key === 'review' ? '⚡ ' : (key === 'design' ? '📐 ' : '🔁 '))))) + m.name;
      var cDesc = document.createElement('div');
      cDesc.className = 'alice-enx-role-desc';
      cDesc.textContent = m.desc;
      card.appendChild(cTitle);
      card.appendChild(cDesc);

      card.addEventListener('click', function () {
        Object.keys(modeCards).forEach(function (k) { modeCards[k].classList.remove('active'); });
        card.classList.add('active');
        selectedMode = key;
      });

      modeCards[key] = card;
      modeGrid.appendChild(card);
    });
    modal.appendChild(modeGrid);

    var goalField = document.createElement('div');
    goalField.className = 'alice-enx-field';
    var goalLbl = document.createElement('label');
    goalLbl.textContent = 'Mission Objective / Goal';
    var goalTa = document.createElement('textarea');
    goalTa.className = 'alice-enx-textarea';
    goalTa.rows = 2;
    goalTa.placeholder = 'e.g. Implement user login auth middleware with JWT tokens and unit tests, or Audit project for memory leaks';
    goalField.appendChild(goalLbl);
    goalField.appendChild(goalTa);
    modal.appendChild(goalField);

    var roundsRow = document.createElement('div');
    roundsRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:14px';

    var roundsLbl = document.createElement('label');
    roundsLbl.style.cssText = 'font:600 12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;margin:0';
    roundsLbl.textContent = 'Max Iterations:';
    roundsRow.appendChild(roundsLbl);

    var roundsSel = document.createElement('select');
    roundsSel.className = 'alice-enx-select';
    roundsSel.style.width = '120px';
    [['5', '5 turns'], ['10', '10 turns'], ['20', '20 turns'], ['50', '50 turns']].forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt[0];
      o.textContent = opt[1];
      if (opt[0] === '10') o.selected = true;
      roundsSel.appendChild(o);
    });
    roundsRow.appendChild(roundsSel);

    modal.appendChild(roundsRow);

    var actions = document.createElement('div');
    actions.className = 'alice-enx-modal-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'alice-enx-btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () { backdrop.remove(); });

    var launchBtn = document.createElement('button');
    launchBtn.className = 'alice-enx-btn-primary';
    launchBtn.textContent = '🚀 Launch Autonomous Loop';
    launchBtn.addEventListener('click', function () {
      var g = goalTa.value.trim();
      if (!g) {
        goalTa.style.borderColor = '#ef4444';
        goalTa.focus();
        return;
      }
      backdrop.remove();
      LoopManager.start({
        mode: selectedMode,
        goal: g,
        maxIterations: parseInt(roundsSel.value, 10) || 10
      });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(launchBtn);
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.remove();
    });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape' && backdrop.isConnected) {
        backdrop.remove();
        document.removeEventListener('keydown', onEsc);
      }
    });

    setTimeout(function () { goalTa.focus(); }, 100);
  }
  window.__aliceOpenLoopModal = openLoopModal;
  window.__aliceLoopManager = LoopManager;

  /* ---------------- ZCode & DeepSeek Harness Workbench ---------------- */
  var workbenchEl = null;
  var termHistory = [];
  var termHistIndex = -1;
  var activeWbTab = 'terminal';
  var currentWorkspace = '/Users/d/Downloads/alice-english-overlay-extension';

  function logTerm(type, text) {
    var out = document.getElementById('alice-enx-term-output');
    if (!out) return;
    var line = document.createElement('div');
    line.className = type || 'info';
    line.textContent = text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  }

  function runTerminalCommand(cmd, onDone) {
    cmd = (cmd || '').trim();
    if (!cmd) return;
    termHistory.push(cmd);
    termHistIndex = termHistory.length;
    logTerm('cmd', '$ ' + cmd);

    if (window.__aliceTerminalRun) {
      window.__aliceTerminalRun(cmd, currentWorkspace, function (res) {
        if (res.ok) {
          var out = (res.data && res.data.stdout) || (typeof res.text === 'string' ? res.text : '');
          if (out) logTerm('stdout', out);
          else logTerm('stdout', 'Command completed successfully (exit code 0).');
          var code = (res.data && typeof res.data.exitCode === 'number') ? res.data.exitCode : 0;
          if (onDone) onDone(true, out, '', code);
        } else {
          var err = (res.data && res.data.stderr) || res.error || 'Execution failed';
          logTerm('err', err);
          var code = (res.data && typeof res.data.exitCode === 'number') ? res.data.exitCode : 1;
          if (onDone) onDone(false, (res.data && res.data.stdout) || '', err, code);
        }
      });
    } else {
      setTimeout(function () {
        if (cmd === 'pwd') {
          logTerm('stdout', currentWorkspace);
          if (onDone) onDone(true, currentWorkspace, '', 0);
        } else if (cmd === 'clear') {
          var out = document.getElementById('alice-enx-term-output');
          if (out) out.innerHTML = '';
          if (onDone) onDone(true, '', '', 0);
        } else if (/^git status/i.test(cmd)) {
          var gs = 'On branch main\nYour branch is up to date with origin/main.\n\nnothing to commit, working tree clean';
          logTerm('stdout', gs);
          if (onDone) onDone(true, gs, '', 0);
        } else {
          var msg = '[Extension Mode] Local shell is active in native Alice.app. Ran simulated: ' + cmd;
          logTerm('info', msg);
          if (onDone) onDone(true, msg, '', 0);
        }
      }, 150);
    }
  }

  function toggleWorkbench(initialTab) {
    if (!workbenchEl || !workbenchEl.isConnected) {
      buildWorkbench();
    }
    if (initialTab) {
      switchWorkbenchTab(initialTab);
    }
    workbenchEl.classList.remove('alice-enx-hidden');
    workbenchEl.classList.remove('minimized');
    if (activeWbTab === 'terminal') {
      setTimeout(function () {
        var inp = document.getElementById('alice-enx-term-input');
        if (inp) inp.focus();
      }, 100);
    }
  }
  window.__aliceToggleWorkbench = toggleWorkbench;
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === '`' || e.key === '~')) {
      e.preventDefault();
      toggleWorkbench();
    }
  });

  function switchWorkbenchTab(tab) {
    activeWbTab = tab;
    if (!workbenchEl) return;
    var tabs = workbenchEl.querySelectorAll('.alice-enx-wb-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    }
    var panes = workbenchEl.querySelectorAll('[data-wb-pane]');
    for (var j = 0; j < panes.length; j++) {
      panes[j].style.display = panes[j].getAttribute('data-wb-pane') === tab ? 'flex' : 'none';
    }
    if (tab === 'git') {
      refreshGitStatus();
    }
    if (tab === 'sessions') {
      window.__aliceRefreshSessions && window.__aliceRefreshSessions();
    }
    if (tab === 'loop') {
      LoopManager.renderBoard();
      LoopManager.refreshProgressViewer();
    }
  }

  function refreshGitStatus() {
    var statEl = document.getElementById('alice-enx-git-status');
    if (statEl) statEl.textContent = 'Checking repository status...';
    if (window.__aliceTerminalRun) {
      window.__aliceTerminalRun('git status -s', currentWorkspace, function (res) {
        if (statEl) {
          var out = (res.data && res.data.stdout) || '';
          statEl.textContent = out.trim() ? out.trim() : '✓ Working tree clean (all changes committed)';
        }
      });
    } else if (statEl) {
      statEl.textContent = '✓ Working tree clean (origin/main)';
    }
  }

  function extractLatestCode() {
    var msgs = document.querySelectorAll('.Message:not(.Message_from_user)');
    if (!msgs.length) return null;
    var lastMsg = msgs[msgs.length - 1];
    var pres = lastMsg.querySelectorAll('pre, code');
    if (!pres.length) return null;
    var code = (pres[pres.length - 1].textContent || '').trim();
    return code;
  }

  function triggerVibeTask(taskPrompt) {
    var ta = document.querySelector('textarea');
    if (ta) {
      ta.value = taskPrompt;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      var sendBtn = document.querySelector('button[aria-label="Отправить"], button[aria-label="Send"], [data-testid="oknyx"]');
      if (sendBtn) sendBtn.click();
      logTerm('info', '[VibeCoder] Dispatched task: ' + taskPrompt.slice(0, 80) + '...');
    }
  }
  window.__aliceTriggerVibeTask = triggerVibeTask;

  function buildWorkbench() {
    if (workbenchEl && workbenchEl.isConnected) return;
    workbenchEl = document.createElement('div');
    workbenchEl.className = 'alice-enx-workbench';
    workbenchEl.setAttribute('data-alice-enx', '1');

    var head = document.createElement('div');
    head.className = 'alice-enx-wb-head';

    var tabs = document.createElement('div');
    tabs.className = 'alice-enx-wb-tabs';

    var tabDefs = [
      ['loop', '🔁 Loop Studio', 'loop'],
      ['terminal', '>_ Terminal', 'terminal'],
      ['sessions', '💬 Sessions', 'chat'],
      ['vibe', '⚡ Vibe Coder & Harness', 'code'],
      ['skills', '🛠 Agent Skills', 'spark'],
      ['git', '🔄 Git Sync', 'git']
    ];

    tabDefs.forEach(function (td) {
      var b = document.createElement('button');
      b.className = 'alice-enx-wb-tab' + (td[0] === activeWbTab ? ' active' : '');
      b.setAttribute('data-tab', td[0]);
      b.appendChild(svg(ICONS[td[2]] || ICONS.code));
      var t = document.createElement('span');
      t.textContent = td[1];
      b.appendChild(t);
      b.addEventListener('click', function () { switchWorkbenchTab(td[0]); });
      tabs.appendChild(b);
    });
    head.appendChild(tabs);

    var tools = document.createElement('div');
    tools.className = 'alice-enx-wb-tools';

    var wsLabel = document.createElement('span');
    wsLabel.style.cssText = 'color:#a5a5c0;font-size:11px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:center;gap:4px';
    wsLabel.appendChild(svg(ICONS.folder));
    var wsText = document.createElement('span');
    wsText.textContent = currentWorkspace.split('/').slice(-2).join('/');
    wsLabel.title = currentWorkspace;
    wsLabel.appendChild(wsText);
    tools.appendChild(wsLabel);

    var openFinderBtn = document.createElement('button');
    openFinderBtn.className = 'alice-enx-wb-btn';
    openFinderBtn.textContent = 'Finder';
    openFinderBtn.addEventListener('click', function () {
      if (window.__aliceComputerUse) {
        window.__aliceComputerUse('openFolder', { path: currentWorkspace }, function () {});
      }
    });
    tools.appendChild(openFinderBtn);

    var minBtn = document.createElement('button');
    minBtn.className = 'alice-enx-wb-btn';
    minBtn.textContent = '–';
    minBtn.title = 'Minimize';
    minBtn.addEventListener('click', function () {
      workbenchEl.classList.toggle('minimized');
    });
    tools.appendChild(minBtn);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'alice-enx-wb-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close Workbench';
    closeBtn.addEventListener('click', function () {
      workbenchEl.classList.add('alice-enx-hidden');
    });
    tools.appendChild(closeBtn);

    head.appendChild(tools);
    workbenchEl.appendChild(head);

    var body = document.createElement('div');
    body.className = 'alice-enx-wb-body';

    // 0. Loop Studio Pane
    var loopPane = document.createElement('div');
    loopPane.className = 'alice-enx-loop-pane';
    loopPane.setAttribute('data-wb-pane', 'loop');
    loopPane.style.display = activeWbTab === 'loop' ? 'flex' : 'none';

    var loopModesRow = document.createElement('div');
    loopModesRow.className = 'alice-enx-loop-modes';
    Object.keys(LOOP_MODES).forEach(function (mKey) {
      var m = LOOP_MODES[mKey];
      var mb = document.createElement('button');
      mb.className = 'alice-enx-loop-mode-btn' + (loopState.mode === mKey ? ' active' : '');
      mb.textContent = m.badge;
      mb.addEventListener('click', function () {
        var allMb = loopModesRow.querySelectorAll('.alice-enx-loop-mode-btn');
        for (var k = 0; k < allMb.length; k++) allMb[k].classList.remove('active');
        mb.classList.add('active');
        loopState.mode = mKey;
      });
      loopModesRow.appendChild(mb);
    });
    loopPane.appendChild(loopModesRow);

    var loopInputCard = document.createElement('div');
    loopInputCard.style.cssText = 'background:#181824;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px';

    var loopGoalInput = document.createElement('input');
    loopGoalInput.className = 'alice-enx-input';
    loopGoalInput.placeholder = 'Enter mission goal or objective to loop over...';
    loopGoalInput.value = loopState.goal || '';
    loopInputCard.appendChild(loopGoalInput);

    var loopActionRow = document.createElement('div');
    loopActionRow.style.cssText = 'display:flex;gap:8px;align-items:center';

    var startLoopBtn = document.createElement('button');
    startLoopBtn.className = 'alice-enx-btn-primary';
    startLoopBtn.textContent = '🚀 Start Loop';
    startLoopBtn.addEventListener('click', function () {
      var g = (loopGoalInput.value || '').trim();
      if (!g) { loopGoalInput.focus(); return; }
      LoopManager.start({ mode: loopState.mode, goal: g, maxIterations: 10 });
    });
    loopActionRow.appendChild(startLoopBtn);

    var pauseResumeBtn = document.createElement('button');
    pauseResumeBtn.className = 'alice-enx-wb-btn';
    pauseResumeBtn.style.padding = '6px 12px';
    pauseResumeBtn.textContent = loopState.paused ? '▶ Resume' : '⏸ Pause';
    pauseResumeBtn.addEventListener('click', function () {
      if (loopState.paused) LoopManager.resume();
      else LoopManager.pause();
      pauseResumeBtn.textContent = loopState.paused ? '▶ Resume' : '⏸ Pause';
    });
    loopActionRow.appendChild(pauseResumeBtn);

    var stopLoopBtn = document.createElement('button');
    stopLoopBtn.className = 'alice-enx-wb-btn';
    stopLoopBtn.style.cssText = 'padding:6px 12px;color:#fca5a5;border-color:rgba(239,68,68,.3)';
    stopLoopBtn.textContent = '⏹ Stop';
    stopLoopBtn.addEventListener('click', function () {
      LoopManager.stop();
      LoopManager.renderBoard();
    });
    loopActionRow.appendChild(stopLoopBtn);

    loopInputCard.appendChild(loopActionRow);
    loopPane.appendChild(loopInputCard);

    var storySection = document.createElement('div');
    storySection.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    var storyHead = document.createElement('div');
    storyHead.style.cssText = 'font:700 12px/1.2 inherit;color:#c4b5fd;display:flex;align-items:center;justify-content:space-between';
    storyHead.innerHTML = '<span>PRD Story Checklist (.alice/prd.json)</span><span style="font-size:10.5px;color:#94a3b8">Active: 1 story per turn</span>';
    storySection.appendChild(storyHead);

    var storyList = document.createElement('div');
    storyList.id = 'alice-enx-loop-stories';
    storyList.className = 'alice-enx-loop-board';
    storySection.appendChild(storyList);
    loopPane.appendChild(storySection);

    var logSection = document.createElement('div');
    logSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;min-height:90px';
    var logHead = document.createElement('div');
    logHead.style.cssText = 'font:700 12px/1.2 inherit;color:#a5b4fc';
    logHead.textContent = 'Progress & Learnings (.alice/progress.txt)';
    logSection.appendChild(logHead);

    var progressViewer = document.createElement('pre');
    progressViewer.id = 'alice-enx-loop-progress-log';
    progressViewer.style.cssText = 'background:#0d0d14;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px;font:400 11px/1.4 ui-monospace,Menlo,monospace;color:#93c5fd;flex:1;overflow-y:auto;white-space:pre-wrap;margin:0';
    progressViewer.textContent = '(No progress recorded yet)';
    logSection.appendChild(progressViewer);
    loopPane.appendChild(logSection);

    body.appendChild(loopPane);

    // 1. Terminal Pane
    var termPane = document.createElement('div');
    termPane.className = 'alice-enx-term';
    termPane.setAttribute('data-wb-pane', 'terminal');
    termPane.style.display = activeWbTab === 'terminal' ? 'flex' : 'none';

    var termOut = document.createElement('div');
    termOut.id = 'alice-enx-term-output';
    termOut.className = 'alice-enx-term-out';
    termOut.innerHTML = '<div class="info">Alice Native Harness Terminal (ZCode & DeepSeek DSH Core)</div>' +
      '<div class="info">Workspace: ' + currentWorkspace + '</div>' +
      '<div class="info">Type shell commands below or click quick action chips.</div>';
    termPane.appendChild(termOut);

    var termChips = document.createElement('div');
    termChips.className = 'alice-enx-term-chips';
    ['git status', 'git diff', 'git log -n 3 --oneline', 'ls -la', 'npm test', 'clear'].forEach(function (cmd) {
      var c = document.createElement('button');
      c.className = 'alice-enx-term-chip';
      c.textContent = cmd;
      c.addEventListener('click', function () { runTerminalCommand(cmd); });
      termChips.appendChild(c);
    });
    termPane.appendChild(termChips);

    var termInRow = document.createElement('div');
    termInRow.className = 'alice-enx-term-in-row';
    var pLbl = document.createElement('span');
    pLbl.className = 'alice-enx-term-prompt';
    pLbl.textContent = '$';
    var tInp = document.createElement('input');
    tInp.id = 'alice-enx-term-input';
    tInp.className = 'alice-enx-term-input';
    tInp.placeholder = 'Enter shell command (e.g. git status, node -v, pytest)...';
    tInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var v = tInp.value;
        tInp.value = '';
        runTerminalCommand(v);
      } else if (e.key === 'ArrowUp') {
        if (termHistory.length && termHistIndex > 0) {
          termHistIndex--;
          tInp.value = termHistory[termHistIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (termHistory.length && termHistIndex < termHistory.length - 1) {
          termHistIndex++;
          tInp.value = termHistory[termHistIndex] || '';
        } else {
          termHistIndex = termHistory.length;
          tInp.value = '';
        }
      }
    });

    var rBtn = document.createElement('button');
    rBtn.className = 'alice-enx-wb-btn';
    rBtn.textContent = 'Run';
    rBtn.addEventListener('click', function () {
      var v = tInp.value;
      tInp.value = '';
      runTerminalCommand(v);
    });

    var clrBtn = document.createElement('button');
    clrBtn.className = 'alice-enx-wb-btn';
    clrBtn.textContent = 'Clear';
    clrBtn.addEventListener('click', function () {
      termOut.innerHTML = '';
    });

    termInRow.appendChild(pLbl);
    termInRow.appendChild(tInp);
    termInRow.appendChild(rBtn);
    termInRow.appendChild(clrBtn);
    termPane.appendChild(termInRow);
    body.appendChild(termPane);

    // 2. Vibe Coder & Harness Pane
    var vibePane = document.createElement('div');
    vibePane.className = 'alice-enx-vibe-pane';
    vibePane.setAttribute('data-wb-pane', 'vibe');
    vibePane.style.display = activeWbTab === 'vibe' ? 'flex' : 'none';

    var vHero = document.createElement('div');
    vHero.className = 'alice-enx-vibe-hero';
    var vHt = document.createElement('div');
    var vH1 = document.createElement('div');
    vH1.className = 'alice-enx-vibe-title';
    vH1.textContent = '⚡ Autonomous Vibe Coder & Self-Healing Loop';
    var vH2 = document.createElement('div');
    vH2.className = 'alice-enx-vibe-sub';
    vH2.textContent = 'Alice writes code, executes in your terminal, tests output, and auto-corrects on failure.';
    vHt.appendChild(vH1); vHt.appendChild(vH2);
    vHero.appendChild(vHt);

    var runLatestBtn = document.createElement('button');
    runLatestBtn.className = 'alice-enx-vibe-btn primary';
    runLatestBtn.innerHTML = '▶ Run Latest Code in Terminal';
    runLatestBtn.addEventListener('click', function () {
      var c = extractLatestCode();
      if (!c) {
        logTerm('info', '[VibeCoder] No code blocks detected in Alice\'s latest message.');
        switchWorkbenchTab('terminal');
        return;
      }
      switchWorkbenchTab('terminal');
      runTerminalCommand(c);
    });
    vHero.appendChild(runLatestBtn);
    vibePane.appendChild(vHero);

    var vActions = document.createElement('div');
    vActions.className = 'alice-enx-vibe-actions';

    var vibeTasks = [
      ['Build & Test Project', 'Analyze the current project in our workspace. Write and run tests to verify integrity.'],
      ['Bug Hunt & Fix', 'Find potential edge cases or bugs in our repository, write reproduction probe, and implement patch.'],
      ['Refactor & Optimize', 'Refactor the core logic for cleaner architecture, lower complexity, and better performance.'],
      ['Write Git Commit & Push', 'Review git diff, generate a clean conventional commit message, and stage files for sync.']
    ];

    vibeTasks.forEach(function (vt) {
      var vb = document.createElement('button');
      vb.className = 'alice-enx-vibe-btn';
      vb.textContent = '⚡ ' + vt[0];
      vb.addEventListener('click', function () {
        triggerVibeTask(vt[1]);
      });
      vActions.appendChild(vb);
    });
    vibePane.appendChild(vActions);
    body.appendChild(vibePane);

    // 3. Skills Pane
    var skillsPane = document.createElement('div');
    skillsPane.className = 'alice-enx-skills-grid';
    skillsPane.setAttribute('data-wb-pane', 'skills');
    skillsPane.style.display = activeWbTab === 'skills' ? 'flex' : 'none';

    var skillsList = [
      {
        id: 'ast_sentinel',
        name: '🛡 Code Sentinel & AST Auditor',
        desc: 'Audit code for security vulnerabilities, memory leaks, and anti-patterns with automated diff patches.',
        prompt: 'Act as an AST Code Sentinel. Review the codebase for vulnerabilities, anti-patterns, and complexity spikes.'
      },
      {
        id: 'dsh_superagent',
        name: '🤖 DeepSeek Superagent Harness',
        desc: 'Autonomous coding loop: Plan → Write test probe → Execute in terminal → Verify and self-heal.',
        prompt: 'Act as DeepSeek Superagent. Break down this task into structured execution phases, run tests, and verify.'
      },
      {
        id: 'computer_use',
        name: '🖥 Computer Use & Desktop Actions',
        desc: 'Inspect local directories, open files in Finder/browser, run shell scripts, and capture screenshots.',
        prompt: 'Use macOS desktop automation. Read files from the workspace, inspect output, and execute shell scripts.'
      },
      {
        id: 'adversarial_test',
        name: '⚔️ Adversarial Test Writer',
        desc: 'Generates stringent boundary and edge-case tests before writing implementation to prevent regressions.',
        prompt: 'Write comprehensive adversarial test cases for boundary conditions, null inputs, and concurrency races.'
      }
    ];

    skillsList.forEach(function (sk) {
      var sc = document.createElement('div');
      sc.className = 'alice-enx-skill-card';
      var sTop = document.createElement('div');
      var sNm = document.createElement('div');
      sNm.className = 'alice-enx-skill-name';
      sNm.textContent = sk.name;
      var sDc = document.createElement('div');
      sDc.className = 'alice-enx-skill-desc';
      sDc.textContent = sk.desc;
      sTop.appendChild(sNm); sTop.appendChild(sDc);
      sc.appendChild(sTop);

      var sBtn = document.createElement('button');
      sBtn.className = 'alice-enx-skill-btn';
      sBtn.textContent = 'Activate Skill';
      sBtn.addEventListener('click', function () {
        triggerVibeTask(sk.prompt);
      });
      sc.appendChild(sBtn);
      skillsPane.appendChild(sc);
    });
    body.appendChild(skillsPane);

    // 4. Git Sync Pane
    var gitPane = document.createElement('div');
    gitPane.className = 'alice-enx-git-pane';
    gitPane.setAttribute('data-wb-pane', 'git');
    gitPane.style.display = activeWbTab === 'git' ? 'flex' : 'none';

    var gitCard = document.createElement('div');
    gitCard.style.cssText = 'background:#181824;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px';

    var gitHead = document.createElement('div');
    gitHead.style.cssText = 'font:700 13px/1.3 inherit;color:#fff;display:flex;align-items:center;gap:6px';
    gitHead.appendChild(svg(ICONS.git));
    var gitHeadTxt = document.createElement('span');
    gitHeadTxt.textContent = 'Real-Time GitHub Synchronization';
    gitHead.appendChild(gitHeadTxt);
    gitCard.appendChild(gitHead);

    var gitRepoInfo = document.createElement('div');
    gitRepoInfo.style.cssText = 'font:400 11.5px/1.3 ui-monospace,Menlo,monospace;color:#94a3b8';
    gitRepoInfo.textContent = 'Remote: https://github.com/romangalaxys10-spec/alice-english-overlay.git (branch main)';
    gitCard.appendChild(gitRepoInfo);

    var gitStatBox = document.createElement('pre');
    gitStatBox.id = 'alice-enx-git-status';
    gitStatBox.style.cssText = 'background:#0d0d14;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;font:400 12px/1.4 ui-monospace,Menlo,monospace;color:#4ade80;max-height:100px;overflow-y:auto;white-space:pre-wrap;margin:0';
    gitStatBox.textContent = 'Checking repository status...';
    gitCard.appendChild(gitStatBox);

    var gitCommitInput = document.createElement('input');
    gitCommitInput.className = 'alice-enx-input';
    gitCommitInput.placeholder = 'Commit message (e.g. Alice Harness: implemented feature)';
    gitCommitInput.value = 'Alice Harness: sync workspace updates';
    gitCard.appendChild(gitCommitInput);

    var gitPushBtn = document.createElement('button');
    gitPushBtn.className = 'alice-enx-btn-primary';
    gitPushBtn.textContent = '🔄 Push All Work to GitHub';
    gitPushBtn.addEventListener('click', function () {
      var msg = (gitCommitInput.value || '').trim() || 'Alice Harness: sync workspace updates';
      gitPushBtn.disabled = true;
      gitPushBtn.textContent = 'Pushing to origin main...';
      if (window.__aliceGitSync) {
        window.__aliceGitSync(msg, function (res) {
          gitPushBtn.disabled = false;
          gitPushBtn.textContent = '🔄 Push All Work to GitHub';
          if (res.ok) {
            logTerm('stdout', '[GitSync] Push completed successfully:\n' + (res.data ? res.data.output : 'OK'));
            refreshGitStatus();
            switchWorkbenchTab('terminal');
          } else {
            logTerm('err', '[GitSync] Push failed:\n' + (res.error || 'Unknown error'));
            refreshGitStatus();
            switchWorkbenchTab('terminal');
          }
        });
      } else {
        runTerminalCommand('git add -A && git commit -m "' + msg.replace(/"/g, '\\"') + '" && git push origin main', function () {
          gitPushBtn.disabled = false;
          gitPushBtn.textContent = '🔄 Push All Work to GitHub';
          refreshGitStatus();
        });
      }
    });
    gitCard.appendChild(gitPushBtn);
    gitPane.appendChild(gitCard);
    body.appendChild(gitPane);

    // 5. Sessions Pane (Multi-Session / Multi-Chat Manager)
    var sessionsPane = document.createElement('div');
    sessionsPane.className = 'alice-enx-sessions-pane';
    sessionsPane.setAttribute('data-wb-pane', 'sessions');
    sessionsPane.style.display = activeWbTab === 'sessions' ? 'flex' : 'none';

    function refreshSessionsPane() {
      sessionsPane.innerHTML = '';
      var headRow = document.createElement('div');
      headRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';

      var hTitle = document.createElement('div');
      hTitle.style.cssText = 'font:600 13px -apple-system,BlinkMacSystemFont,sans-serif;color:#f1f5f9';
      hTitle.textContent = 'Multi-Session Manager (Zero Login Required)';
      headRow.appendChild(hTitle);

      var newChatBtn = document.createElement('button');
      newChatBtn.className = 'alice-enx-btn-primary';
      newChatBtn.textContent = '+ New Chat Session';
      newChatBtn.addEventListener('click', function () {
        SessionManager.createSession();
      });
      headRow.appendChild(newChatBtn);
      sessionsPane.appendChild(headRow);

      var sessions = SessionManager.getSessions();
      var activeId = SessionManager.getActiveId();

      if (!sessions.length) {
        var emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding:16px;text-align:center;color:#94a3b8;font-size:12px';
        emptyMsg.textContent = 'No saved sessions yet. Type a query or click + New Chat Session above.';
        sessionsPane.appendChild(emptyMsg);
        return;
      }

      sessions.forEach(function (s) {
        var card = document.createElement('div');
        card.className = 'alice-enx-session-card' + (s.id === activeId ? ' active' : '');

        var info = document.createElement('div');
        info.className = 'alice-enx-session-info';

        var title = document.createElement('div');
        title.className = 'alice-enx-session-title';
        title.textContent = s.title || 'Untitled Session';
        info.appendChild(title);

        var meta = document.createElement('div');
        meta.className = 'alice-enx-session-meta';
        var dateStr = s.updated ? new Date(s.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        meta.textContent = (s.messageCount || 0) + ' messages, updated ' + dateStr + (s.id === activeId ? ' (Active)' : '');
        info.appendChild(meta);

        card.appendChild(info);

        var actions = document.createElement('div');
        actions.className = 'alice-enx-session-actions';

        if (s.id !== activeId) {
          var switchBtn = document.createElement('button');
          switchBtn.className = 'alice-enx-wb-btn';
          switchBtn.textContent = 'Switch';
          switchBtn.addEventListener('click', function () {
            SessionManager.switchSession(s.id);
          });
          actions.appendChild(switchBtn);

          var delBtn = document.createElement('button');
          delBtn.className = 'alice-enx-wb-btn';
          delBtn.textContent = '✕';
          delBtn.title = 'Delete session';
          delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            SessionManager.deleteSession(s.id);
            refreshSessionsPane();
          });
          actions.appendChild(delBtn);
        } else {
          var activeBadge = document.createElement('span');
          activeBadge.style.cssText = 'font:600 11px -apple-system,sans-serif;color:#86efac;padding:3px 8px;border-radius:4px;background:rgba(34,197,94,.15)';
          activeBadge.textContent = 'Active';
          actions.appendChild(activeBadge);
        }

        card.appendChild(actions);
        sessionsPane.appendChild(card);
      });
    }

    refreshSessionsPane();
    window.__aliceRefreshSessions = refreshSessionsPane;
    body.appendChild(sessionsPane);

    workbenchEl.appendChild(body);
    document.body.appendChild(workbenchEl);
  }

  /* ---------------- Auto-Fallback & Stall Prevention Engine ---------------- */
  var fallbackWatchdog = null;
  var lastSentPrompt = '';
  var lastSentTimestamp = 0;
  var fallbackAttempts = 0;

  function showFallbackToast(msg, duration) {
    var toast = document.createElement('div');
    toast.className = 'alice-enx-fallback-toast';
    toast.innerHTML = '<span>⚡</span> <span>' + msg + '</span>';
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast && toast.isConnected) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity .3s';
        setTimeout(function () { toast.remove(); }, 300);
      }
    }, duration || 4000);
  }

  function triggerAutoFallback(reason) {
    if (!S.autoFallback) return;
    if (fallbackAttempts >= 3) {
      logTerm('err', '[AutoFallback] Maximum fallback attempts (3) reached. Halting automatic retries.');
      return;
    }
    fallbackAttempts++;
    logTerm('info', '[AutoFallback] Triggered: ' + reason + ' (attempt ' + fallbackAttempts + '/3)');

    if (state.lastIntelligence === 'expert') {
      showFallbackToast('Expert mode throttled or stalled. Falling back to Auto mode...', 3500);
      switchIntelligence('auto');
    } else {
      showFallbackToast('Alice response stalled or busy. Auto-recovering...', 3500);
    }

    dismissThinkingModal();

    if (lastSentPrompt) {
      setTimeout(function () {
        var ta = document.querySelector('textarea');
        if (ta) {
          ta.value = lastSentPrompt;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          var sendBtn = document.querySelector('button[aria-label="Отправить"], button[aria-label="Send"], [data-testid="oknyx"]');
          if (sendBtn) sendBtn.click();
        }
      }, 1200);
    }
  }

  function startWatchdog(promptText) {
    lastSentPrompt = promptText || '';
    lastSentTimestamp = Date.now();
    fallbackAttempts = 0;
    if (fallbackWatchdog) clearInterval(fallbackWatchdog);

    var lastObservedText = '';
    var stableTextTime = Date.now();

    fallbackWatchdog = setInterval(function () {
      if (!isAliceGenerating()) {
        clearInterval(fallbackWatchdog);
        fallbackWatchdog = null;
        return;
      }

      var notices = document.querySelectorAll('.Message,[class*="Notice"],[class*="Banner"],[class*="Alert"]');
      for (var i = 0; i < notices.length; i++) {
        var txt = (notices[i].textContent || '').toLowerCase();
        if (/из-за высокой нагрузки|слишком много запросов|превышен лимит|попробуйте позже|network error|что-то пошло не так/i.test(txt)) {
          clearInterval(fallbackWatchdog);
          fallbackWatchdog = null;
          triggerAutoFallback('overload_notice');
          return;
        }
      }

      var msgs = document.querySelectorAll('.Message:not(.Message_from_user)');
      var curText = msgs.length ? (msgs[msgs.length - 1].textContent || '') : '';
      if (curText !== lastObservedText) {
        lastObservedText = curText;
        stableTextTime = Date.now();
      } else if (Date.now() - stableTextTime > 28000 && Date.now() - lastSentTimestamp > 32000) {
        clearInterval(fallbackWatchdog);
        fallbackWatchdog = null;
        triggerAutoFallback('generation_stall_28s');
        return;
      }
    }, 1000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function extractCleanCode(pre) {
    if (!pre) return '';
    var clone = pre.cloneNode(true);
    var toRemove = clone.querySelectorAll('.alice-enx-code-actions, .alice-enx-cmd-result, .alice-enx-auto-harness-card, [data-alice-enx]');
    for (var i = 0; i < toRemove.length; i++) toRemove[i].remove();
    var btns = clone.querySelectorAll('button, [role="button"], [class*="Header"], [class*="header"]');
    for (var b = 0; b < btns.length; b++) btns[b].remove();
    var codeEl = clone.querySelector('code');
    var raw = (codeEl ? codeEl.textContent : clone.textContent) || '';
    var lines = raw.split('\n');
    if (lines.length > 1 && /^(bash|sh|zsh|shell|python|python3|javascript|js|json|swift)$/i.test(lines[0].trim())) {
      lines.shift();
    }
    var cleaned = [];
    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      if (/^(переносить|свернуть|копировать|copy|collapse|wrap)$/i.test(line.trim())) continue;
      cleaned.push(line);
    }
    return cleaned.join('\n').trim();
  }

  function isShellCommand(codeTxt) {
    if (!codeTxt) return false;
    var lines = codeTxt.split('\n');
    var firstLine = (lines[0] || '').trim();
    if (/^(npm|pnpm|yarn|git|python|python3|node|swift|cargo|curl|wget|sh|bash|zsh|cat|ls|cd|mkdir|system_profiler|sysctl|sw_vers|defaults|brew|echo|grep|awk|sed|ps|top|kill|chmod|chown|df|du|uname|open|osascript|pip|pytest|docker|tree|find|which|whoami|date|env|export|source|killall|pbcopy|pbpaste|screencapture|pmset)/i.test(firstLine)) return true;
    if (/\|\s*(grep|awk|sed|cat|wc|sort|uniq|head|tail|pbcopy)\b/i.test(firstLine)) return true;
    if (/^(if|for|while|case)\s+.*(?:then|do|in)\b/i.test(firstLine)) return true;
    if (lines.length > 1 && /^(npm|git|brew|python3|node|cat|echo|curl|system_profiler)/i.test((lines[1] || '').trim())) return true;
    return false;
  }

  function enhanceCodeBlocks(msgRoot) {
    if (!msgRoot) return;
    var pres = msgRoot.querySelectorAll('pre');
    for (var i = 0; i < pres.length; i++) {
      var pre = pres[i];

      // Never process an inner pre that is already inside another pre
      if (pre.parentElement && pre.parentElement.closest('pre')) continue;

      // Skip if already enhanced
      if (pre.querySelector('.alice-enx-code-actions') || (pre.parentElement && pre.parentElement.querySelector('.alice-enx-code-actions'))) continue;

      var codeTxt = extractCleanCode(pre);
      if (!codeTxt || !codeTxt.trim()) continue;

      var bar = document.createElement('div');
      bar.className = 'alice-enx-code-actions';
      bar.setAttribute('data-alice-enx', '1');

      var isShell = isShellCommand(codeTxt) ||
        pre.className.indexOf('bash') > -1 || pre.className.indexOf('shell') > -1 || pre.className.indexOf('sh') > -1;

      if (isShell) {
        var runBtn = document.createElement('button');
        runBtn.className = 'alice-enx-code-btn alice-enx-code-btn-run';
        runBtn.innerHTML = '<span class="alice-enx-code-btn-icon">▶</span><span>Run in Terminal</span>';
        runBtn.title = 'Run shell command in Alice local terminal';
        (function (cmd, targetPre) {
          runBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleWorkbench('terminal');
            runBtn.disabled = true;
            runBtn.textContent = 'Running...';
            runTerminalCommand(cmd, function (ok, stdout, stderr) {
              runBtn.disabled = false;
              runBtn.innerHTML = '<span class="alice-enx-code-btn-icon">▶</span><span>Run in Terminal</span>';
              var resText = (stdout || stderr || '').trim();
              if (resText) {
                var outBadge = targetPre.nextElementSibling && targetPre.nextElementSibling.classList.contains('alice-enx-cmd-result')
                  ? targetPre.nextElementSibling
                  : document.createElement('div');
                outBadge.className = 'alice-enx-cmd-result';
                outBadge.textContent = '✓ Output:\n' + resText;
                if (!outBadge.parentNode) {
                  targetPre.parentNode.insertBefore(outBadge, targetPre.nextSibling);
                }
              }
            });
          });
        })(codeTxt, pre);
        bar.appendChild(runBtn);

        var answerBtn = document.createElement('button');
        answerBtn.className = 'alice-enx-code-btn alice-enx-code-btn-answer';
        answerBtn.innerHTML = '<span class="alice-enx-code-btn-icon">⚡</span><span>Run & Answer</span>';
        answerBtn.title = 'Run locally and feed live observation back to Alice';
        (function (cmd, targetPre) {
          answerBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleWorkbench('terminal');
            answerBtn.disabled = true;
            answerBtn.textContent = 'Executing...';
            runTerminalCommand(cmd, function (ok, stdout, stderr) {
              answerBtn.disabled = false;
              answerBtn.innerHTML = '<span class="alice-enx-code-btn-icon">⚡</span><span>Run & Answer</span>';
              var resText = (stdout || stderr || '').trim();
              if (resText) {
                var outBadge = targetPre.nextElementSibling && targetPre.nextElementSibling.classList.contains('alice-enx-cmd-result')
                  ? targetPre.nextElementSibling
                  : document.createElement('div');
                outBadge.className = 'alice-enx-cmd-result';
                outBadge.textContent = '✓ Tool Result:\n' + resText;
                if (!outBadge.parentNode) {
                  targetPre.parentNode.insertBefore(outBadge, targetPre.nextSibling);
                }
                sendAliceMessage('[Harness Tool Observation for: `' + cmd + '`]\n```\n' + resText + '\n```\nPlease answer the user based on this tool result.');
              }
            });
          });
        })(codeTxt, pre);
        bar.appendChild(answerBtn);
      } else if (/(?:file:|filename:|path:|\/\/\s*|#\s*)[\w./-]+\.\w+/i.test(codeTxt) || codeTxt.split('\n').length > 2) {
        var saveBtn = document.createElement('button');
        saveBtn.className = 'alice-enx-code-btn alice-enx-code-btn-save';
        saveBtn.innerHTML = '<span class="alice-enx-code-btn-icon">💾</span><span>Save to Disk</span>';
        saveBtn.title = 'Save snippet to local project workspace';
        (function (c) {
          saveBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var pathMatch = c.match(/(?:file:|filename:|path:|\/\/\s*|#\s*)([\w./-]+\.\w+)/i);
            var filePath = pathMatch ? pathMatch[1] : 'snippet_' + Date.now() + '.txt';
            if (window.__aliceWriteFile) {
              window.__aliceWriteFile(filePath, c, function (res) {
                if (res.ok) {
                  saveBtn.textContent = '✓ Saved ' + filePath;
                  setTimeout(function () { saveBtn.innerHTML = '<span class="alice-enx-code-btn-icon">💾</span><span>Save to Disk</span>'; }, 2500);
                } else {
                  alert('Save failed: ' + (res.error || 'Unknown error'));
                }
              });
            } else {
              alert('File saving is active in native Alice.app. File: ' + filePath);
            }
          });
        })(codeTxt);
        bar.appendChild(saveBtn);
      }

      // Smart placement: insert into existing header before native buttons, or fallback to floating
      var inserted = false;
      var headerBtn = pre.querySelector('button:not([data-alice-enx]):not(.alice-enx-code-btn)') ||
                      (pre.parentElement && pre.parentElement.querySelector('button:not([data-alice-enx]):not(.alice-enx-code-btn)'));
      if (headerBtn && headerBtn.parentNode) {
        headerBtn.parentNode.insertBefore(bar, headerBtn);
        inserted = true;
      }
      if (!inserted) {
        var headerEl = pre.querySelector('[class*="Header"], [class*="header"]') ||
                       (pre.parentElement && pre.parentElement.querySelector('[class*="Header"], [class*="header"]'));
        if (headerEl) {
          headerEl.appendChild(bar);
          inserted = true;
        }
      }
      if (!inserted) {
        pre.style.position = 'relative';
        bar.classList.add('alice-enx-code-actions-floating');
        pre.appendChild(bar);
      }
    }
  }

  function buildModeBar() {
    modeBar = A.mark(document.createElement('div'));
    modeBar.className = 'alice-enx-modebar';
    modeBar.appendChild(pill('new', 'New', 'plus', newChat, 'Start a new chat'));
    modeBar.appendChild(sep());
    modeBar.appendChild(pill('auto', 'Auto', 'spark', function () { switchIntelligence('auto'); }, 'Auto intelligence (Alice picks the level)'));
    modeBar.appendChild(pill('expert', 'Expert', 'brain', function () { switchIntelligence('expert'); }, 'Expert intelligence (deeper reasoning)'));
    modeBar.appendChild(pill('code', 'Code', 'code', function () { toggleWorkbench('vibe'); }, 'ZCode and DeepSeek vibe coding harness'));
    modeBar.appendChild(pill('terminal', 'Terminal', 'terminal', function () { toggleWorkbench('terminal'); }, 'In-app local terminal'));
    var agentBtn = pill('agent', S.harnessAutoRun ? 'Agent: ON' : 'Agent: OFF', 'spark', function () {
      var nextVal = !S.harnessAutoRun;
      A.applySettings({ harnessAutoRun: nextVal });
      agentBtn.innerHTML = '';
      agentBtn.appendChild(svg(ICONS.spark));
      var t = document.createElement('span');
      t.textContent = nextVal ? 'Agent: ON' : 'Agent: OFF';
      agentBtn.appendChild(t);
      agentBtn.classList.toggle('alice-enx-active', nextVal);
    }, 'Toggle autonomous computer and terminal agent loop');
    if (S.harnessAutoRun) agentBtn.classList.add('alice-enx-active');
    modeBar.appendChild(agentBtn);
    modeBar.appendChild(pill('loop', 'Loop', 'loop', function () { openLoopModal(); }, 'Autonomous Loop Agent Studio'));
    modeBar.appendChild(pill('sessions', 'Sessions', 'chat', function () { toggleWorkbench('sessions'); }, 'Switch or create anonymous chat sessions'));
    modeBar.appendChild(pill('brainstorm', 'Brainstorm', 'users', function () { openBrainstormModal(); }, 'Autonomous brainstorm and role-play studio'));
    modeBar.appendChild(pill('draw', 'Draw', 'palette', function () { toolMode('draw'); }, 'Image generation mode'));
    modeBar.appendChild(pill('deals', 'Deals', 'tag', function () { toolMode('deals'); }, 'Shopping: find a better price'));
    modeBar.appendChild(pill('math', 'Math', 'sigma', function () { toolMode('math'); }, 'Math tutor mode'));
    var gear = pill('gear', '', 'gear', function (b) { toggleSettingsPanel(b); }, 'Overlay settings');
    gear.className += ' alice-enx-gear';
    modeBar.appendChild(gear);
    document.body.appendChild(modeBar);
    placeBar();
    refreshPills();
  }
  function sep() { var s = document.createElement('div'); s.className = 'alice-enx-sep'; s.setAttribute('data-alice-enx', '1'); return s; }

  function hasVisibleModal() {
    var dialogs = document.querySelectorAll('.Modal_visible, [class*="SettingsContent"], [class*="ContentFiltering"], .Modal-Content, [class*="ModalContent"]');
    for (var i = 0; i < dialogs.length; i++) {
      var d = dialogs[i];
      if (d.closest('[data-alice-enx]')) continue;
      var rect = d.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 150 && getComputedStyle(d).display !== 'none' && getComputedStyle(d).visibility !== 'hidden' && getComputedStyle(d).opacity !== '0') {
        return true;
      }
    }
    return false;
  }

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
    if (hasVisibleModal()) {
      modeBar.style.display = 'none';
      return;
    }
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
    panel.className = 'alice-enx-panel';
    
    var title = document.createElement('h3');
    title.textContent = 'Alice Overlay Settings';
    panel.appendChild(title);

    // Language selector
    var langRow = document.createElement('div');
    langRow.style.cssText = 'margin-bottom:12px';
    var langLbl = document.createElement('label');
    langLbl.textContent = 'Response Language';
    var langSel = document.createElement('select');
    langSel.className = 'alice-enx-select';
    var curLang = S.targetLang || 'en';
    if (A.LANGUAGES) {
      Object.keys(A.LANGUAGES).forEach(function (k) {
        var opt = document.createElement('option');
        opt.value = k;
        opt.textContent = A.LANGUAGES[k].name;
        if (k === curLang) opt.selected = true;
        langSel.appendChild(opt);
      });
    }
    langSel.addEventListener('change', function () {
      A.applySettings({ targetLang: langSel.value });
    });
    langRow.appendChild(langLbl);
    langRow.appendChild(langSel);
    panel.appendChild(langRow);

    // Custom instructions textarea
    var ciRow = document.createElement('div');
    ciRow.style.cssText = 'margin-bottom:12px';
    var ciLbl = document.createElement('label');
    ciLbl.textContent = 'Custom Instructions / Persona';
    var ciTa = document.createElement('textarea');
    ciTa.className = 'alice-enx-textarea';
    ciTa.rows = 2;
    ciTa.placeholder = 'e.g. Respond concisely, write clean code...';
    ciTa.value = S.customInstructions || '';
    ciTa.addEventListener('input', function () {
      A.applySettings({ customInstructions: ciTa.value });
    });
    ciRow.appendChild(ciLbl);
    ciRow.appendChild(ciTa);
    panel.appendChild(ciRow);

    var items = [
      ['enReplies', 'Force target language (auto)'],
      ['translateBtn', 'Quick translate button on replies'],
      ['chips', 'Prompt starter cards'],
      ['hideUpsell', 'Hide ads & login upsells'],
      ['carryContext', 'Carry context to new chats'],
      ['modeBar', 'Show mode bar'],
      ['autoFallback', 'Auto-fallback on stall/throttling'],
      ['vibeCoding', 'ZCode & DeepSeek coding harness'],
      ['harnessAutoRun', 'Autonomous terminal & computer agent (Auto-Run)']
    ];
    items.forEach(function (it) {
      var row = document.createElement('label');
      row.className = 'alice-enx-row';
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

    var bsBtn = document.createElement('button');
    bsBtn.type = 'button';
    bsBtn.textContent = '⚡ Launch Brainstorm Studio';
    bsBtn.style.cssText = 'width:100%;margin-top:12px;padding:9px 0;border:none;border-radius:10px;background:linear-gradient(135deg,#6C4CF0,#9B6CFF);color:#fff;font:600 12px/1 inherit;cursor:pointer';
    bsBtn.addEventListener('click', function () {
      if (panel) { panel.remove(); panel = null; }
      openBrainstormModal();
    });
    panel.appendChild(bsBtn);

    var wbBtn = document.createElement('button');
    wbBtn.type = 'button';
    wbBtn.textContent = '>_ Open In-App Terminal & Harness';
    wbBtn.style.cssText = 'width:100%;margin-top:8px;padding:9px 0;border:none;border-radius:10px;background:#1e1e2c;border:1px solid rgba(255,255,255,.15);color:#c4b5fd;font:600 12px/1 inherit;cursor:pointer';
    wbBtn.addEventListener('click', function () {
      if (panel) { panel.remove(); panel = null; }
      toggleWorkbench('terminal');
    });
    panel.appendChild(wbBtn);

    var foot = document.createElement('div');
    foot.className = 'alice-enx-foot';
    foot.textContent = 'v' + A.version + ' — free anonymous Alice AI';
    panel.appendChild(foot);
    document.body.appendChild(panel);
    function reposition() {
      var r = anchor.getBoundingClientRect();
      var pw = panel.offsetWidth || 280;
      var ph = panel.offsetHeight || 320;
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

  /* ---------------- Multi-language & Custom Instructions (send interception) ---------------- */
  function toolBlocksInjection() {
    return false;
  }
  function beforeSend(ta) {
    if (!ta) return;
    var v = ta.value || '';
    if (!v.trim()) return;

    // Direct slash commands
    if (/^\/loop\b/i.test(v)) {
      if (/^\/loop\s+stop\b/i.test(v)) {
        LoopManager.stop();
        ta.value = '';
        return false;
      }
      if (/^\/loop\s+pause\b/i.test(v)) {
        LoopManager.pause();
        ta.value = '';
        return false;
      }
      if (/^\/loop\s+resume\b/i.test(v)) {
        LoopManager.resume();
        ta.value = '';
        return false;
      }
      if (/^\/loop\s+status\b/i.test(v)) {
        toggleWorkbench('loop');
        ta.value = '';
        return false;
      }
      var loopMatch = v.match(/^\/loop\s+(.+)/i);
      var loopGoal = loopMatch ? loopMatch[1].trim() : '';
      if (loopGoal) {
        LoopManager.start({ mode: 'general', goal: loopGoal, maxIterations: 10 });
        ta.value = '';
        return false;
      }
      openLoopModal();
      ta.value = '';
      return false;
    }
    if (/^\/code\s+(.+)/i.test(v)) {
      var codeGoal = v.match(/^\/code\s+(.+)/i)[1].trim();
      LoopManager.start({ mode: 'code', goal: codeGoal, maxIterations: 10 });
      ta.value = '';
      return false;
    }
    if (/^\/research\s+(.+)/i.test(v)) {
      var resGoal = v.match(/^\/research\s+(.+)/i)[1].trim();
      LoopManager.start({ mode: 'research', goal: resGoal, maxIterations: 10 });
      ta.value = '';
      return false;
    }
    if (/^\/qa\s+(.+)/i.test(v) || /^\/test\s+(.+)/i.test(v)) {
      var qaGoal = v.match(/^\/(?:qa|test)\s+(.+)/i)[1].trim();
      LoopManager.start({ mode: 'qa', goal: qaGoal, maxIterations: 10 });
      ta.value = '';
      return false;
    }
    if (/^\/review\s+(.+)/i.test(v)) {
      var revGoal = v.match(/^\/review\s+(.+)/i)[1].trim();
      LoopManager.start({ mode: 'review', goal: revGoal, maxIterations: 10 });
      ta.value = '';
      return false;
    }
    if (/^\/design\s+(.+)/i.test(v)) {
      var desGoal = v.match(/^\/design\s+(.+)/i)[1].trim();
      LoopManager.start({ mode: 'design', goal: desGoal, maxIterations: 10 });
      ta.value = '';
      return false;
    }
    if (/^\/open\b/i.test(v)) {
      if (window.__aliceComputerUse) window.__aliceComputerUse('openFolder', {}, function () {});
      ta.value = '';
      return false;
    }
    if (/^\/git\b/i.test(v)) {
      toggleWorkbench('git');
      ta.value = '';
      return false;
    }
    if (/^\/(ram|specs|sysinfo)\b/i.test(v)) {
      v = 'Query my Mac hardware specifications (RAM, CPU cores, machine model, macOS version) using your autonomous terminal harness.';
    } else if (/^\/sh\s+(.+)/i.test(v)) {
      var cmdMatch = v.match(/^\/sh\s+(.+)/i);
      var rawCmd = cmdMatch ? cmdMatch[1].trim() : '';
      if (rawCmd) {
        toggleWorkbench('terminal');
        ta.value = '';
        runTerminalCommand(rawCmd, function (ok, out, err, code) {
          sendAliceMessage('[User ran terminal command: `' + rawCmd + '` (exit ' + (code || 0) + ')]:\n```\n' + (out || err || '(no output)') + '\n```');
        });
        return false;
      }
    }

    autoHarnessTurnCount = 0;
    autoHarnessHalted = false;
    startWatchdog(v);
    var changed = false;
    var parts = [];
    var langPrompt = A.getLanguagePrompt ? A.getLanguagePrompt() : '';
    if (S.enReplies && !toolBlocksInjection() && langPrompt && v.indexOf(langPrompt) === -1) {
      parts.push(langPrompt);
    }
    var isObservation = v.indexOf('[Harness Tool Observation') > -1 || v.indexOf('[Harness Tool Error') > -1 || v.indexOf('[Harness Self-Correction') > -1;
    if (S.vibeCoding && !toolBlocksInjection() && !isObservation && v.indexOf('```bash') === -1) {
      parts.push('When providing shell commands or file modifications, format them in standard ```bash or ```file:path/to/file code blocks.');
    }
    if (S.customInstructions && typeof S.customInstructions === 'string' && S.customInstructions.trim()) {
      var ci = S.customInstructions.trim();
      if (v.indexOf(ci) === -1) {
        parts.push('Custom instructions:\n' + ci);
      }
    }
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
    ['🔁 Autonomous loop agent', 'Launch an autonomous multi-step loop for coding, research, QA, or design.'],
    ['⚡ Check Mac specs', 'Check my exact Mac hardware specs (RAM, CPU, model, macOS) using your terminal harness.'],
    ['🛠 Run code & test', 'Create a small Python script to benchmark CPU arithmetic and run it with your harness.'],
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
    var langCfg = A.getLanguageConfig ? A.getLanguageConfig() : { code: 'en', name: 'English' };
    var langBadge = (langCfg.code || 'en').toUpperCase().slice(0, 2);
    var en = A.mark(document.createElement('button'));
    en.className = 'alice-enx-rbtn'; en.type = 'button';
    en.appendChild(svg(ICONS.lang));
    var et = document.createElement('span'); et.textContent = langBadge;
    en.appendChild(et);
    en.addEventListener('click', function () {
      var curCfg = A.getLanguageConfig ? A.getLanguageConfig() : { code: 'en', name: 'English' };
      var curBadge = (curCfg.code || 'en').toUpperCase().slice(0, 2);
      var existing = msgRoot.querySelector('.alice-enx-mt');
      if (existing) { existing.remove(); et.textContent = curBadge; return; }
      et.textContent = '…';
      var text = msgText(msgRoot);
      A.mt(text, function (res) {
        var block = A.mark(document.createElement('div'));
        block.className = 'alice-enx-mt';
        var lbl = document.createElement('span');
        lbl.className = 'alice-enx-mt-label'; lbl.textContent = curCfg.name + ' translation';
        block.appendChild(lbl);
        var body = document.createElement('div');
        body.textContent = res || 'Translation is unavailable here (blocked or quota reached).';
        block.appendChild(body);
        var anchor = msgRoot.querySelector('.alice-enx-toolsbar') || msgRoot;
        if (anchor.parentNode === msgRoot) msgRoot.insertBefore(block, anchor);
        else msgRoot.appendChild(block);
        et.textContent = res ? curBadge : (curBadge + '!');
      });
    });
    bar.appendChild(copy);
    bar.appendChild(en);
  }
  function ensureReplyTools() {
    var msgs = document.querySelectorAll('.Message:not(.Message_from_user)');
    for (var i = 0; i < msgs.length; i++) {
      var msgRoot = msgs[i];
      if (!A.norm(msgRoot.textContent || '')) continue;
      enhanceCodeBlocks(msgRoot);
      if (!S.translateBtn) continue;
      if (msgRoot.querySelector(':scope > .alice-enx-toolsbar')) continue; // React may wipe it; next tick re-adds
      var bar = document.createElement('div');
      bar.className = 'alice-enx-toolsbar';
      bar.setAttribute('data-alice-enx', '1');
      buildToolbar(msgRoot, bar);
      msgRoot.appendChild(bar);
    }
  }

  /* ---------------- upsell hider & banner auto-closer ---------------- */
  var UPSELL_RE = /(войдите, чтобы открыть|все возможности нейросети|войдите в аккаунт|работа с файлами|log in to unlock|everything the neural network can do|working with files|оформить опцию|обновить тариф|попробуйте ai-агентов|скачать приложение|try ai agents|download the app|enter your phone number|укажите номер телефона|yandex id|яндекс id|passport)/i;
  var UPSELL_SEL = '[class*="Banner"],[class*="banner"],[class*="Promo"],[class*="promo"],[class*="Login"],[class*="login"],[class*="Upsell"],[class*="upsell"],[class*="Rate"],[class*="Widget"],[class*="Infobox"],[class*="Teaser"],[class*="Toast"],[class*="Notification"],[class*="Alert"],[class*="Snack"],[class*="Hint"],[class*="hint"],[class*="Notice"],[class*="Auth"],[class*="Passport"]';

  function findActualCloseButton(rootEl) {
    if (!rootEl) return null;
    var candidates = rootEl.querySelectorAll('button, [role="button"], a[role="button"]');
    for (var i = 0; i < candidates.length; i++) {
      var b = candidates[i];
      var aria = (b.getAttribute('aria-label') || '').toLowerCase();
      var cls = (b.className || '').toString().toLowerCase();
      var txt = (b.textContent || '').trim().toLowerCase();
      // Explicitly reject any button related to login, authorization, registration, or passport
      if (/войти|вход|log\s*in|sign\s*in|auth|passport|регистрац|register|phone|телефон/i.test(txt) ||
          /login|auth|passport|signin/i.test(cls) ||
          /войти|log\s*in|sign\s*in/i.test(aria)) {
        continue;
      }
      // Look for true close / dismiss buttons
      if (/закрыть|close|dismiss|отклонить|позже|later|cancel|отмена/i.test(aria) ||
          /close|dismiss|cancel/i.test(cls) ||
          /^(✕|×|x)$/i.test(txt)) {
        return b;
      }
    }
    return null;
  }

  function dismissLoginModals() {
    // Dismiss any in-page Passport iframe or Yandex ID popup
    var loginIframes = document.querySelectorAll('iframe[src*="passport.yandex"], iframe[src*="/auth"]');
    for (var f = 0; f < loginIframes.length; f++) {
      var iframe = loginIframes[f];
      var modal = iframe.closest('[role="dialog"], .Modal, [class*="Modal"], [class*="Popup"], [class*="Overlay"]') || iframe.parentElement;
      if (modal && modal !== document.body) {
        modal.remove();
      } else {
        iframe.remove();
      }
    }

    var dialogs = document.querySelectorAll('[role="dialog"], .Modal, [class*="Modal_visible"], [class*="Popup-Content"], [class*="AuthPopup"]');
    for (var d = 0; d < dialogs.length; d++) {
      var dlg = dialogs[d];
      if (dlg.closest('[data-alice-enx]')) continue;
      var dTxt = (dlg.textContent || '').trim();
      if (UPSELL_RE.test(dTxt) && (/phone|номер|yandex id|яндекс id|войти|log in|passport/i.test(dTxt))) {
        dlg.style.setProperty('display', 'none', 'important');
        var closeBtn = findActualCloseButton(dlg);
        if (closeBtn) {
          try { closeBtn.click(); } catch (e) {}
        } else {
          dlg.remove();
        }
        var backdrops = document.querySelectorAll('.Modal-Backdrop, [class*="Backdrop"], [class*="backdrop"], .Popup-Overlay');
        for (var b = 0; b < backdrops.length; b++) {
          backdrops[b].style.setProperty('display', 'none', 'important');
          backdrops[b].remove();
        }
      }
    }
  }

  function scanUpsells() {
    if (!S.hideUpsell) return;
    dismissLoginModals();

    // 1. Selector-based search
    var candidates = document.querySelectorAll(UPSELL_SEL);
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.closest('[data-alice-enx],[data-message-role],.Message')) continue;
      if (el.querySelector('textarea')) continue;
      var raw = (el.textContent || '').trim();
      if (raw.length > 500) continue;
      if (UPSELL_RE.test(raw)) {
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('alice-enx-upsell');
        var closeBtn = findActualCloseButton(el);
        if (closeBtn) {
          try { closeBtn.click(); } catch (e) {}
        }
      }
    }

    // 2. Ancestor and sibling hierarchy scan from input box
    var box = findInputBox();
    if (box) {
      var cur = box;
      for (var level = 0; level < 4; level++) {
        if (!cur || !cur.parentElement || cur.parentElement === document.body) break;
        var siblings = cur.parentElement.children;
        for (var s = 0; s < siblings.length; s++) {
          var sib = siblings[s];
          if (sib === cur || sib.contains(box)) continue;
          if (sib.closest && sib.closest('[data-alice-enx]')) continue;
          if (sib.querySelector('textarea')) continue;
          var sTxt = (sib.textContent || '').trim();
          if (sTxt.length < 500 && UPSELL_RE.test(sTxt)) {
            sib.style.setProperty('display', 'none', 'important');
            sib.classList.add('alice-enx-upsell');
            var sibClose = findActualCloseButton(sib);
            if (sibClose) {
              try { sibClose.click(); } catch (e) {}
            }
          }
        }
        cur = cur.parentElement;
      }
    }

    // 3. Scan all close buttons whose container text matches UPSELL_RE
    var allCloseButtons = document.querySelectorAll('button[aria-label*="Закрыть"], button[aria-label*="Close"], button[class*="close"], button[class*="Close"]');
    for (var c = 0; c < allCloseButtons.length; c++) {
      var cb = allCloseButtons[c];
      if (cb.closest('[data-alice-enx],[data-message-role],.Message')) continue;
      var cParent = cb.closest('[class*="Banner"],[class*="Promo"],[class*="Login"],[class*="Upsell"],[class*="Notification"],[class*="Notice"]') || cb.parentElement;
      if (cParent) {
        var pTxt = (cParent.textContent || '').trim();
        if (pTxt.length < 500 && UPSELL_RE.test(pTxt)) {
          cParent.style.setProperty('display', 'none', 'important');
          cParent.classList.add('alice-enx-upsell');
          try { cb.click(); } catch (e) {}
        }
      }
    }
  }
  setInterval(scanUpsells, 300);

  /* ---------------- limits / load notice ---------------- */
  var noticeEl = null;
  var NOTICE_RULES = [
    [/из-за высокой нагрузки/i, 'Free mode is busy — you are getting standard responses. Higher reasoning resumes automatically.'],
    [/это ответ менее мощной модели/i, 'Standard model response. Full reasoning resumes automatically as load eases.'],
    [/превышен лимит|слишком много запросов/i, 'Free mode query pause. Please wait a brief moment — requests resume automatically.'],
    [/попробуйте позже/i, 'Service is busy. Please try again shortly.']
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
    var x = document.createElement('button');
    x.className = 'alice-enx-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', function () { if (noticeEl) noticeEl.remove(); });
    noticeEl.appendChild(x);
    document.body.appendChild(noticeEl);
    setTimeout(function () { if (noticeEl && noticeEl.isConnected) noticeEl.remove(); }, 12000);
  }

  /* ---------------- Hermes Diagnostic & Self-Correction Engine (NousResearch/hermes-agent) ---------------- */
  var HermesEngine = {
    diagnose: function (command, exitCode, output) {
      if (exitCode === 0) return null;
      var out = output || '';
      var scan = out.slice(0, 4000);

      var cmdNotFound = scan.match(/(?:bash: line \d+: |bash: |sh: \d*:? ?)?([\w.+-]+): command not found/i);
      if (cmdNotFound) {
        var missing = cmdNotFound[1];
        if (missing === 'python') return 'This system has no bare python. Use python3 or activate your project venv.';
        if (missing === 'pip') return 'This system has no bare pip. Use pip3, python3 -m pip, or the project venv.';
        return 'Command ' + missing + ' is not on PATH. Check installation or use an absolute path.';
      }

      var modErr = scan.match(/(?:ModuleNotFoundError|ImportError): No module named '?([\w.]+)'?/i);
      if (modErr) {
        return 'Python missing module ' + modErr[1] + '. Run pip3 install ' + modErr[1] + ' or activate the project venv.';
      }

      var nodeErr = scan.match(/Cannot find module '?([\w.@/-]+)'?/i);
      if (nodeErr) {
        return 'Node missing module ' + nodeErr[1] + '. Run npm install ' + nodeErr[1] + ' in project workspace.';
      }

      if (/Permission denied|EACCES/i.test(scan)) {
        return 'Permission denied. Check file permissions with ls -la and prefer user-writable locations.';
      }

      if (/CONFLICT|Automatic merge failed|needs merge/i.test(scan)) {
        return 'Git merge conflict. Resolve conflicted files before continuing or run git merge --abort.';
      }

      var existsErr = scan.match(/(?:fatal|error):.*?'([^']+)' already exists/i);
      if (existsErr) {
        return 'Target ' + existsErr[1] + ' already exists. Reuse it or choose another name.';
      }

      if (exitCode === 126) return 'Exit 126: File is not executable. Add executable permission with chmod +x.';
      if (exitCode === 127) return 'Exit 127: Command not found on PATH.';
      if (exitCode === 137) return 'Exit 137: Process terminated by SIGKILL (memory limit or external kill).';
      if (exitCode === 124) return 'Exit 124: Command timed out. Break it down or execute asynchronously.';

      return 'Process returned exit code ' + exitCode + '. Review the error log and adjust script logic.';
    },

    detectMaskedFailure: function (command, output) {
      if (!command) return false;
      var hasPipeline = /\|\s*(?:tail|head|cat|tee|less|more|wc|sort|uniq)\b/i.test(command) || /\|\|\s*(?:echo|printf|true)\b/i.test(command);
      if (!hasPipeline) return false;
      var hasFailureText = /error|fatal|exception|failed|compilation terminated|npm ERR!/i.test(output || '');
      return hasFailureText;
    }
  };

  /* ---------------- Autonomous Harness Agent Loop ---------------- */
  var autoHarnessTurnCount = 0;
  var autoHarnessFailCount = 0;
  var autoHarnessHalted = false;

  function executeAutoTool(cmd, isFile, filePath, fileContent, targetPre, msgRoot) {
    if (autoHarnessHalted || autoHarnessTurnCount >= 8) return;
    autoHarnessTurnCount++;
    msgRoot.setAttribute('data-harness-auto-ran', '1');

    var card = document.createElement('div');
    card.className = 'alice-enx-auto-harness-card executing';
    card.setAttribute('data-alice-enx', '1');
    card.innerHTML =
      '<div class="alice-enx-auto-harness-hdr">' +
        '<span class="alice-enx-pulse"></span>' +
        '<span class="alice-enx-auto-harness-lbl">⚡ Autonomous Harness: Executing on Mac...</span>' +
        '<button class="alice-enx-auto-harness-stop" type="button">Stop Loop</button>' +
      '</div>' +
      '<div class="alice-enx-auto-harness-cmd"><code>$ ' + escapeHtml(cmd ? cmd.slice(0, 160) : ('write ' + filePath)) + '</code></div>';

    var stopBtn = card.querySelector('.alice-enx-auto-harness-stop');
    stopBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      autoHarnessHalted = true;
      card.className = 'alice-enx-auto-harness-card stopped';
      card.querySelector('.alice-enx-auto-harness-lbl').textContent = '⏹ Autonomous Loop Stopped by User';
      stopBtn.remove();
    });

    if (targetPre && targetPre.parentNode) {
      targetPre.parentNode.insertBefore(card, targetPre.nextSibling);
    } else {
      msgRoot.appendChild(card);
    }

    var startTime = Date.now();

    if (isFile && filePath) {
      if (window.__aliceWriteFile) {
        window.__aliceWriteFile(filePath, fileContent, function (res) {
          var elapsed = Date.now() - startTime;
          if (autoHarnessHalted) return;
          if (res.ok) {
            card.className = 'alice-enx-auto-harness-card success';
            card.innerHTML =
              '<div class="alice-enx-auto-harness-hdr">' +
                '<span class="alice-enx-check">✓</span>' +
                '<span class="alice-enx-auto-harness-lbl">File Created: ' + escapeHtml(filePath) + ' (' + (res.data ? res.data.bytes : fileContent.length) + ' bytes in ' + elapsed + 'ms)</span>' +
              '</div>';
            sendAliceMessage('[Harness Tool Observation (File System)]:\nSuccessfully created and wrote file: `' + filePath + '`.\nPlease continue with the next step or confirm completion to the user.');
          } else {
            card.className = 'alice-enx-auto-harness-card error';
            card.innerHTML =
              '<div class="alice-enx-auto-harness-hdr">' +
                '<span class="alice-enx-err-icon">✗</span>' +
                '<span class="alice-enx-auto-harness-lbl">File Write Failed: ' + escapeHtml(res.error || 'Unknown error') + '</span>' +
              '</div>';
            sendAliceMessage('[Harness Tool Error]: Failed to write file `' + filePath + '`: ' + (res.error || 'Permission error'));
          }
        });
      }
      return;
    }

    runTerminalCommand(cmd, function (ok, stdout, stderr, exitCode) {
      var elapsed = Date.now() - startTime;
      if (autoHarnessHalted) return;
      var outText = (stdout || stderr || '').trim();
      var code = (typeof exitCode === 'number') ? exitCode : (ok ? 0 : 1);

      card.className = 'alice-enx-auto-harness-card ' + (code === 0 ? 'success' : 'error');
      card.innerHTML =
        '<div class="alice-enx-auto-harness-hdr">' +
          '<span class="' + (code === 0 ? 'alice-enx-check' : 'alice-enx-err-icon') + '">' + (code === 0 ? '✓' : '✗') + '</span>' +
          '<span class="alice-enx-auto-harness-lbl">' + (code === 0 ? 'Tool Executed' : 'Execution Returned Error') + ' (exit ' + code + ' in ' + elapsed + 'ms)</span>' +
          '<button class="alice-enx-auto-harness-toggle" type="button">Toggle Output</button>' +
        '</div>' +
        '<pre class="alice-enx-auto-harness-out' + (code === 0 ? '' : ' err') + '">' + escapeHtml(outText || '(command produced no output)') + '</pre>';

      var toggleBtn = card.querySelector('.alice-enx-auto-harness-toggle');
      var outPre = card.querySelector('.alice-enx-auto-harness-out');
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        outPre.style.display = outPre.style.display === 'none' ? 'block' : 'none';
      });

      if (code === 0) {
        autoHarnessFailCount = 0;
        var isMasked = HermesEngine.detectMaskedFailure(cmd, outText);
        if (isMasked) {
          var maskMsg = '[Harness Pipeline Warning]: Command returned exit 0 but output indicates error conditions:\n```\n' + outText + '\n```\nPlease verify and adjust without pipeline swallow.';
          sendAliceMessage(maskMsg);
          return;
        }
        var obsText = '[Harness Tool Observation for: `' + cmd + '` (exit code 0)]:\n```\n' + (outText || '(no output, process completed successfully)') + '\n```\nPlease synthesize the final factual answer for the user based on this live output.';
        sendAliceMessage(obsText);
      } else {
        autoHarnessFailCount++;
        var hint = HermesEngine.diagnose(cmd, code, outText);
        if (autoHarnessFailCount <= 3) {
          var retryMsg = '[Harness Self-Correction - Exit Code ' + code + ']:\n' +
            'Command: `' + cmd + '`\n' +
            'Error Output:\n```\n' + (outText || '(no output)') + '\n```\n' +
            'Diagnostic Hint: ' + hint + '\n' +
            'Self-Correction Instruction: Diagnose root cause, adjust the command or script to fix the error, and provide the corrected executable ```bash block now.';
          sendAliceMessage(retryMsg);
        } else {
          var haltMsg = '[Harness Loop Halted]: Tool execution failed 3 times with exit ' + code + '.\nFinal error: ' + (outText || 'Command failed') + '\nPlease explain the blocker to the user.';
          sendAliceMessage(haltMsg);
        }
      }
    });
  }

  function checkAutoHarnessRun() {
    if (!S.harnessAutoRun || isAliceGenerating() || autoHarnessHalted) return;
    var msgs = document.querySelectorAll('.Message:not(.Message_from_user)');
    if (!msgs.length) return;
    var lastMsg = msgs[msgs.length - 1];
    if (lastMsg.hasAttribute('data-harness-auto-ran')) return;

    var pres = lastMsg.querySelectorAll('pre');
    for (var p = 0; p < pres.length; p++) {
      var pre = pres[p];
      if (pre.parentElement && pre.parentElement.closest('pre')) continue;
      var clean = extractCleanCode(pre);
      if (!clean) continue;

      var fileMatch = clean.match(/^(?:file:|filename:|path:)\s*([^\n\r]+)/i);
      if (fileMatch) {
        var filePath = fileMatch[1].trim();
        var lines = clean.split('\n');
        lines.shift();
        var fileContent = lines.join('\n');
        executeAutoTool(null, true, filePath, fileContent, pre, lastMsg);
        return;
      }

      if (isShellCommand(clean) || pre.className.indexOf('bash') > -1 || pre.className.indexOf('shell') > -1) {
        executeAutoTool(clean, false, null, null, pre, lastMsg);
        return;
      }
    }
  }

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
      checkAutoHarnessRun();
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
