# Rested — sleep cycle calculator

A small static site that works out when to go to bed, or when to set your alarm,
so you wake up at the end of a sleep cycle instead of in the middle of one.

Two modes:

- **I want to wake up at…** — give it your alarm time, get four bedtimes back.
- **I'm going to bed at…** — give it a bedtime, get four alarm times back.

Each result shows the number of cycles, how much sleep that adds up to, and — for
bedtimes — how long from now that is. Five or six cycles (7.5–9 hours) are marked
as the ones to aim for.

## Running it

There's no build step and no dependencies. Open `index.html` in a browser, or
serve the folder:

```bash
npx http-server site -p 8080
```

Deploying is just as simple: point any static host (GitHub Pages, Netlify,
Cloudflare Pages, Vercel) at this folder.

## How it works

Sleep runs in cycles that average about 90 minutes — light sleep, then deep
slow-wave sleep, then REM, then back around. Waking at the end of a cycle, while
you're already in light sleep, avoids the thick groggy feeling (sleep inertia)
you get when an alarm pulls you out of deep sleep.

So the arithmetic is:

```
bedtime = alarm − (cycles × cycle length) − time to fall asleep
alarm   = bedtime + time to fall asleep + (cycles × cycle length)
```

Defaults are a 90-minute cycle and 15 minutes to fall asleep, both adjustable
under **Fine-tune** (70–110 minutes and 0–45 minutes), along with a 12/24-hour
clock toggle. Preferences and the theme are stored in `localStorage`.

Real cycles vary between people — roughly 70 to 120 minutes — and lengthen
through the night, so the site presents its output as a guide rather than a
precise schedule.

## Files

```
index.html    markup and copy
styles.css    design tokens, dark and light themes
app.js        calculation, rendering, preferences, star field
```

Vanilla HTML/CSS/JS, no framework. The theme follows your system by default and
the toggle in the corner overrides it. Respects `prefers-reduced-motion`.
