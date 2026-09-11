(() => {
  'use strict';

  // Language first, and before the reduced-motion early return below -- someone
  // who has turned animation off still needs the page in their own language.
  const i18n = window.I18N;
  if (i18n) {
    i18n.applyLanguage(i18n.detect(), { persist: false });

    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        i18n.applyLanguage(i18n.lang === 'fa' ? 'en' : 'fa');
      });
    }
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- track carousel -------------------------------------------------------
  // The phase names, the "track 1 of 3" line and the dot labels are all
  // language-dependent, so this runs again whenever the language changes.
  // It also runs under reduced motion: the CSS turns the carousel into three
  // static cards there, but those cards still need their text.

  let scrollToTrack = () => {};
  let syncDots = () => {};
  const trackPanels = [...document.querySelectorAll('.lp-track')];
  const trackDots = document.getElementById('lp-track-dots');

  function renderTrackText() {
    if (!i18n) return;

    trackPanels.forEach((panel, index) => {
      const list = panel.querySelector('.lp-track-phases');
      if (list) {
        list.innerHTML = '';
        i18n
          .t(list.dataset.phases)
          .split('·')
          .map((name) => name.trim())
          .filter(Boolean)
          .forEach((name) => {
            const li = document.createElement('li');
            li.textContent = name;
            list.appendChild(li);
          });
      }

      const count = panel.querySelector('.lp-track-count');
      if (count) {
        count.textContent = i18n.t('lp.track.count', {
          n: i18n.num(index + 1),
          total: i18n.num(trackPanels.length),
        });
      }
    });
  }

  function renderTrackDots(onSelect) {
    if (!trackDots || !i18n) return;
    trackDots.innerHTML = '';

    trackPanels.forEach((panel, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'lp-track-dot' + (panel.classList.contains('active') ? ' active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', String(panel.classList.contains('active')));
      dot.setAttribute(
        'aria-label',
        i18n.t('lp.track.goto', { name: panel.querySelector('h3').textContent })
      );
      dot.addEventListener('click', () => onSelect(index));
      trackDots.appendChild(dot);
    });
  }

  renderTrackText();
  if (i18n) {
    document.addEventListener('languagechange', () => {
      renderTrackText();
      renderTrackDots(scrollToTrack);
      syncDots();
    });
  }


  // With motion reduced, everything is simply visible from the start: no
  // fade-in to wait through, and no scroll-linked movement.
  // --- scroll-driven track carousel ----------------------------------------
  function setUpTrackCarousel() {
    // Which of the three tracks is showing is a pure function of how far through
    // the tall section the page has scrolled. Reading that directly, rather than
    // counting scroll events or trusting observer order, means a jump - a dot
    // click, a restored scroll position, a hash link - lands on the right track
    // with no catching up to do.

    const trackSection = document.querySelector('.lp-tracks');

    if (trackSection && trackPanels.length) {
      const root = document.documentElement;
      let activeTrack = -1;

      function trackTravel() {
        return Math.max(1, trackSection.offsetHeight - window.innerHeight);
      }

      function setTrack(index) {
        if (index === activeTrack) return;
        activeTrack = index;

        // Every panel is set from the index rather than only the one remembered
        // as previous. The first panel carries `active` in the markup so the page
        // is correct before any script runs, and a reader who lands mid-section -
        // a reload at that scroll position, a link straight to it - would
        // otherwise leave that class in place and show two tracks at once.
        trackPanels.forEach((panel, i) => {
          const isActive = i === index;
          panel.classList.toggle('leaving', !isActive && panel.classList.contains('active'));
          panel.classList.toggle('active', isActive);
          if (isActive) panel.removeAttribute('aria-hidden');
          else panel.setAttribute('aria-hidden', 'true');
        });

        // Retints the fixed backdrop for the whole page, which is what makes
        // this read as changing rooms rather than changing a card.
        root.dataset.track = trackPanels[index].dataset.trackKey;
        syncDots();
      }

      function clearTrack() {
        // Off the section, the page goes back to its neutral monochrome. Left
        // set, the tint would follow the reader down into the next section and
        // look like a bug.
        if (root.dataset.track) delete root.dataset.track;
      }

      function updateTracks() {
        const top = trackSection.getBoundingClientRect().top;
        const progress = Math.min(Math.max(-top / trackTravel(), 0), 1);
        setTrack(Math.min(trackPanels.length - 1, Math.floor(progress * trackPanels.length)));
      }

      let trackTicking = false;
      function onTrackScroll() {
        if (trackTicking) return;
        trackTicking = true;
        requestAnimationFrame(() => {
          updateTracks();
          trackTicking = false;
        });
      }

      // Only listen while the section is on screen, and drop the tint the moment
      // it is not.
      const trackObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((e) => e.isIntersecting);
          if (visible) {
            window.addEventListener('scroll', onTrackScroll, { passive: true });
            window.addEventListener('resize', onTrackScroll, { passive: true });
            updateTracks();
            root.dataset.track = trackPanels[Math.max(activeTrack, 0)].dataset.trackKey;
          } else {
            window.removeEventListener('scroll', onTrackScroll);
            window.removeEventListener('resize', onTrackScroll);
            clearTrack();
          }
        },
        // A thin band across the middle of the viewport rather than the whole of
        // it. The section is three screens tall, so with a plain threshold it
        // counts as visible while the reader is still on the hero, and the hero
        // would sit under a tint belonging to a track they have not reached.
        { threshold: 0, rootMargin: '-45% 0px -45% 0px' }
      );
      trackObserver.observe(trackSection);

      scrollToTrack = (index) => {
        // Aim at the middle of that track's share of the section, so it is
        // unambiguously the active one when the scroll settles.
        const sectionTop = trackSection.getBoundingClientRect().top + window.scrollY;
        const share = trackTravel() / trackPanels.length;
        window.scrollTo({ top: sectionTop + share * (index + 0.5), behavior: 'smooth' });
      };

      syncDots = () => {
        if (!trackDots) return;
        [...trackDots.children].forEach((dot, i) => {
          dot.classList.toggle('active', i === activeTrack);
          dot.setAttribute('aria-selected', String(i === activeTrack));
        });
      };

      renderTrackDots(scrollToTrack);
      updateTracks();
    }
  }

  // Runs whatever the motion preference is. Reduced motion means take the
  // movement out, not take the page apart: the carousel still holds and the
  // colours still change, they just swap instantly instead of sliding. Turning
  // it into a static grid meant someone with that setting saw a different site,
  // and never saw the colours at all - because this driver is what sets them.
  // --- scroll-driven phase tracker -----------------------------------------
  function setUpPhaseTracker() {
    const steps = [...document.querySelectorAll('.lp-step')];
    const segments = [...document.querySelectorAll('.lp-seg')];
    if (!steps.length || !segments.length) return;

    let activeStep = -1;

    function setActive(index) {
      if (index === activeStep) return;
      activeStep = index;

      steps.forEach((step, i) => step.classList.toggle('active', i === index));
      segments.forEach((seg, i) => {
        seg.classList.toggle('active', i === index);
        seg.classList.toggle('done', i < index);
      });
    }

    // Which step owns the middle of the viewport. Reading positions directly
    // rather than trusting observer callback order, because several steps can
    // cross the threshold in one scroll and the last callback is not necessarily
    // the one nearest the centre.
    function update() {
      const middle = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;

      steps.forEach((step, i) => {
        const box = step.getBoundingClientRect();
        const distance = Math.abs(box.top + box.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });

      setActive(best);
    }

    // The tracker only needs recomputing while it is on screen.
    let ticking = false;
    let watching = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible === watching) return;
        watching = visible;
        if (visible) {
          window.addEventListener('scroll', onScroll, { passive: true });
          update();
        } else {
          window.removeEventListener('scroll', onScroll);
        }
      },
      { threshold: 0 }
    );

    const phasesSection = document.querySelector('.lp-phases');
    if (phasesSection) sectionObserver.observe(phasesSection);

    window.addEventListener('resize', onScroll, { passive: true });
  }

  // Both scroll-driven sections run whatever the motion preference is. Which
  // step you are on is state, not movement: marking every step active at once,
  // as this used to, is not a calmer version of the page - it is a broken one,
  // with four "current" steps and a tracker showing all four phases finished.
  setUpTrackCarousel();
  setUpPhaseTracker();

  if (reduceMotion) {
    // The entrance fades are the part that is actually motion.
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('shown'));
    return;
  }

  // --- entrance -------------------------------------------------------------
  // Once shown, stay shown. Re-animating on scroll-back is distracting, and it
  // makes the page feel unstable when someone scrolls up to re-read something.
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('shown');
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));


})();
