(() => {
  'use strict';

  const PHASES = [
    { key: 'warmup', label: 'Warm-Up' },
    { key: 'learn', label: 'Learn' },
    { key: 'practice', label: 'Practice' },
    { key: 'review', label: 'Review' },
  ];

  const authShell = document.getElementById('auth-shell');
  const appLayout = document.getElementById('app-layout');

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');
  const authTabs = document.querySelectorAll('.auth-tab');
  const googleBtn = document.getElementById('google-btn');

  const sidebarList = document.getElementById('sidebar-list');
  const newSessionBtn = document.getElementById('new-session-btn');
  const newTutorBtn = document.getElementById('new-tutor-btn');

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

  let chats = [];
  let currentChatId = null;
  let currentMode = 'phased';
  let phaseIndex = 0;
  let needsAutoTitle = false;
  let busy = false;

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

  function showAuthView() {
    appLayout.hidden = true;
    authShell.hidden = false;
  }

  function showAppView() {
    authShell.hidden = true;
    appLayout.hidden = false;
  }

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
    return chat.mode === 'tutor' ? 'AI Teacher chat' : 'Study session';
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
        await createChat('phased');
      }
    }
  }

  // ---------- Chat view ----------

  function renderPhaseTracker() {
    phaseTracker.innerHTML = '';
    PHASES.forEach((phase, i) => {
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
      chatTitleSub.textContent = 'Four phases. One session.';
      renderPhaseTracker();
      footPhase.textContent = `${PHASES[phaseIndex].label} — step ${phaseIndex + 1} of ${PHASES.length}`;
      nextPhaseBtn.disabled = phaseIndex >= PHASES.length - 1;
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
    if (currentMode === 'phased') {
      nextPhaseBtn.disabled = isBusy || phaseIndex >= PHASES.length - 1;
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
      addSystemNote((data && data.error) || 'Something went wrong. Please try again.');
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
    if (busy || phaseIndex >= PHASES.length - 1) return;
    phaseIndex += 1;
    const nextPhase = PHASES[phaseIndex];
    applyModeChrome();
    addSystemNote(`Moving on to ${nextPhase.label}`);
    await api(`/api/chats/${currentChatId}`, { method: 'PATCH', body: { phaseKey: nextPhase.key } });
    sendToBackend(`[The learner clicked "Next Phase." Begin the ${nextPhase.label} phase now.]`, true);
  });

  newSessionBtn.addEventListener('click', () => createChat('phased'));
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
      addBubble(
        'bot',
        "What would you like to study today, and what's your goal for this session (understand a concept, prep for a test, review before an exam)?"
      );
    }
  }

  async function loadChat(chatId, knownChat) {
    currentChatId = chatId;
    chatLog.innerHTML = '';
    needsAutoTitle = false;

    const { data } = await api(`/api/chats/${chatId}`);
    const chat = data.chat || knownChat;
    currentMode = chat.mode;
    phaseIndex = currentMode === 'phased' ? Math.max(0, PHASES.findIndex((p) => p.key === chat.phaseKey)) : 0;

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
    await refreshChatList();

    if (chats.length) {
      await loadChat(chats[0].id);
    } else {
      await createChat('phased');
    }
  }

  async function bootstrap() {
    configureGoogleButton();
    const { ok } = await api('/api/auth/me');
    if (ok) {
      showAppView();
      await initApp();
    } else {
      showAuthView();
    }
  }

  bootstrap();
})();
