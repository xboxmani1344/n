(() => {
  'use strict';

  const PHASES = [
    { key: 'warmup', label: 'Warm-Up' },
    { key: 'learn', label: 'Learn' },
    { key: 'practice', label: 'Practice' },
    { key: 'review', label: 'Review' },
  ];

  const chatLog = document.getElementById('chat-log');
  const phaseTracker = document.getElementById('phase-tracker');
  const footPhase = document.getElementById('foot-phase');
  const composer = document.getElementById('composer');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const nextPhaseBtn = document.getElementById('next-phase-btn');
  const restartBtn = document.getElementById('restart-btn');

  /** @type {{role: 'user'|'assistant', content: string, hidden?: boolean}[]} */
  let messages = [];
  let phaseIndex = 0;
  let busy = false;

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

  async function sendToBackend() {
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phaseKey: PHASES[phaseIndex].key,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addSystemNote(data.error || 'Something went wrong. Please try again.');
        return;
      }

      messages.push({ role: 'assistant', content: data.reply });
      addBubble('bot', data.reply);
    } catch (err) {
      typingEl.remove();
      addSystemNote('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
      messageInput.focus();
    }
  }

  function handleSend(text) {
    messages.push({ role: 'user', content: text });
    addBubble('user', text);
    sendToBackend();
  }

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    autoGrow();
    handleSend(text);
  });

  messageInput.addEventListener('input', autoGrow);

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  nextPhaseBtn.addEventListener('click', () => {
    if (busy || phaseIndex >= PHASES.length - 1) return;
    phaseIndex += 1;
    renderPhaseTracker();
    addSystemNote(`Moving on to ${PHASES[phaseIndex].label}`);
    messages.push({
      role: 'user',
      content: `[The learner clicked "Next Phase." Begin the ${PHASES[phaseIndex].label} phase now.]`,
      hidden: true,
    });
    sendToBackend();
  });

  restartBtn.addEventListener('click', () => {
    if (busy) return;
    if (!confirm('Restart the study session from the beginning?')) return;
    messages = [];
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

  renderPhaseTracker();
  showWelcome();
})();
