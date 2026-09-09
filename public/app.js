(() => {
  'use strict';

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

  function currentPhases() {
    return phasesFor(currentMode);
  }

  // Everything that differs between tracks, kept together so adding a fourth
  // track is one entry rather than a hunt through the file.
  const TRACK_COPY = {
    study: {
      title: 'Study session',
      sub: 'Four phases. One session.',
      welcome:
        "What would you like to study today, and what's your goal for this session (understand a concept, prep for a test, review before an exam)?",
    },
    workout: {
      title: 'Workout plan',
      sub: 'Assess, plan, train, adjust.',
      welcome:
        "Let's build something you'll actually keep up. Tell me roughly how active you are right now, what equipment you can get to, and how many days a week are genuinely free.",
    },
    diet: {
      title: 'Nutrition plan',
      sub: 'Small changes that stick.',
      welcome:
        "Let's start with how you eat now — no counting, no judgement. What does a normal day of food look like for you, and what are the meals you'd never want to give up?",
    },
  };

  function trackCopy(mode) {
    return TRACK_COPY[mode === 'phased' || !mode ? 'study' : mode] || TRACK_COPY.study;
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
  const themeOptions = document.querySelectorAll('.theme-option');
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
  let calendarYear;
  let calendarMonth; // 0-indexed
  let selectedDate = null; // 'YYYY-MM-DD'
  let plannerLoaded = false;

  let videoLoaded = false;
  let videoBusy = false;
  let lastVideoUrl = '';

  {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
  }

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
    setupSubmit.textContent = 'Checking your key...';

    // The server tries a real call before saving, so this covers a mistyped or
    // revoked key too, not just an empty box.
    const { ok, data } = await api('/api/setup/key', {
      method: 'POST',
      body: { key },
    });

    setupSubmit.disabled = false;
    setupSubmit.textContent = 'Save and start studying';

    if (!ok) {
      setupError.textContent = (data && data.error) || 'That key was rejected. Please check it and try again.';
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
      loginError.textContent = (data && data.error) || 'Something went wrong. Please try again.';
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
      signupError.textContent = (data && data.error) || 'Something went wrong. Please try again.';
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
      googleBtn.textContent = 'Google sign-in not configured yet';
    }
  }

  // ---------- Sidebar ----------

  function chatDisplayTitle(chat) {
    if (chat.title) return chat.title;
    if (chat.topic) return chat.topic;
    return chat.mode === 'tutor' ? 'AI Teacher chat' : trackCopy(chat.mode).title;
  }

  function relativeTime(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  function renderSidebar() {
    sidebarList.innerHTML = '';

    if (!chats.length) {
      const empty = document.createElement('p');
      empty.className = 'sidebar-empty';
      empty.textContent = 'No chats yet — start one above.';
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
      meta.textContent = `${chat.mode === 'tutor' ? 'AI Teacher' : 'Study session'} · ${relativeTime(chat.updatedAt)}`;

      main.appendChild(title);
      main.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'sidebar-item-delete';
      del.setAttribute('aria-label', 'Delete chat');
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
    if (!confirm('Delete this chat? This cannot be undone.')) return;
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
      span.innerHTML = `<span class="segment-num">${i + 1}</span>${phase.label}`;
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
      chatTitleSub.textContent = 'Ask anything, any time.';
      footPhase.textContent = 'AI Teacher — freeform chat';
    } else {
      chatTitleSub.textContent = trackCopy(currentMode).sub;
      renderPhaseTracker();
      const phases = currentPhases();
      footPhase.textContent = `${phases[phaseIndex].label} — step ${phaseIndex + 1} of ${phases.length}`;
      nextPhaseBtn.disabled = phaseIndex >= phases.length - 1;
    }
  }

  function addBubble(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = role === 'user' ? 'You' : 'Study Buddy';

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
    typingWho.textContent = 'Study Buddy';
    const typingBody = document.createElement('span');
    typingBody.className = 'body';
    typingBody.textContent = 'Thinking';
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
      const base = (data && data.error) || 'Something went wrong. Please try again.';
      addSystemNote(data && data.code === 'limit_reached' ? `${base} (See Settings to upgrade.)` : base);
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
    addSystemNote(`Moving on to ${nextPhase.label}`);
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
      addBubble(
        'bot',
        "I'm your AI teacher — ask me anything, on any topic, any time. What's on your mind?"
      );
    } else {
      addBubble('bot', trackCopy(currentMode).welcome);
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
    chatTitleHeading.textContent = 'Study Buddy';
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

    if (data.hasOwnKey) {
      apiKeyStatus.textContent = 'Your own key is set. Your study sessions use your free Gemini quota.';
      apiKeyInput.placeholder = 'Paste a new key to replace it';
      apiKeyRemove.hidden = false;
    } else if (data.usingServerKey) {
      apiKeyStatus.textContent = "You're using this server's shared key. Add your own for a private quota.";
      apiKeyRemove.hidden = true;
    } else {
      apiKeyStatus.textContent = 'No key yet — add one below to start studying. It’s free and takes a minute.';
      apiKeyRemove.hidden = true;
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
    saveBtn.textContent = 'Checking...';

    // The server tries a real call before storing, so a mistyped key is caught
    // here rather than on the user's first question.
    const { ok, data } = await api('/api/setup/me/key', { method: 'PUT', body: { key } });

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save key';

    if (!ok) {
      apiKeyError.textContent = (data && data.error) || 'That key was rejected.';
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

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function isoDate(year, month, day) {
    return `${year}-${pad2(month + 1)}-${pad2(day)}`;
  }

  function todayIso() {
    const now = new Date();
    return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  function renderCalendar() {
    calMonthYear.textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;
    calGrid.innerHTML = '';

    const firstOfMonth = new Date(calendarYear, calendarMonth, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const dueDates = new Set(tasks.filter((t) => t.dueAt).map((t) => t.dueAt.slice(0, 10)));
    const today = todayIso();

    const cells = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, outside: true, year: calendarMonth === 0 ? calendarYear - 1 : calendarYear, month: calendarMonth === 0 ? 11 : calendarMonth - 1 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, outside: false, year: calendarYear, month: calendarMonth });
    }
    const nextMonthYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
    const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
    let nextMonthDay = 1;
    while (cells.length % 7 !== 0 || cells.length < 42) {
      cells.push({ day: nextMonthDay, outside: true, year: nextMonthYear, month: nextMonth });
      nextMonthDay += 1;
      if (cells.length >= 42) break;
    }

    cells.forEach((cell) => {
      const iso = isoDate(cell.year, cell.month, cell.day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calendar-day';
      if (cell.outside) btn.classList.add('outside-month');
      if (iso === today) btn.classList.add('today');
      if (iso === selectedDate) btn.classList.add('selected');

      const num = document.createElement('span');
      num.textContent = String(cell.day);
      btn.appendChild(num);

      if (dueDates.has(iso)) {
        const dot = document.createElement('span');
        dot.className = 'calendar-day-dot';
        btn.appendChild(dot);
      }

      btn.addEventListener('click', () => {
        selectedDate = selectedDate === iso ? null : iso;
        if (cell.outside) {
          calendarYear = cell.year;
          calendarMonth = cell.month;
        }
        if (selectedDate) taskDueInput.value = selectedDate;
        renderCalendar();
        renderTaskList();
      });

      calGrid.appendChild(btn);
    });
  }

  calPrevBtn.addEventListener('click', () => {
    calendarMonth -= 1;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear -= 1;
    }
    renderCalendar();
  });

  calNextBtn.addEventListener('click', () => {
    calendarMonth += 1;
    if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear += 1;
    }
    renderCalendar();
  });

  calTodayBtn.addEventListener('click', () => {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    renderCalendar();
  });

  // ---------- Planner: task list ----------

  function formatDue(dueAt) {
    if (!dueAt) return null;
    const d = new Date(dueAt);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderTaskList() {
    taskList.innerHTML = '';

    const visible = selectedDate
      ? tasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === selectedDate)
      : tasks;

    taskListHeading.textContent = selectedDate
      ? `Tasks — ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'All tasks';
    taskFilterClear.hidden = !selectedDate;

    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'task-list-empty';
      empty.textContent = selectedDate ? 'Nothing due this day.' : 'No tasks yet — add one above.';
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
      checkbox.setAttribute('aria-label', `Mark "${task.title}" as done`);
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
      meta.textContent = metaParts.length ? metaParts.join(' · ') : 'No due date';

      main.appendChild(title);
      main.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'task-row-delete';
      del.setAttribute('aria-label', `Delete "${task.title}"`);
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
    videoSubmitBtn.textContent = isBusy ? 'Summarizing…' : 'Summarize';
  }

  function showVideoResult(video) {
    videoErrorBlock.hidden = true;
    videoResultBlock.hidden = false;
    videoResultTitle.textContent = video.title || 'Untitled video';
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
      const base = (data && data.error) || 'Something went wrong. Please try again.';
      showVideoError(isLimitReached ? `${base} (See Settings to upgrade.)` : base, !isLimitReached);
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
      meta.textContent = video.author || 'YouTube';

      item.appendChild(title);
      item.appendChild(meta);
      item.addEventListener('click', () => {
        videoUrlInput.value = video.url;
        showVideoResult(video);
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
    }

    const { data: billing } = await api('/api/billing');
    if (billing) {
      settingsPlanName.textContent = billing.plan === 'paid' ? 'Paid plan' : 'Free plan';
      settingsUpgradeBtn.hidden = billing.plan === 'paid';
      const msgs = billing.usage.ai_messages;
      const vids = billing.usage.video_summaries;
      settingsPlanUsage.textContent = `${msgs.used}/${msgs.limit} AI messages today · ${vids.used}/${vids.limit} video summaries this month`;
    }
  }

  settingsUpgradeBtn.addEventListener('click', async () => {
    billingError.textContent = '';
    settingsUpgradeBtn.disabled = true;
    const { ok, data } = await api('/api/billing/checkout', { method: 'POST' });
    settingsUpgradeBtn.disabled = false;

    if (!ok) {
      billingError.textContent =
        (data && data.code === 'billing_not_configured'
          ? 'Upgrades aren’t set up yet — the site owner needs to add Stripe keys.'
          : data && data.error) || 'Something went wrong.';
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
      profileError.textContent = (data && data.error) || 'Something went wrong.';
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
      passwordError.textContent = (data && data.error) || 'Something went wrong.';
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
      if (data) applyTheme(data.settings.theme);
      await initApp();
    } else {
      showAuthView();
    }
  }

  bootstrap();
})();
