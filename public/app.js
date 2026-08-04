(() => {
  'use strict';

  const ROMAN = ['I', 'II', 'III', 'IV'];

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
      const li = document.createElement('li');
      li.innerHTML = `<span class="phase-num">${ROMAN[i]}</span>${phase.label}`;
      if (i === phaseIndex) li.classList.add('active');
      else if (i < phaseIndex) li.classList.add('done');
      phaseTracker.appendChild(li);
    });
    footPhase.textContent = `Part ${ROMAN[phaseIndex]} of IV · ${PHASES[phaseIndex].label}`;
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

  async function sendToBackend() {
    setBusy(true);
    const typingEl = document.createElement('div');
    typingEl.className = 'msg typing';
    typingEl.textContent = 'Study Buddy is marking this up…';
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
    handleSend(text);
  });

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
    addSystemNote(`— Turning to Part ${ROMAN[phaseIndex]}: ${PHASES[phaseIndex].label} —`);
    messages.push({
      role: 'user',
      content: `[The learner turned to Part ${ROMAN[phaseIndex]}. Begin the ${PHASES[phaseIndex].label} phase now.]`,
      hidden: true,
    });
    sendToBackend();
  });

  restartBtn.addEventListener('click', () => {
    if (busy) return;
    if (!confirm('Close this booklet and start a fresh one?')) return;
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
