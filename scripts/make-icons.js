'use strict';

// Renders the PNG brand assets from the same SVG the site uses, so the icon on
// a home screen and the mark in the header cannot drift apart.
//
// Not part of `npm install` or the deploy: it needs a browser, and the files it
// writes are committed. Run it only after changing public/brand/mark.svg:
//
//   node scripts/make-icons.js
//
// Requires playwright to be available. If it is not, this exits with a message
// rather than a stack trace - the committed PNGs are still perfectly good.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'brand');
const MARK = fs.readFileSync(path.join(OUT, 'mark.svg'), 'utf8');

const INK = '#f3f3f3';
const GROUND = '#111111';

// A maskable icon can be cropped to a circle of about 80% of the width, so the
// glyph is kept well inside that rather than filling the square.
function iconPage(size) {
  const glyph = Math.round(size * 0.56);
  return `<body style="margin:0;width:${size}px;height:${size}px;background:${GROUND};display:flex;align-items:center;justify-content:center">
  <div style="width:${glyph}px;height:${glyph}px;color:${INK}">${MARK}</div></body>`;
}

function ogPage() {
  return `<body style="margin:0;width:1200px;height:630px;background:${GROUND};color:${INK};
  font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;
  align-items:flex-start;justify-content:center;padding:0 96px;box-sizing:border-box">
  <div style="display:flex;align-items:center;gap:26px">
    <div style="width:132px;height:132px;color:${INK};margin-inline-start:-14px">${MARK}</div>
    <div style="font-size:96px;font-weight:700;letter-spacing:-0.03em">Buddy</div>
  </div>
  <div style="font-size:40px;opacity:0.62;margin-top:36px;line-height:1.45;max-width:22ch">
    A coach for studying, training, eating better and learning to code.</div>
</body>`;
}

const TARGETS = [
  { name: 'icon-180.png', w: 180, h: 180, html: iconPage(180) },
  { name: 'icon-192.png', w: 192, h: 192, html: iconPage(192) },
  { name: 'icon-512.png', w: 512, h: 512, html: iconPage(512) },
  { name: 'og.png', w: 1200, h: 630, html: ogPage() },
];

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('playwright is not installed - skipping. The committed PNGs are unchanged.');
    process.exit(1);
  }

  // Whatever browser is actually on this machine, rather than the exact build
  // playwright would download.
  const candidates = [
    process.env.CHROME_PATH,
    ...(fs.existsSync('/opt/pw-browsers')
      ? fs
          .readdirSync('/opt/pw-browsers')
          .filter((d) => d.startsWith('chromium-'))
          .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)
      : []),
  ].filter((p) => p && fs.existsSync(p));

  const browser = await chromium.launch({
    ...(candidates.length ? { executablePath: candidates[0] } : {}),
    args: ['--no-sandbox'],
  });

  for (const target of TARGETS) {
    const page = await browser.newPage({ viewport: { width: target.w, height: target.h } });
    await page.setContent(target.html);
    await page.screenshot({ path: path.join(OUT, target.name) });
    await page.close();
    console.log(`wrote public/brand/${target.name}  ${target.w}x${target.h}`);
  }

  await browser.close();
}

main();
