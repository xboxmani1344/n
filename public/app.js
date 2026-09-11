(() => {
  'use strict';

  // Deliberately not destructured to a bare `t`: this file already uses `t` as
  // a loop variable in several places, and the shadowing would be silent.
  const i18n = window.I18N;
  const tr = (key, vars) => i18n.t(key, vars);
  const num = (value) => i18n.num(value);

  // Filled from /api/phases at boot so the server stays the single source of
  // truth for what phases a track has. Seeded with the study track so the first
  // paint is correct even before that request lands.
  let TRACKS = {
    study: {
      key: 'study',
      label: 'Study',
      phases: [
        { key: 'warmup', label: 'Warm-Up' },
        { key: 'learn', label: 'Learn' },
        { key: 'practice', label: 'Practice' },
        { key: 'review', label: 'Review' },
      ],
    },
  };

  // The phases of the chat currently open. 'phased' is the old name for study.
  function phasesFor(mode) {
    const track = TRACKS[mode === 'phased' || !mode ? 'study' : mode];
    return (track || TRACKS.study).phases;
  }

  // The server sends both spellings of every phase name, so the tracker follows
  // the interface language without the client keeping its own copy of the list.
  function phaseLabel(phase) {
    return (i18n.lang === 'fa' && phase.labelFa) || phase.label;
  }

  function currentPhases() {
    return phasesFor(currentMode);
  }

  // Per-track wording lives in the dictionary; this only resolves which track's
  // keys to read. 'phased' is the old name for study.
  function trackKey(mode) {
    const key = mode === 'phased' || !mode ? 'study' : mode;
    return ['study', 'workout', 'diet', 'tutor'].includes(key) ? key : 'study';
  }

  function trackText(mode, part) {
    return tr(`track.${trackKey(mode)}.${part}`);
  }

  const authShell = document.getElementById('auth-shell');
  const appLayout = document.getElementById('app-layout');

  const keyBanner = document.getElementById('key-banner');
  const keyBannerBtn = document.getElementById('key-banner-btn');
  const apiKeyForm = document.getElementById('apikey-form');
  const apiKeyInput = document.getElementById('apikey-input');
  const apiKeyStatus = document.getElementById('apikey-status');
  const apiKeyError = document.getElementById('apikey-error');
  const apiKeySaved = document.getElementById('apikey-saved');
  const apiKeyRemove = document.getElementById('apikey-remove');
  const apiKeyLabel = document.getElementById('apikey-label');
  const apiKeyCard = document.getElementById('apikey-card');

  const setupShell = document.getElementById('setup-shell');
  const setupForm = document.getElementById('setup-form');
  const setupKeyInput = document.getElementById('setup-key');
  const setupSubmit = document.getElementById('setup-submit');
  const setupError = document.getElementById('setup-error');

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');
  const authTabs = document.querySelectorAll('.auth-tab');
  const googleBtn = document.getElementById('google-btn');

  const sidebarList = document.getElementById('sidebar-list');
  const newSessionBtn = document.getElementById('new-session-btn');
  const newWorkoutBtn = document.getElementById('new-workout-btn');
  const newDietBtn = document.getElementById('new-diet-btn');
  const newTutorBtn = document.getElementById('new-tutor-btn');
  const sidebarNavBtns = document.querySelectorAll('.sidebar-nav-btn');
  const chatNavExtras = document.getElementById('chat-nav-extras');

  const chatTitleHeading = document.getElementById('chat-title-heading');
  const chatTitleSub = document.getElementById('chat-title-sub');
  const chatLog = document.getElementById('chat-log');
  const phaseTracker = document.getElementById('phase-tracker');
  const footPhase = document.getElementById('foot-phase');
  const composer = document.getElementById('composer');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const nextPhaseBtn = document.getElementById('next-phase-btn');
  const logoutBtn = document.getElementById('logout-btn');

  const appShell = document.getElementById('app-shell');
  const plannerShell = document.getElementById('planner-shell');
  const calMonthYear = document.getElementById('cal-month-year');
  const calGrid = document.getElementById('calendar-grid');
  const calWeekdays = document.getElementById('calendar-weekdays');
  const calPrevBtn = document.getElementById('cal-prev');
  const calNextBtn = document.getElementById('cal-next');
  const calTodayBtn = document.getElementById('cal-today');
  const taskForm = document.getElementById('task-form');
  const taskTitleInput = document.getElementById('task-title');
  const taskDueInput = document.getElementById('task-due-date');
  const taskSubjectInput = document.getElementById('task-subject');
  const taskList = document.getElementById('task-list');
  const taskListHeading = document.getElementById('task-list-heading');
  const taskFilterClear = document.getElementById('task-filter-clear');

  const videoShell = document.getElementById('video-shell');
  const videoForm = document.getElementById('video-form');
  const videoUrlInput = document.getElementById('video-url');
  const videoSubmitBtn = document.getElementById('video-submit-btn');
  const videoErrorBlock = document.getElementById('video-error-block');
  const videoErrorText = document.getElementById('video-error-text');
  const videoFallbackLabel = document.getElementById('video-fallback-label');
  const videoManualTranscript = document.getElementById('video-manual-transcript');
  const videoManualSubmitBtn = document.getElementById('video-manual-submit-btn');
  const videoResultBlock = document.getElementById('video-result-block');
  const videoResultTitle = document.getElementById('video-result-title');
  const videoResultAuthor = document.getElementById('video-result-author');
  const videoSummaryEl = document.getElementById('video-summary');
  const videoHistoryLabel = document.getElementById('video-history-label');
  const videoHistoryList = document.getElementById('video-history-list');

  const settingsBtn = document.getElementById('settings-btn');
  const settingsShell = document.getElementById('settings-shell');
  const profileForm = document.getElementById('profile-form');
  const settingsDisplayName = document.getElementById('settings-display-name');
  const settingsEmail = document.getElementById('settings-email');
  const profileError = document.getElementById('profile-error');
  const profileSaved = document.getElementById('profile-saved');
  const themePicker = document.getElementById('theme-picker');
  // Scoped to their own picker: both use .theme-option, and a document-wide
  // query would wire the language buttons to the theme handler.
  const themeOptions = themePicker.querySelectorAll('.theme-option');
  const languagePicker = document.getElementById('language-picker');
  const languageOptions = languagePicker.querySelectorAll('.theme-option');
  const langToggles = document.querySelectorAll('.lang-toggle');
  const passwordForm = document.getElementById('password-form');
  const currentPasswordField = document.getElementById('current-password-field');
  const settingsCurrentPassword = document.getElementById('settings-current-password');
  const settingsNewPassword = document.getElementById('settings-new-password');
  const passwordError = document.getElementById('password-error');
  const passwordSaved = document.getElementById('password-saved');
  const settingsPlanName = document.getElementById('settings-plan-name');
  const settingsPlanUsage = document.getElementById('settings-plan-usage');
  const settingsUpgradeBtn = document.getElementById('settings-upgrade-btn');
  const billingError = document.getElementById('billing-error');

  let chats = [];
  let currentChatId = null;
  let currentMode = 'study';
  let phaseIndex = 0;
  let needsAutoTitle = false;
  let busy = false;

  let tasks = [];
  // Which month the grid is showing, in whichever calendar the language uses:
  // Gregorian in English, Jalali in Persian. Every date that leaves this file --
  // selectedDate, the task API, the DB -- stays a Gregorian ISO string.
  let calendarCursor;
  let selectedDate = null; // 'YYYY-MM-DD', always Gregorian
  let plannerLoaded = false;

  let videoLoaded = false;
  let videoBusy = false;
  let lastVideoUrl = '';

  calendarCursor = i18n.cursorFor(i18n.todayIso());

  // ---------- API helpers ----------

  async function api(path, options = {}) {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- Auth view ----------

  function showSetupView() {
    appLayout.hidden = true;
    authShell.hidden = true;
    setupShell.hidden = false;
    setupKeyInput.focus();
  }

  function showAuthView() {
    appLayout.hidden = true;
    setupShell.hidden = true;
    authShell.hidden = false;
  }

  function showAppView() {
    authShell.hidden = true;
    setupShell.hidden = true;
    appLayout.hidden = false;
  }

  setupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = setupKeyInput.value.trim();
    if (!key) return;

    setupError.textContent = '';
    setupSubmit.disabled = true;
    setupSubmit.textContent = tr('setup.submitting');

    // The server tries a real call before saving, so this covers a mistyped or
    // revoked key too, not just an empty box.
    const { ok, data } = await api('/api/setup/key', {
      method: 'POST',
      body: { key },
    });

    setupSubmit.disabled = false;
    setupSubmit.textContent = tr('setup.submit');

    if (!ok) {
      setupError.textContent = (data && data.error) || tr('err.keyRejected');
      return;
    }

    setupKeyInput.value = '';
    if (data && data.persisted === false && data.error) {
      // Key works but couldn't be written to disk — say so instead of pretending.
      window.alert(data.error);
    }
    showAuthView();
  });

  authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      authTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.hidden = !isLogin;
      signupForm.hidden = isLogin;
      loginError.textContent = '';
      signupError.textContent = '';
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const formData = new FormData(loginForm);
    const { ok, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: formData.get('email'), password: formData.get('password') },
    });
    if (!ok) {
      loginError.textContent = (data && data.error) || tr('err.retry');
      return;
    }
    showAppView();
    initApp();
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    const formData = new FormData(signupForm);
    const { ok, data } = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        email: formData.get('email'),
        password: formData.get('password'),
        displayName: formData.get('displayName'),
      },
    });
    if (!ok) {
      signupError.textContent = (data && data.error) || tr('err.retry');
      return;
    }
    showAppView();
    initApp();
  });

  logoutBtn.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    chats = [];
    currentChatId = null;
    phaseIndex = 0;
    chatLog.innerHTML = '';
    showAuthView();
  });

  async function configureGoogleButton() {
    const { data } = await api('/api/config');
    if (!data || !data.googleEnabled) {
      googleBtn.setAttribute('aria-disabled', 'true');
      googleBtn.removeAttribute('href');
      googleBtn.textContent = tr('auth.googleOff');
    }
  }

  // ---------- Sidebar ----------

  function chatDisplayTitle(chat) {
    if (chat.title) return chat.title;
    if (chat.topic) return chat.topic;
    return chat.mode === 'tutor' ? tr('chat.tutorChat') : trackText(chat.mode, 'title');
  }

  function renderSidebar() {
    sidebarList.innerHTML = '';

    if (!chats.length) {
      const empty = document.createElement('p');
      empty.className = 'sidebar-empty';
      empty.textContent = tr('nav.noChats');
      sidebarList.appendChild(empty);
      return;
    }

    chats.forEach((chat) => {
      const item = document.createElement('div');
      item.className = 'sidebar-item' + (chat.id === currentChatId ? ' active' : '');

      const main = document.createElement('div');
      main.className = 'sidebar-item-main';

      const title = document.createElement('span');
      title.className = 'sidebar-item-title';
      title.textContent = chatDisplayTitle(chat);

      const meta = document.createElement('span');
      meta.className = 'sidebar-item-meta';
      meta.textContent = `${trackText(chat.mode, 'title')} · ${i18n.relativeTime(chat.updatedAt)}`;

      main.appendChild(title);
      main.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'sidebar-item-delete';
      del.setAttribute('aria-label', tr('chat.delete'));
      del.textContent = '×';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      item.appendChild(main);
      item.appendChild(del);
      item.addEventListener('click', () => {
        if (chat.id !== currentChatId) loadChat(chat.id);
      });

      sidebarList.appendChild(item);
    });
  }

  async function refreshChatList() {
    const { data } = await api('/api/chats');
    chats = (data && data.chats) || [];
    renderSidebar();
  }

  async function deleteChat(chatId) {
    if (!confirm(tr('chat.confirmDelete'))) return;
    await api(`/api/chats/${chatId}`, { method: 'DELETE' });
    const wasActive = chatId === currentChatId;
    await refreshChatList();
    if (wasActive) {
      if (chats.length) {
        loadChat(chats[0].id);
      } else {
        await createChat('study');
      }
    }
  }

  // ---------- Chat view ----------

  function renderPhaseTracker() {
    phaseTracker.innerHTML = '';
    currentPhases().forEach((phase, i) => {
      const span = document.createElement('span');
      span.className = 'segment';
      const numEl = document.createElement('span');
      numEl.className = 'segment-num';
      numEl.textContent = num(i + 1);
      span.appendChild(numEl);
      span.appendChild(document.createTextNode(phaseLabel(phase)));
      if (i === phaseIndex) span.classList.add('active');
      else if (i < phaseIndex) span.classList.add('done');
      phaseTracker.appendChild(span);
    });
  }

  function applyModeChrome() {
    const isTutor = currentMode === 'tutor';
    phaseTracker.hidden = isTutor;
    nextPhaseBtn.hidden = isTutor;

    if (isTutor) {
      chatTitleSub.textContent = tr('track.tutor.sub');
      footPhase.textContent = tr('track.tutor.foot');
    } else {
      chatTitleSub.textContent = trackText(currentMode, 'sub');
      renderPhaseTracker();
      const phases = currentPhases();
      footPhase.textContent = tr('chat.step', {
        label: phaseLabel(phases[phaseIndex]),
        n: num(phaseIndex + 1),
        total: num(phases.length),
      });
      nextPhaseBtn.disabled = phaseIndex >= phases.length - 1;
    }
  }

  function addBubble(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;

    const who = document.createElement('span');
    who.className = 'who';
    who.dataset.i18n = role === 'user' ? 'chat.you' : 'chat.brand';
    who.textContent = tr(who.dataset.i18n);

    const body = document.createElement('span');
    body.className = 'body';
    body.textContent = text;

    div.appendChild(who);
    div.appendChild(body);
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div;
  }

  function addSystemNote(text) {
    const div = document.createElement('div');
    div.className = 'msg system-note';
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function setBusy(isBusy) {
    busy = isBusy;
    sendBtn.disabled = isBusy;
    if (currentMode !== 'tutor') {
      nextPhaseBtn.disabled = isBusy || phaseIndex >= currentPhases().length - 1;
    }
    messageInput.disabled = isBusy;
  }

  function autoGrow() {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
  }

  async function sendToBackend(content, hidden) {
    setBusy(true);
    const typingEl = document.createElement('div');
    typingEl.className = 'msg typing';
    const typingWho = document.createElement('span');
    typingWho.className = 'who';
    typingWho.dataset.i18n = 'chat.brand';
    typingWho.textContent = tr('chat.brand');
    const typingBody = document.createElement('span');
    typingBody.className = 'body';
    typingBody.textContent = tr('chat.thinking');
    typingEl.appendChild(typingWho);
    typingEl.appendChild(typingBody);
    chatLog.appendChild(typingEl);
    chatLog.scrollTop = chatLog.scrollHeight;

    const chatIdAtSend = currentChatId;

    if (needsAutoTitle && !hidden) {
      needsAutoTitle = false;
      const autoTitle = content.length > 40 ? `${content.slice(0, 40)}…` : content;
      api(`/api/chats/${chatIdAtSend}`, { method: 'PATCH', body: { title: autoTitle } }).then(refreshChatList);
    }

    const { ok, status, data } = await api(`/api/chats/${chatIdAtSend}/messages`, {
      method: 'POST',
      body: { content, hidden: Boolean(hidden) },
    });
    typingEl.remove();

    if (status === 401) {
      showAuthView();
      return;
    }

    if (!ok) {
      const base = (data && data.error) || tr('err.retry');
      addSystemNote(data && data.code === 'limit_reached' ? tr('chat.limitHint', { error: base }) : base);
      setBusy(false);
      messageInput.focus();
      return;
    }

    addBubble('bot', data.reply);
    setBusy(false);
    messageInput.focus();

    await refreshChatList();
  }

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    autoGrow();
    addBubble('user', text);
    sendToBackend(text, false);
  });

  messageInput.addEventListener('input', autoGrow);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  nextPhaseBtn.addEventListener('click', async () => {
    if (busy || phaseIndex >= currentPhases().length - 1) return;
    phaseIndex += 1;
    const nextPhase = currentPhases()[phaseIndex];
    applyModeChrome();
    addSystemNote(tr('chat.movingOn', { phase: phaseLabel(nextPhase) }));
    await api(`/api/chats/${currentChatId}`, { method: 'PATCH', body: { phaseKey: nextPhase.key } });
    sendToBackend(`[The learner clicked "Next Phase." Begin the ${nextPhase.label} phase now.]`, true);
  });

  newSessionBtn.addEventListener('click', () => createChat('study'));
  newWorkoutBtn.addEventListener('click', () => createChat('workout'));
  newDietBtn.addEventListener('click', () => createChat('diet'));
  newTutorBtn.addEventListener('click', () => createChat('tutor'));

  async function createChat(mode) {
    if (busy) return;
    const { data } = await api('/api/chats', { method: 'POST', body: { mode } });
    await refreshChatList();
    await loadChat(data.chat.id, data.chat);
  }

  function showWelcome() {
    if (currentMode === 'tutor') {
      addBubble('bot', tr('chat.tutorWelcome'));
    } else {
      addBubble('bot', trackText(currentMode, 'welcome'));
    }
  }

  async function loadChat(chatId, knownChat) {
    currentChatId = chatId;
    chatLog.innerHTML = '';
    needsAutoTitle = false;

    const { data } = await api(`/api/chats/${chatId}`);
    const chat = data.chat || knownChat;
    currentMode = chat.mode;
    phaseIndex = currentMode === 'tutor' ? 0 : Math.max(0, currentPhases().findIndex((p) => p.key === chat.phaseKey));

    applyModeChrome();
    renderSidebar();

    if (data.messages && data.messages.length) {
      data.messages.forEach((m) => addBubble(m.role === 'user' ? 'user' : 'bot', m.content));
    } else {
      needsAutoTitle = !chat.title && !chat.topic;
      showWelcome();
    }
  }

  async function initApp() {
    chatTitleHeading.textContent = tr('chat.brand');
    refreshKeyState();
    await refreshChatList();

    if (chats.length) {
      await loadChat(chats[0].id);
    } else {
      await createChat('study');
    }
  }

  // ---------- View switching (Chats / Planner / Video) ----------

  function switchView(view) {
    sidebarNavBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === view));

    appShell.hidden = view !== 'chats';
    plannerShell.hidden = view !== 'planner';
    videoShell.hidden = view !== 'video';
    settingsShell.hidden = view !== 'settings';
    chatNavExtras.hidden = view !== 'chats';

    if (view === 'planner' && !plannerLoaded) {
      plannerLoaded = true;
      initPlanner();
    }
    if (view === 'video' && !videoLoaded) {
      videoLoaded = true;
      initVideo();
    }
    if (view === 'settings') {
      initSettings();
    }
  }

  sidebarNavBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  settingsBtn.addEventListener('click', () => switchView('settings'));

  // ---------- Per-user API key ----------

  // Reflects whether this account can talk to the AI at all. Shown as a banner
  // above the chat rather than left to fail on the first message.
  async function refreshKeyState() {
    const { ok, data } = await api('/api/setup/me/key');
    if (!ok || !data) return;

    keyBanner.hidden = data.ready;

    // When the site pays for the AI, the whole section goes away. Leaving it
    // visible - even worded as optional - reads as something the user is meant
    // to deal with, and the entire point of the site supplying the key is that
    // nobody has to go and get one.
    if (apiKeyCard) apiKeyCard.hidden = data.usingServerKey && !data.hasOwnKey;

    if (data.hasOwnKey) {
      apiKeyStatus.textContent = tr('settings.keySet');
      apiKeyInput.placeholder = tr('settings.keyReplace');
      apiKeyRemove.hidden = false;
      if (apiKeyLabel) apiKeyLabel.textContent = tr('settings.yourOwnKey');
    } else if (data.usingServerKey) {
      // The site owner supplies the key here, so this is genuinely optional.
      // Saying "add your own" as an instruction would send people off to sign
      // up for something they do not need.
      apiKeyStatus.textContent = tr('settings.keyShared');
      apiKeyInput.placeholder = tr('settings.keyPlaceholder');
      apiKeyRemove.hidden = true;
      if (apiKeyLabel) apiKeyLabel.textContent = tr('settings.yourOwnKeyOptional');
    } else {
      apiKeyStatus.textContent = tr('settings.keyMissing');
      apiKeyInput.placeholder = tr('settings.keyPlaceholder');
      apiKeyRemove.hidden = true;
      if (apiKeyLabel) apiKeyLabel.textContent = tr('settings.yourOwnKey');
    }
  }

  keyBannerBtn.addEventListener('click', () => {
    switchView('settings');
    apiKeyInput.focus();
  });

  apiKeyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = apiKeyInput.value.trim();
    if (!key) return;

    apiKeyError.textContent = '';
    apiKeySaved.hidden = true;
    const saveBtn = document.getElementById('apikey-save');
    saveBtn.disabled = true;
    saveBtn.textContent = tr('settings.checking');

    // The server tries a real call before storing, so a mistyped key is caught
    // here rather than on the user's first question.
    const { ok, data } = await api('/api/setup/me/key', { method: 'PUT', body: { key } });

    saveBtn.disabled = false;
    saveBtn.textContent = tr('settings.saveKey');

    if (!ok) {
      apiKeyError.textContent = (data && data.error) || tr('err.keyRejectedShort');
      return;
    }

    apiKeyInput.value = '';
    apiKeySaved.hidden = false;
    await refreshKeyState();
  });

  apiKeyRemove.addEventListener('click', async () => {
    apiKeyError.textContent = '';
    apiKeySaved.hidden = true;
    await api('/api/setup/me/key', { method: 'DELETE' });
    await refreshKeyState();
  });

  // ---------- Planner: calendar ----------

  function renderWeekdays() {
    calWeekdays.innerHTML = '';
    i18n.weekdayNames().forEach((name) => {
      const span = document.createElement('span');
      span.textContent = name;
      calWeekdays.appendChild(span);
    });
  }

  function renderCalendar() {
    calMonthYear.textContent = i18n.monthLabel(calendarCursor);
    renderWeekdays();
    calGrid.innerHTML = '';

    const dueDates = new Set(tasks.filter((t) => t.dueAt).map((t) => t.dueAt.slice(0, 10)));
    const today = i18n.todayIso();

    // Six weeks of cells, each already carrying the Gregorian date it stands
    // for, so which calendar system produced them stops mattering here.
    i18n.monthGrid(calendarCursor).forEach((cell) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calendar-day';
      if (cell.outside) btn.classList.add('outside-month');
      if (cell.iso === today) btn.classList.add('today');
      if (cell.iso === selectedDate) btn.classList.add('selected');

      const label = document.createElement('span');
      label.textContent = cell.label;
      btn.appendChild(label);

      if (dueDates.has(cell.iso)) {
        const dot = document.createElement('span');
        dot.className = 'calendar-day-dot';
        btn.appendChild(dot);
      }

      btn.addEventListener('click', () => {
        selectedDate = selectedDate === cell.iso ? null : cell.iso;
        if (cell.outside) calendarCursor = i18n.cursorFor(cell.iso);
        if (selectedDate) taskDueInput.value = selectedDate;
        renderCalendar();
        renderTaskList();
      });

      calGrid.appendChild(btn);
    });
  }

  calPrevBtn.addEventListener('click', () => {
    calendarCursor = i18n.stepCursor(calendarCursor, -1);
    renderCalendar();
  });

  calNextBtn.addEventListener('click', () => {
    calendarCursor = i18n.stepCursor(calendarCursor, 1);
    renderCalendar();
  });

  calTodayBtn.addEventListener('click', () => {
    calendarCursor = i18n.cursorFor(i18n.todayIso());
    renderCalendar();
  });

  // ---------- Planner: task list ----------

  function formatDue(dueAt) {
    return dueAt ? i18n.formatShortDate(dueAt.slice(0, 10)) : null;
  }

  function renderTaskList() {
    taskList.innerHTML = '';

    const visible = selectedDate
      ? tasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === selectedDate)
      : tasks;

    taskListHeading.textContent = selectedDate
      ? tr('planner.tasksOn', { date: i18n.formatLongDate(selectedDate) })
      : tr('planner.allTasks');
    taskFilterClear.hidden = !selectedDate;

    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'task-list-empty';
      empty.textContent = tr(selectedDate ? 'planner.nothingDue' : 'planner.noTasksYet');
      taskList.appendChild(empty);
      return;
    }

    visible.forEach((task) => {
      const row = document.createElement('div');
      row.className = 'task-row' + (task.status === 'done' ? ' done' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.status === 'done';
      checkbox.setAttribute('aria-label', tr('planner.markDone', { title: task.title }));
      checkbox.addEventListener('change', () => toggleTask(task.id, checkbox.checked));

      const main = document.createElement('div');
      main.className = 'task-row-main';

      const title = document.createElement('div');
      title.className = 'task-row-title';
      title.textContent = task.title;

      const meta = document.createElement('div');
      meta.className = 'task-row-meta';
      const metaParts = [];
      if (task.dueAt) metaParts.push(formatDue(task.dueAt));
      if (task.subject) metaParts.push(task.subject);
      meta.textContent = metaParts.length ? metaParts.join(' · ') : tr('planner.noDueDate');

      main.appendChild(title);
      main.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'task-row-delete';
      del.setAttribute('aria-label', tr('planner.deleteNamed', { title: task.title }));
      del.textContent = '×';
      del.addEventListener('click', () => deleteTask(task.id));

      row.appendChild(checkbox);
      row.appendChild(main);
      row.appendChild(del);
      taskList.appendChild(row);
    });
  }

  taskFilterClear.addEventListener('click', () => {
    selectedDate = null;
    renderCalendar();
    renderTaskList();
  });

  async function refreshTasks() {
    const { data } = await api('/api/tasks');
    tasks = (data && data.tasks) || [];
    renderCalendar();
    renderTaskList();
  }

  async function toggleTask(taskId, done) {
    await api(`/api/tasks/${taskId}`, { method: 'PATCH', body: { status: done ? 'done' : 'pending' } });
    await refreshTasks();
  }

  async function deleteTask(taskId) {
    await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
    await refreshTasks();
  }

  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;

    const dueDate = taskDueInput.value || null;
    const body = {
      title,
      subject: taskSubjectInput.value.trim() || null,
      dueAt: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : null,
    };

    taskTitleInput.value = '';
    taskSubjectInput.value = '';
    taskDueInput.value = '';

    await api('/api/tasks', { method: 'POST', body });
    await refreshTasks();
  });

  async function initPlanner() {
    renderCalendar();
    await refreshTasks();
  }

  // ---------- Video summarizer ----------

  function setVideoBusy(isBusy) {
    videoBusy = isBusy;
    videoSubmitBtn.disabled = isBusy;
    videoManualSubmitBtn.disabled = isBusy;
    videoSubmitBtn.textContent = tr(isBusy ? 'video.working' : 'video.submit');
  }

  function showVideoResult(video) {
    videoErrorBlock.hidden = true;
    videoResultBlock.hidden = false;
    videoResultTitle.textContent = video.title || tr('video.untitled');
    videoResultAuthor.textContent = video.author || '';
    videoResultAuthor.hidden = !video.author;
    videoSummaryEl.textContent = video.summary;
  }

  function showVideoError(message, showFallback = true) {
    videoResultBlock.hidden = true;
    videoErrorBlock.hidden = false;
    videoErrorText.textContent = message;
    videoManualTranscript.value = '';
    videoFallbackLabel.hidden = !showFallback;
    videoManualTranscript.hidden = !showFallback;
    videoManualSubmitBtn.hidden = !showFallback;
  }

  async function submitVideo(url, manualTranscript) {
    if (videoBusy) return;
    setVideoBusy(true);
    lastVideoUrl = url;

    const body = manualTranscript ? { url, transcript: manualTranscript } : { url };
    const { ok, data } = await api('/api/video/summarize', { method: 'POST', body });

    setVideoBusy(false);

    if (!ok) {
      const isLimitReached = data && data.code === 'limit_reached';
      const base = (data && data.error) || tr('err.retry');
      showVideoError(isLimitReached ? tr('chat.limitHint', { error: base }) : base, !isLimitReached);
      return;
    }

    showVideoResult(data.video);
    await refreshVideoHistory();
  }

  videoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = videoUrlInput.value.trim();
    if (!url) return;
    submitVideo(url, null);
  });

  videoManualSubmitBtn.addEventListener('click', () => {
    const transcript = videoManualTranscript.value.trim();
    if (!transcript) return;
    submitVideo(lastVideoUrl, transcript);
  });

  function renderVideoHistory(videos) {
    videoHistoryList.innerHTML = '';
    videoHistoryLabel.hidden = !videos.length;

    videos.forEach((video) => {
      const item = document.createElement('div');
      item.className = 'video-history-item';

      const title = document.createElement('span');
      title.className = 'video-history-item-title';
      title.textContent = video.title || video.url;

      const meta = document.createElement('span');
      meta.className = 'video-history-item-meta';
      meta.textContent = video.author || tr('video.source');

      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener('click', () => {
        videoUrlInput.value = video.url;
        if (video.summary) {
          showVideoResult(video);
        } else {
          // Summarized before, but in the other language. The transcript is
          // already stored server-side, so this only re-runs the summarizing.
          submitVideo(video.url, null);
        }
      });

      videoHistoryList.appendChild(item);
    });
  }

  async function refreshVideoHistory() {
    const { data } = await api('/api/video/summaries');
    renderVideoHistory((data && data.videos) || []);
  }

  async function initVideo() {
    await refreshVideoHistory();
  }

  // ---------- Settings ----------

  function markActiveLanguage() {
    languageOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.language === i18n.lang));
  }

  // Switching redraws everything the interface generated itself. The static
  // markup is handled by i18n before this runs.
  function setLanguage(lang, options) {
    if (lang === i18n.lang) return;
    i18n.applyLanguage(lang);
    if (!options || options.persist !== false) {
      api('/api/settings', { method: 'PATCH', body: { language: lang } });
    }
  }

  document.addEventListener('languagechange', () => {
    markActiveLanguage();
    if (appLayout.hidden) return;

    applyModeChrome();
    renderSidebar();
    // The calendar has to be rebuilt rather than relabelled: Persian shows a
    // different month with different days in it, not the same grid translated.
    calendarCursor = i18n.cursorFor(selectedDate || i18n.todayIso());
    renderCalendar();
    renderTaskList();
    refreshKeyState();
    if (!settingsShell.hidden) initSettings();
  });

  langToggles.forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(i18n.lang === 'fa' ? 'en' : 'fa'));
  });

  languageOptions.forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.language));
  });

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    themeOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.theme === (theme || 'system')));
  }

  async function initSettings() {
    apiKeyError.textContent = '';
    apiKeySaved.hidden = true;
    refreshKeyState();
    profileError.textContent = '';
    profileSaved.hidden = true;
    passwordError.textContent = '';
    passwordSaved.hidden = true;
    billingError.textContent = '';

    const { data } = await api('/api/settings');
    if (data) {
      settingsDisplayName.value = data.settings.displayName || '';
      settingsEmail.value = data.settings.email;
      currentPasswordField.hidden = !data.settings.hasPassword;
      applyTheme(data.settings.theme);
      markActiveLanguage();
    }

    const { data: billing } = await api('/api/billing');
    if (billing) {
      settingsPlanName.textContent = tr(billing.plan === 'paid' ? 'settings.planPaid' : 'settings.planFree');
      settingsUpgradeBtn.hidden = billing.plan === 'paid';
      const msgs = billing.usage.ai_messages;
      const vids = billing.usage.video_summaries;
      settingsPlanUsage.textContent = tr('settings.usage', {
        used: num(msgs.used),
        limit: num(msgs.limit),
        vUsed: num(vids.used),
        vLimit: num(vids.limit),
      });
    }
  }

  settingsUpgradeBtn.addEventListener('click', async () => {
    billingError.textContent = '';
    settingsUpgradeBtn.disabled = true;
    const { ok, data } = await api('/api/billing/checkout', { method: 'POST' });
    settingsUpgradeBtn.disabled = false;

    if (!ok) {
      billingError.textContent =
        (data && data.code === 'billing_not_configured' ? tr('err.billingOff') : data && data.error) ||
        tr('err.generic');
      return;
    }

    window.location.href = data.url;
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileError.textContent = '';
    profileSaved.hidden = true;

    const { ok, data } = await api('/api/settings', {
      method: 'PATCH',
      body: { displayName: settingsDisplayName.value.trim() },
    });

    if (!ok) {
      profileError.textContent = (data && data.error) || tr('err.generic');
      return;
    }
    profileSaved.hidden = false;
  });

  themeOptions.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      await api('/api/settings', { method: 'PATCH', body: { theme } });
    });
  });

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordError.textContent = '';
    passwordSaved.hidden = true;

    const { ok, data } = await api('/api/settings/password', {
      method: 'PATCH',
      body: {
        currentPassword: settingsCurrentPassword.value,
        newPassword: settingsNewPassword.value,
      },
    });

    if (!ok) {
      passwordError.textContent = (data && data.error) || tr('err.generic');
      return;
    }

    settingsCurrentPassword.value = '';
    settingsNewPassword.value = '';
    passwordSaved.hidden = false;
  });

  // ---------- Boot ----------

  // Phase definitions live on the server; fetch them before the first render
  // so a workout chat never briefly shows study phases.
  async function loadTracks() {
    const { ok, data } = await api('/api/phases');
    if (ok && data && data.tracks) TRACKS = data.tracks;
  }

  async function bootstrap() {
    // The inline <head> script already set the direction; this fills the text.
    i18n.applyLanguage(i18n.detect(), { persist: false });
    markActiveLanguage();

    configureGoogleButton();
    await loadTracks();

    // No key yet means nothing else in the app can work, so ask for it first.
    // Only offered on the machine running the server; a remote visitor gets the
    // normal sign-in screen rather than a box that would reject them anyway.
    const setupStatus = await api('/api/setup/status');
    if (setupStatus.ok && setupStatus.data && !setupStatus.data.configured && setupStatus.data.local) {
      showSetupView();
      return;
    }

    const { ok } = await api('/api/auth/me');
    if (ok) {
      showAppView();
      const { data } = await api('/api/settings');
      if (data) {
        applyTheme(data.settings.theme);
        // A choice made in this browser wins and is pushed up; otherwise the
        // account's language wins, which is what makes it follow to a new
        // device. Without the first half, signing up while reading in Persian
        // would flip the page to English the moment the account was created.
        const chosenHere = i18n.storedLang();
        if (chosenHere) setLanguage(chosenHere);
        else setLanguage(data.settings.language, { persist: false });
      }
      await initApp();
    } else {
      showAuthView();
    }
  }

  bootstrap();
})();
