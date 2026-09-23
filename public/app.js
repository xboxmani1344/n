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
    // Against the catalogue the server sent, not a list written out here. The
    // hardcoded version silently resolved every new coach to 'study', so a
    // Writing session opened with the Study welcome and was titled "Study
    // session" - wrong in a way that looked like the coach had not loaded.
    if (key === 'tutor' || TRACKS[key]) return key;
    return 'study';
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
  const historyBtn = document.getElementById('history-btn');
  const historyPanel = document.getElementById('history-panel');
  const topbarBtns = document.querySelectorAll('.topbar-btn');
  const homeShell = document.getElementById('home-shell');
  const agentGrid = document.getElementById('agent-grid');
  const skillCatalogue = document.getElementById('skill-catalogue');
  const skillBar = document.getElementById('skill-bar');

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
  const deleteAccountForm = document.getElementById('delete-account-form');
  const deleteAccountLabel = document.getElementById('delete-account-label');
  const deleteAccountInput = document.getElementById('delete-account-input');
  const deleteAccountError = document.getElementById('delete-account-error');
  // Set when settings load: decides whether the confirmation asks for the
  // password or, for a Google-only account, the email address.
  let hasPassword = true;
  const settingsPlanName = document.getElementById('settings-plan-name');
  const settingsPlanUsage = document.getElementById('settings-plan-usage');
  const planGrid = document.getElementById('plan-grid');
  const discountField = document.getElementById('discount-field');
  const discountLabel = document.getElementById('discount-label');
  const discountInput = document.getElementById('discount-input');
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
        // Sent with the signup rather than left to the settings PATCH that
        // follows: the welcome email goes out the moment the account exists,
        // so by the time the preference is saved the wrong-language email has
        // already been posted.
        language: i18n.lang,
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

  // Google sends people back to /app?auth_error=<code> when a sign-in ends
  // badly. Show it on the form they came from, then take the parameter out of
  // the address bar: left there, a refresh - or a bookmark - would keep
  // reporting a failure that is over.
  function showAuthErrorFromUrl() {
    const code = new URLSearchParams(window.location.search).get('auth_error');
    if (!code) return;

    // Cleared so a refresh does not repeat the message, the same way the
    // payment outcome is handled below.
    const url = new URL(window.location.href);
    url.searchParams.delete('auth_error');
    window.history.replaceState({}, '', url);

    // tr() falls back to the key itself for anything it does not know, which
    // would put "auth.err.whatever" in front of somebody. A general message is
    // honest; an internal key is not.
    const key = `auth.err.${code}`;
    loginError.textContent = tr(key) === key ? tr('auth.err.google') : tr(key);
  }

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
        closeHistory();
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

  // The moving pill behind the active phase. Measured rather than computed from
  // a fraction, because the segments are flex children whose widths depend on
  // their labels - which differ per track and per language.
  function movePhaseIndicator() {
    const indicator = phaseTracker.querySelector('.segment-indicator');
    const active = phaseTracker.querySelector('.segment.active');
    if (!indicator || !active) return;

    // Hidden elements measure as zero, which would collapse the pill and then
    // animate it back out from nothing when the view returns.
    if (!active.offsetWidth) return;

    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft - phaseTracker.clientLeft}px)`;
    indicator.classList.add('placed');
  }

  function renderPhaseTracker() {
    const phases = currentPhases();
    // Rebuilding on every phase change was why nothing animated: a brand new
    // element has no previous value to transition from, so it simply appears in
    // its final state. The markup is now built once per track, and moving on is
    // a class change on elements that already exist.
    const signature = `${trackKey(currentMode)}:${i18n.lang}`;

    if (phaseTracker.dataset.signature !== signature) {
      phaseTracker.innerHTML = '';

      const indicator = document.createElement('span');
      indicator.className = 'segment-indicator';
      phaseTracker.appendChild(indicator);

      phases.forEach((phase, i) => {
        const span = document.createElement('span');
        span.className = 'segment';
        span.setAttribute('role', 'listitem');
        const numEl = document.createElement('span');
        numEl.className = 'segment-num';
        numEl.textContent = num(i + 1);
        span.appendChild(numEl);
        span.appendChild(document.createTextNode(phaseLabel(phase)));
        phaseTracker.appendChild(span);
      });

      phaseTracker.dataset.signature = signature;
    }

    [...phaseTracker.querySelectorAll('.segment')].forEach((el, i) => {
      el.classList.toggle('active', i === phaseIndex);
      el.classList.toggle('done', i < phaseIndex);
    });

    // After layout, so the widths are real.
    requestAnimationFrame(movePhaseIndicator);
  }

  // The labels change width with the language, and the segments are flex, so
  // the pill has to be re-measured on both.
  window.addEventListener('resize', movePhaseIndicator, { passive: true });

  // Colours the whole app for the track being worked on, using the same root
  // attribute the landing page drives. It is what makes a workout session and a
  // nutrition session read as different places rather than the same screen with
  // different words in it.
  //
  // Cleared outside the chat view: the planner and the video pages belong to no
  // track, and leaving the last one's colour behind would look like a bug.
  function applyTrackColour(track) {
    const root = document.documentElement;
    if (track) root.dataset.track = track;
    else delete root.dataset.track;
  }

  function applyModeChrome() {
    const isTutor = currentMode === 'tutor';
    // The tutor is freeform and belongs to no track, so it stays neutral.
    applyTrackColour(isTutor ? null : trackKey(currentMode));
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
    // Only the assistant's side. What the user typed is shown exactly as they
    // typed it - nobody expects their own asterisks to disappear.
    if (role === 'bot' && window.renderMessage) window.renderMessage(text, body);
    else body.textContent = text;

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
  // --- the history panel ----------------------------------------------------

  function setHistoryOpen(open) {
    historyPanel.hidden = !open;
    historyBtn.setAttribute('aria-expanded', String(open));
    // The class is what the transition hangs off; `hidden` alone cannot animate,
    // and toggling it in the same frame as the class would skip the transition.
    if (open) requestAnimationFrame(() => historyPanel.classList.add('open'));
    else historyPanel.classList.remove('open');
  }

  function closeHistory({ focusButton = false } = {}) {
    if (historyPanel.hidden) return;
    setHistoryOpen(false);
    // Only on Escape: after clicking a chat, focus belongs in the conversation,
    // not back on the button that opened the list.
    if (focusButton) historyBtn.focus();
  }

  historyBtn.addEventListener('click', () => setHistoryOpen(historyPanel.hidden));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHistory({ focusButton: true });
  });

  // Anywhere outside the panel and its own button. Listening on the document
  // rather than a backdrop element keeps the rest of the page usable.
  document.addEventListener('click', (e) => {
    if (historyPanel.hidden) return;
    if (historyPanel.contains(e.target) || historyBtn.contains(e.target)) return;
    closeHistory();
  });

  // Goes back to the gallery rather than starting a particular coach - which
  // one to start is the choice Home is for.
  newSessionBtn.addEventListener('click', () => {
    closeHistory();
    switchView('home');
  });

  // The notice before the first nutrition or training session.
  //
  // A dialog rather than an alert(): this has to be readable, and accepting has
  // to be a different act from dismissing. Closing it any other way - Escape,
  // the backdrop, the cancel button - counts as declining, and the session is
  // not started. The server keeps the record; this only shows it.
  const safetyDialog = document.getElementById('safety-dialog');
  const safetyTitle = document.getElementById('safety-title');
  const safetyLead = document.getElementById('safety-lead');
  const safetyPoints = document.getElementById('safety-points');

  function showSafetyNotice(track) {
    return new Promise((resolve) => {
      safetyTitle.textContent = tr(`safety.${track}.title`);
      safetyLead.textContent = tr(`safety.${track}.lead`);

      safetyPoints.innerHTML = '';
      tr(`safety.${track}.points`)
        .split('·')
        .map((point) => point.trim())
        .filter(Boolean)
        .forEach((point) => {
          const li = document.createElement('li');
          li.textContent = point;
          safetyPoints.appendChild(li);
        });

      let accepted = false;
      const accept = () => {
        accepted = true;
        safetyDialog.close();
      };
      const cancel = () => safetyDialog.close();

      const acceptBtn = document.getElementById('safety-accept');
      const cancelBtn = document.getElementById('safety-cancel');
      acceptBtn.addEventListener('click', accept);
      cancelBtn.addEventListener('click', cancel);

      safetyDialog.addEventListener(
        'close',
        () => {
          acceptBtn.removeEventListener('click', accept);
          cancelBtn.removeEventListener('click', cancel);
          resolve(accepted);
        },
        { once: true }
      );

      safetyDialog.showModal();
    });
  }

  async function createChat(mode) {
    if (busy) return;
    let { ok, data } = await api('/api/chats', { method: 'POST', body: { mode } });

    // First nutrition or training session: show the notice, and only continue
    // if it was accepted.
    if (!ok && data && data.code === 'safety_notice_required') {
      const accepted = await showSafetyNotice(data.track);
      if (!accepted) return;
      await api('/api/chats/safety-notice', { method: 'POST', body: { track: data.track } });
      ({ ok, data } = await api('/api/chats', { method: 'POST', body: { mode } }));
    }

    if (!ok) {
      // The plan does not include this track. Say which one does and put them
      // in front of it, rather than failing silently.
      if (data && data.code === 'track_locked') {
        const planName = tr(`plan.${data.requiredPlan}`);
        window.alert(tr('err.trackLocked', { plan: planName }));
        switchView('settings');
        return;
      }
      window.alert((data && data.error) || tr('err.generic'));
      return;
    }

    await refreshChatList();
    await loadChat(data.chat.id, data.chat);
    // Picking a coach on Home has to land in the conversation. Without this the
    // chat loaded behind a still-visible gallery: nothing looked like it had
    // happened, and the skill bar - which lives in the chat view - stayed
    // unreachable.
    switchView('chats');
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
    currentSkills = Array.isArray(chat.skills) ? chat.skills : [];
    phaseIndex = currentMode === 'tutor' ? 0 : Math.max(0, currentPhases().findIndex((p) => p.key === chat.phaseKey));

    applyModeChrome();
    renderSkillBar();
    renderSidebar();

    if (data.messages && data.messages.length) {
      data.messages.forEach((m) => addBubble(m.role === 'user' ? 'user' : 'bot', m.content));
    } else {
      needsAutoTitle = !chat.title && !chat.topic;
      showWelcome();
    }
  }

  // Which tracks this account's plan opens. The server refuses the rest
  // regardless; this only stops someone clicking a button that cannot work.
  let allowedTracks = null;

  // Every coach the server knows about, as a card. Built from /api/phases, so a
  // coach added server-side appears here with no change to this file.
  function renderAgents() {
    if (!agentGrid) return;
    agentGrid.innerHTML = '';

    // Freeform tutor first: it is the one that needs no commitment.
    const entries = [
      { key: 'tutor', label: tr('agent.tutor.label'), blurb: tr('agent.tutor.blurb'), phases: null },
      ...Object.values(TRACKS).map((track) => ({
        key: track.key,
        label: (i18n.lang === 'fa' && track.labelFa) || track.label,
        blurb: (i18n.lang === 'fa' && track.blurbFa) || track.blurb,
        phases: track.phases,
      })),
    ];

    for (const entry of entries) {
      const locked = entry.key !== 'tutor' && allowedTracks !== null && !allowedTracks.includes(entry.key);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'agent-card' + (locked ? ' locked' : '');
      card.dataset.agent = entry.key;

      const name = document.createElement('span');
      name.className = 'agent-name';
      name.textContent = entry.label;
      card.appendChild(name);

      const blurb = document.createElement('span');
      blurb.className = 'agent-blurb';
      blurb.textContent = entry.blurb;
      card.appendChild(blurb);

      if (entry.phases) {
        const steps = document.createElement('span');
        steps.className = 'agent-phases';
        steps.textContent = entry.phases.map(phaseLabel).join(' · ');
        card.appendChild(steps);
      }

      if (locked) {
        const badge = document.createElement('span');
        badge.className = 'agent-lock';
        // Which plan opens it, so a locked card is an answer rather than a wall.
        badge.textContent = tr('home.locked', { plan: tr(`plan.${planForAgent(entry.key)}`) });
        card.appendChild(badge);
      }

      // Left clickable even when locked: createChat surfaces which plan is
      // needed and sends them to the page where they can do something about it.
      card.addEventListener('click', () => createChat(entry.key));
      agentGrid.appendChild(card);
    }
  }

  // The cheapest plan whose track list contains this coach.
  function planForAgent(key) {
    const order = ['free', 'basic', 'plus', 'pro'];
    for (const plan of order) {
      if ((PLAN_TRACKS[plan] || []).includes(key)) return plan;
    }
    return 'pro';
  }

  let PLAN_TRACKS = {};

  async function refreshPlan() {
    const { data } = await api('/api/billing');
    if (data && Array.isArray(data.tracks)) {
      allowedTracks = data.tracks;
      if (data.planTracks) PLAN_TRACKS = data.planTracks;
      renderAgents();
    }
  }

  // The skills catalogue, filled from /api/phases at boot.
  let SKILLS = [];

  function skillText(skill, part) {
    const fa = i18n.lang === 'fa';
    return (fa && skill[`${part}Fa`]) || skill[part];
  }

  // Home: what each skill does, read-only. The switches live in the session.
  function renderSkillCatalogue() {
    if (!skillCatalogue) return;
    skillCatalogue.innerHTML = '';
    for (const skill of SKILLS) {
      const item = document.createElement('div');
      item.className = 'skill-entry';

      const name = document.createElement('span');
      name.className = 'skill-entry-name';
      name.textContent = skillText(skill, 'label');
      item.appendChild(name);

      const desc = document.createElement('span');
      desc.className = 'skill-entry-desc';
      desc.textContent = skillText(skill, 'description');
      item.appendChild(desc);

      skillCatalogue.appendChild(item);
    }
  }

  // The bar above the composer. aria-pressed rather than a checkbox so it reads
  // as a toggle to a screen reader without a label floating beside it.
  function renderSkillBar() {
    if (!skillBar) return;
    skillBar.innerHTML = '';
    for (const skill of SKILLS) {
      const on = currentSkills.includes(skill.key);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'skill-chip' + (on ? ' on' : '');
      chip.setAttribute('aria-pressed', String(on));
      chip.title = skillText(skill, 'description');
      chip.textContent = skillText(skill, 'label');
      chip.addEventListener('click', () => toggleSkill(skill.key));
      skillBar.appendChild(chip);
    }
  }

  let currentSkills = [];

  async function toggleSkill(key) {
    if (!currentChatId) return;
    const next = currentSkills.includes(key)
      ? currentSkills.filter((k) => k !== key)
      : [...currentSkills, key];

    // Painted first, saved after: a toggle that waits on the network feels
    // broken. The server normalises and returns the set it actually stored,
    // which is what wins if the two ever disagree.
    currentSkills = next;
    renderSkillBar();

    const { ok, data } = await api(`/api/chats/${currentChatId}`, {
      method: 'PATCH',
      body: { skills: next },
    });
    if (ok && data && data.chat && Array.isArray(data.chat.skills)) {
      currentSkills = data.chat.skills;
      renderSkillBar();
    }
  }

  async function initApp() {
    refreshPlan();
    chatTitleHeading.textContent = tr('chat.brand');
    refreshKeyState();
    await refreshChatList();

    if (chats.length) {
      // Straight back into the last conversation, which is almost always what
      // someone reopening the app wants.
      await loadChat(chats[0].id);
      switchView('chats');
    } else {
      // Nothing to come back to, so start at the gallery rather than picking a
      // coach on their behalf - which is the whole point of having eight.
      switchView('home');
    }
  }

  // ---------- View switching (Chats / Planner / Video) ----------

  function switchView(view) {
    // Settings has no button of its own up top - the gear opens it - so nothing
    // is marked active while it is showing, rather than leaving Home lit.
    topbarBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === view));

    homeShell.hidden = view !== 'home';
    appShell.hidden = view !== 'chats';
    if (view === 'chats') requestAnimationFrame(movePhaseIndicator);
    plannerShell.hidden = view !== 'planner';
    videoShell.hidden = view !== 'video';
    settingsShell.hidden = view !== 'settings';
    // The history panel is reachable from every view now, so nothing to hide
    // here - but leaving it hanging open across a view change looks like a bug.
    closeHistory();

    if (view === 'home') renderAgents();

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

    // Only the chat view belongs to a track.
    if (view === 'chats') applyModeChrome();
    else applyTrackColour(null);
  }

  topbarBtns.forEach((btn) => {
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


  // ---------- Plans ----------

  // Prices arrive in Rial because that is what the gateway is sent; Toman is
  // what gets shown, because that is what people read prices in. Converted
  // here at the last step so the figure charged and the figure shown are the
  // same number.
  function tomanFromRial(rial) {
    const grouped = Math.round(rial / 10).toLocaleString('en-US');
    // The thousands separator is a different character in Persian. Swapping it
    // unconditionally put the Persian one into the English prices too.
    return i18n.lang === 'fa' ? num(grouped).replace(/,/g, '\u066c') : grouped;
  }

  function trackNames(tracks) {
    return tracks.map((t) => tr(`track.${t}.title`)).join(' · ');
  }

  function renderPlans(billing) {
    planGrid.innerHTML = '';
    if (!billing.plans) return;

    const own = billing.discountCode;
    discountField.hidden = !own;
    if (own) {
      discountLabel.textContent = tr('plan.discountYours', { code: own.code, percent: num(own.percent) });
      // Pre-filled, because a code someone has to go and find in an email is a
      // code most people will not use.
      if (!discountInput.value) discountInput.value = own.code;
    }

    billing.plans.forEach((plan) => {
      const isCurrent = plan.key === billing.plan;
      const card = document.createElement('div');
      card.className = 'plan-card' + (isCurrent ? ' current' : '');

      const name = document.createElement('p');
      name.className = 'plan-card-name';
      name.textContent = tr(`plan.${plan.key}`);

      const price = document.createElement('p');
      price.className = 'plan-card-price';
      price.textContent = tr('plan.perMonth', { price: tomanFromRial(plan.priceRial) });

      const what = document.createElement('p');
      what.className = 'plan-card-tracks';
      what.textContent = trackNames(plan.tracks);

      const msgs = document.createElement('p');
      msgs.className = 'plan-card-msgs';
      msgs.textContent = tr('plan.messages', { n: num(plan.messagesPerDay) });

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill-btn primary-btn plan-card-btn';
      btn.textContent = tr(isCurrent ? 'plan.current' : 'plan.choose');
      btn.disabled = isCurrent;
      btn.addEventListener('click', () => startCheckout(plan.key, btn));

      card.append(name, price, what, msgs, btn);
      planGrid.appendChild(card);
    });
  }

  async function startCheckout(plan, btn) {
    billingError.textContent = '';
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = tr('plan.opening');

    const { ok, data } = await api('/api/billing/checkout', {
      method: 'POST',
      body: { plan, code: discountInput.value.trim() || undefined },
    });

    if (!ok) {
      btn.disabled = false;
      btn.textContent = original;
      const code = data && data.code;
      billingError.textContent =
        code === 'billing_not_configured' || code === 'payment_not_configured'
          ? tr('plan.notConfigured')
          : code && code.startsWith('discount_')
            ? tr('plan.discountBad')
            : (data && data.error) || tr('err.generic');
      return;
    }

    window.location.href = data.url;
  }

  // The gateway sends the payer back to /app?payment=... - tell them what
  // happened rather than dropping them on a page that looks unchanged.
  function reportPaymentOutcome() {
    const outcome = new URLSearchParams(window.location.search).get('payment');
    if (!outcome) return;

    // Cleared so a refresh does not repeat the message.
    const url = new URL(window.location.href);
    url.searchParams.delete('payment');
    window.history.replaceState({}, '', url);

    const key = { ok: 'payment.ok', cancelled: 'payment.cancelled' }[outcome] || 'payment.failed';
    window.setTimeout(() => window.alert(tr(key)), 100);
    if (outcome === 'ok') switchView('settings');
  }

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
    renderAgents();
    renderSkillCatalogue();
    renderSkillBar();

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

      // An account created through Google has no password to ask for, so the
      // confirmation is typing the address instead. Both are something to type;
      // neither is a button that deletes on one click.
      hasPassword = data.settings.hasPassword;
      deleteAccountInput.type = hasPassword ? 'password' : 'email';
      deleteAccountInput.value = '';
      deleteAccountLabel.setAttribute(
        'data-i18n',
        hasPassword ? 'settings.dangerConfirmPassword' : 'settings.dangerConfirmEmail'
      );
      deleteAccountLabel.textContent = tr(
        hasPassword ? 'settings.dangerConfirmPassword' : 'settings.dangerConfirmEmail'
      );
      deleteAccountError.textContent = '';
      applyTheme(data.settings.theme);
      markActiveLanguage();
    }

    const { data: billing } = await api('/api/billing');
    if (billing) {
      settingsPlanName.textContent = billing.plan === 'free' ? tr('settings.planFree') : tr(`plan.${billing.plan}`);
      const msgs = billing.usage.ai_messages;
      const vids = billing.usage.video_summaries;
      settingsPlanUsage.textContent = tr('settings.usage', {
        used: num(msgs.used),
        limit: num(msgs.limit),
        vUsed: num(vids.used),
        vLimit: num(vids.limit),
      });
      renderPlans(billing);
    }
  }

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

  // Deleting the account. The server re-checks whatever is typed here - this
  // form is a confirmation step, not the security boundary.
  deleteAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    deleteAccountError.textContent = '';

    const typed = deleteAccountInput.value.trim();
    if (!typed) return;

    const button = deleteAccountForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = tr('settings.dangerDeleting');

    const { ok, data } = await api('/api/settings/account', {
      method: 'DELETE',
      body: hasPassword ? { password: typed } : { email: typed },
    });

    if (!ok) {
      button.disabled = false;
      button.textContent = tr('settings.dangerButton');
      deleteAccountError.textContent = (data && data.error) || tr('err.retry');
      return;
    }

    // Straight out, rather than back to a signed-in view of an account that no
    // longer exists. A full load also drops every bit of state this page holds.
    window.location.href = '/';
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
    if (!ok || !data) return;
    if (data.tracks) TRACKS = data.tracks;
    if (Array.isArray(data.skills)) {
      SKILLS = data.skills;
      renderSkillCatalogue();
    }
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
      reportPaymentOutcome();
    } else {
      showAuthView();
      // After the view exists, so the message is not written into a form that
      // is still hidden.
      showAuthErrorFromUrl();
    }
  }

  bootstrap();
})();
