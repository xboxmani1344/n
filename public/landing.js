(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // With motion reduced, everything is simply visible from the start: no
  // fade-in to wait through, and no scroll-linked movement.
  if (reduceMotion) {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('shown'));
    document.querySelectorAll('.lp-step').forEach((el) => el.classList.add('active'));
    document.querySelectorAll('.lp-seg').forEach((el) => el.classList.add('done'));
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

  // --- scroll-driven phase tracker -----------------------------------------
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
})();
