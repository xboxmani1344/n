/* Rested — sleep cycle calculator.
   No dependencies, no build step, no network. Preferences live in localStorage. */

(() => {
  'use strict';

  const STORE_KEY = 'rested:prefs';
  const CYCLE_OPTIONS = [6, 5, 4, 3]; // how many full cycles to offer
  const MINUTES_IN_DAY = 1440;

  const el = {
    stars: document.getElementById('stars'),
    themeToggle: document.getElementById('theme-toggle'),
    nowClock: document.getElementById('now-clock'),
    tabs: Array.from(document.querySelectorAll('.tab')),
    panel: document.getElementById('calc-panel'),
    timeLabel: document.getElementById('time-label'),
    timeInput: document.getElementById('time-input'),
    nowBtn: document.getElementById('now-btn'),
    fallAsleep: document.getElementById('fall-asleep'),
    fallAsleepOut: document.getElementById('fall-asleep-out'),
    cycleLength: document.getElementById('cycle-length'),
    cycleLengthOut: document.getElementById('cycle-length-out'),
    segBtns: Array.from(document.querySelectorAll('.seg-btn')),
    results: document.querySelector('.results'),
    resultsTitle: document.getElementById('results-title'),
    resultsSub: document.getElementById('results-sub'),
    cardGrid: document.getElementById('card-grid'),
    fineprint: document.getElementById('fineprint'),
  };

  const localeWants12h = () => {
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    return resolved.hour12 !== undefined ? resolved.hour12 : true;
  };

  const state = {
    mode: 'wake', // 'wake' = they gave an alarm time, 'bed' = they gave a bedtime
    fallAsleep: 15,
    cycleLength: 90,
    hour12: localeWants12h(),
    theme: null, // null follows the system
  };

  // ---------- preferences ----------

  function loadPrefs() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch (err) {
      saved = {};
    }
    if (Number.isFinite(saved.fallAsleep)) state.fallAsleep = clamp(saved.fallAsleep, 0, 45);
    if (Number.isFinite(saved.cycleLength)) state.cycleLength = clamp(saved.cycleLength, 70, 110);
    if (typeof saved.hour12 === 'boolean') state.hour12 = saved.hour12;
    if (saved.theme === 'light' || saved.theme === 'dark') state.theme = saved.theme;
  }

  function savePrefs() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          fallAsleep: state.fallAsleep,
          cycleLength: state.cycleLength,
          hour12: state.hour12,
          theme: state.theme,
        })
      );
    } catch (err) {
      /* private mode, quota, etc. — the app still works, it just forgets. */
    }
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  // ---------- time helpers ----------

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function parseTimeInput(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  function toTimeInputValue(minutes) {
    const wrapped = wrap(minutes);
    return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
  }

  function wrap(minutes) {
    return ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  /** Returns { main: "6:30", period: "AM" } — period is empty in 24-hour mode. */
  function formatClock(minutes) {
    const total = wrap(minutes);
    const h24 = Math.floor(total / 60);
    const m = total % 60;
    const mm = String(m).padStart(2, '0');

    if (!state.hour12) {
      return { main: `${String(h24).padStart(2, '0')}:${mm}`, period: '' };
    }
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { main: `${h12}:${mm}`, period };
  }

  function formatClockFlat(minutes) {
    const { main, period } = formatClock(minutes);
    return period ? `${main} ${period}` : main;
  }

  function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }

  // ---------- calculation ----------

  /**
   * Wake mode: bedtime = alarm − (cycles × cycle length) − time to fall asleep.
   * Bed mode:  alarm   = bedtime + time to fall asleep + (cycles × cycle length).
   */
  function buildOptions(anchor) {
    const rows = CYCLE_OPTIONS.map((cycles) => {
      const sleep = cycles * state.cycleLength;
      const time =
        state.mode === 'wake'
          ? wrap(anchor - sleep - state.fallAsleep)
          : wrap(anchor + state.fallAsleep + sleep);
      return { cycles, sleep, time, inBed: sleep + state.fallAsleep };
    });

    // Both lists read chronologically: earliest bedtime first, earliest alarm first.
    return state.mode === 'wake' ? rows : rows.slice().reverse();
  }

  function badgeFor(cycles) {
    if (cycles >= 5) return 'Ideal';
    if (cycles === 3) return 'Short night';
    return '';
  }

  /** Human "in 2h 40m" / "1h 5m ago", judged against the current clock. */
  function relativeToNow(minutes) {
    const delta = wrap(minutes - nowMinutes());
    if (delta === 0) return { text: 'right now', passed: false };
    // More than 18 hours ahead is far more likely to be a time that just went by.
    if (delta <= 1080) return { text: `in ${formatDuration(delta)}`, passed: false };
    return { text: `${formatDuration(MINUTES_IN_DAY - delta)} ago`, passed: true };
  }

  // ---------- rendering ----------

  function render() {
    const anchor = parseTimeInput(el.timeInput.value);

    el.timeLabel.textContent = state.mode === 'wake' ? 'Alarm time' : 'Lights out';
    el.results.dataset.tone = state.mode === 'wake' ? 'cool' : 'warm';

    el.cardGrid.replaceChildren();

    if (anchor === null) {
      el.resultsTitle.textContent = 'Pick a time to get started';
      el.resultsSub.textContent = '';
      el.fineprint.textContent = '';
      return;
    }

    if (state.mode === 'wake') {
      el.resultsTitle.textContent = 'Go to bed at one of these times';
      el.resultsSub.textContent = `To wake up at ${formatClockFlat(anchor)} at the end of a cycle, not in the middle of one.`;
    } else {
      el.resultsTitle.textContent = 'Set your alarm for one of these times';
      el.resultsSub.textContent = `If you're in bed at ${formatClockFlat(anchor)} and take about ${state.fallAsleep} minutes to drift off.`;
    }

    buildOptions(anchor).forEach((option) => {
      el.cardGrid.appendChild(renderCard(option));
    });

    el.fineprint.textContent =
      `Based on ${state.cycleLength}-minute cycles and ${state.fallAsleep} minutes to fall asleep. ` +
      'Cycles differ from person to person and stretch as the night goes on, so treat these as a guide.';
  }

  function renderCard({ cycles, sleep, time, inBed }) {
    const card = document.createElement('article');
    card.className = 'card' + (cycles >= 5 ? ' best' : '');

    const badgeText = badgeFor(cycles);
    const badge = document.createElement('span');
    badge.className = 'card-badge' + (badgeText ? '' : ' is-placeholder');
    badge.textContent = badgeText || 'x';
    if (!badgeText) badge.setAttribute('aria-hidden', 'true');
    card.appendChild(badge);

    const { main, period } = formatClock(time);
    const timeEl = document.createElement('p');
    timeEl.className = 'card-time';
    const mainEl = document.createElement('span');
    mainEl.textContent = main;
    timeEl.appendChild(mainEl);
    if (period) {
      const periodEl = document.createElement('span');
      periodEl.className = 'card-period';
      periodEl.textContent = period;
      timeEl.appendChild(periodEl);
    }
    card.appendChild(timeEl);

    const pips = document.createElement('div');
    pips.className = 'pips';
    pips.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < CYCLE_OPTIONS[0]; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip' + (i < cycles ? '' : ' empty');
      pips.appendChild(pip);
    }
    card.appendChild(pips);

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    const strong = document.createElement('b');
    strong.textContent = formatDuration(sleep);
    meta.appendChild(strong);
    meta.appendChild(document.createTextNode(` of sleep · ${cycles} cycles`));
    card.appendChild(meta);

    const rel = document.createElement('p');
    rel.className = 'card-rel';
    if (state.mode === 'wake') {
      const { text, passed } = relativeToNow(time);
      rel.textContent = text;
      if (passed) card.classList.add('passed');
    } else {
      rel.textContent = `${formatDuration(inBed)} in bed`;
    }
    card.appendChild(rel);

    return card;
  }

  function renderClock() {
    el.nowClock.textContent = formatClockFlat(nowMinutes());
  }

  function renderTweakOutputs() {
    el.fallAsleep.value = String(state.fallAsleep);
    el.cycleLength.value = String(state.cycleLength);
    el.fallAsleepOut.textContent = `${state.fallAsleep} min`;
    el.cycleLengthOut.textContent = `${state.cycleLength} min`;
    el.segBtns.forEach((btn) => {
      btn.classList.toggle('active', (btn.dataset.hour12 === 'true') === state.hour12);
    });
  }

  // ---------- theme ----------

  /** What the page is actually showing right now, stamp or system preference. */
  function showingLight() {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === 'light') return true;
    if (stamped === 'dark') return false;
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function applyTheme() {
    // Only stamp when there's a stored choice — never clear the attribute, since
    // an embedding page may have set it to hand us the reader's preferred theme.
    if (state.theme) document.documentElement.dataset.theme = state.theme;
    el.themeToggle.setAttribute(
      'aria-label',
      showingLight() ? 'Switch to dark mode' : 'Switch to light mode'
    );
  }

  el.themeToggle.addEventListener('click', () => {
    state.theme = showingLight() ? 'dark' : 'light';
    applyTheme();
    savePrefs();
  });

  // ---------- star field ----------

  function paintStars() {
    const count = window.innerWidth < 640 ? 45 : 80;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      const size = Math.random() < 0.85 ? 1.5 : 2.5;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.left = `${Math.random() * 100}%`;
      star.style.opacity = String(0.2 + Math.random() * 0.6);
      star.style.animationDelay = `${(Math.random() * 4).toFixed(2)}s`;
      fragment.appendChild(star);
    }
    el.stars.replaceChildren(fragment);
  }

  // ---------- events ----------

  function setMode(mode) {
    state.mode = mode;
    el.tabs.forEach((tab) => {
      const on = tab.dataset.mode === mode;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) el.panel.setAttribute('aria-labelledby', tab.id);
    });
    render();
  }

  el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  // Left/right arrows move between tabs, as expected of a tablist.
  document.querySelector('.tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const index = el.tabs.findIndex((t) => t.dataset.mode === state.mode);
    const next = el.tabs[(index + (e.key === 'ArrowRight' ? 1 : el.tabs.length - 1)) % el.tabs.length];
    setMode(next.dataset.mode);
    next.focus();
  });

  el.timeInput.addEventListener('input', render);
  el.timeInput.addEventListener('change', render);

  el.nowBtn.addEventListener('click', () => {
    el.timeInput.value = toTimeInputValue(nowMinutes());
    render();
  });

  el.fallAsleep.addEventListener('input', () => {
    state.fallAsleep = clamp(Number(el.fallAsleep.value), 0, 45);
    el.fallAsleepOut.textContent = `${state.fallAsleep} min`;
    savePrefs();
    render();
  });

  el.cycleLength.addEventListener('input', () => {
    state.cycleLength = clamp(Number(el.cycleLength.value), 70, 110);
    el.cycleLengthOut.textContent = `${state.cycleLength} min`;
    savePrefs();
    render();
  });

  el.segBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.hour12 = btn.dataset.hour12 === 'true';
      renderTweakOutputs();
      savePrefs();
      renderClock();
      render();
    });
  });

  window.addEventListener('resize', debounce(paintStars, 250));

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  // ---------- boot ----------

  loadPrefs();
  applyTheme();
  renderTweakOutputs();
  paintStars();
  renderClock();
  render();

  // Keep the clock and the "in 3h 20m" lines honest as time passes.
  setInterval(() => {
    renderClock();
    render();
  }, 30000);
})();
