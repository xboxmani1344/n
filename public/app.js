(() => {
  'use strict';

  const PHASES = [
    { key: 'warmup', label: 'Warm-Up' },
    { key: 'learn', label: 'Learn' },
    { key: 'practice', label: 'Practice' },
    { key: 'review', label: 'Review' },
  ];

  const authShell = document.getElementById('auth-shell');
  const appShell = document.getElementById('app-shell');

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');
  const authTabs = document.querySelectorAll('.auth-tab');
  const googleBtn = document.getElementById('google-btn');

  const chatLog = document.getElementById('chat-log');
  const phaseTracker = document.getElementById('phase-tracker');
  const footPhase = document.getElementById('foot-phase');
  const composer = document.getElementById('composer');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const nextPhaseBtn = document.getElementById('next-phase-btn');
  const restartBtn = document.getElementById('restart-btn');
  const logoutBtn = document.getElementById('logout-btn');

  let currentChatId = null;
  let phaseIndex = 0;
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
    appShell.hidden = true;
    authShell.hidden = false;
  }

  function showAppView() {
    authShell.hidden = true;
    appShell.hidden = false;
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
    footPhase.textContent = `${PHASES[phaseIndex].label} — step ${phaseIndex + 1} of ${PHASES.length}`;
    nextPhaseBtn.disabled = phaseIndex >= PHASES.length - 1;
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
    nextPhaseBtn.disabled = isBusy || phaseIndex >= PHASES.length - 1;
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

    const { ok, status, data } = await api(`/api/chats/${currentChatId}/messages`, {
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
    renderPhaseTracker();
    addSystemNote(`Moving on to ${nextPhase.label}`);
    await api(`/api/chats/${currentChatId}`, { method: 'PATCH', body: { phaseKey: nextPhase.key } });
    sendToBackend(`[The learner clicked "Next Phase." Begin the ${nextPhase.label} phase now.]`, true);
  });

  restartBtn.addEventListener('click', async () => {
    if (busy) return;
    if (!confirm('Restart the study session from the beginning?')) return;
    const { data } = await api('/api/chats', { method: 'POST', body: { mode: 'phased' } });
    currentChatId = data.chat.id;
    phaseIndex = 0;
    chatLog.innerHTML = '';
    renderPhaseTracker();
    showWelcome();
  });

  function showWelcome() {
    addBubble(
      'bot',
      "What would you like to study today, and what's your goal for this session (understand a concept, prep for a test, review before an exam)?"
    );
  }

  async function initApp() {
    chatLog.innerHTML = '';
    const { data: chatsData } = await api('/api/chats');
    let chat = (chatsData.chats || []).find((c) => c.mode === 'phased');

    if (!chat) {
      const { data: created } = await api('/api/chats', { method: 'POST', body: { mode: 'phased' } });
      chat = created.chat;
    }

    currentChatId = chat.id;
    phaseIndex = Math.max(0, PHASES.findIndex((p) => p.key === chat.phaseKey));
    renderPhaseTracker();

    const { data: chatDetail } = await api(`/api/chats/${currentChatId}`);
    if (chatDetail.messages && chatDetail.messages.length) {
      chatDetail.messages.forEach((m) => addBubble(m.role === 'user' ? 'user' : 'bot', m.content));
    } else {
      showWelcome();
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
