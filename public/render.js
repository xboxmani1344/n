(() => {
  'use strict';

  // Turns an assistant reply into DOM.
  //
  // Replies arrive as markdown with LaTeX in them - that is simply how these
  // models write - and a coach explaining Schrodinger's equation is unreadable
  // when that arrives as literal "$\Psi$" and "**bold**".
  //
  // Everything here is built with createElement and textContent. No string of
  // markup is ever assigned, so there is no path by which a reply - or anything
  // a user talked the model into repeating back - can inject HTML. The one
  // exception is KaTeX's own output, which it builds itself.

  // A private-use character, so it cannot collide with anything the model
  // writes, and is not a control character.
  const SENTINEL = '';

  // --- maths ----------------------------------------------------------------

  // $$..$$ and \[..\] are display; $..$ and \(..\) are inline. Pulled out
  // before markdown runs, because * and _ are ordinary characters inside maths
  // and italics would otherwise eat them.
  function extractMath(text) {
    const found = [];
    const patterns = [
      { re: /\$\$([\s\S]+?)\$\$/g, display: true },
      { re: /\\\[([\s\S]+?)\\\]/g, display: true },
      { re: /\\\(([\s\S]+?)\\\)/g, display: false },
      // A lone $ is a dollar sign. Requiring no space just inside the
      // delimiters leaves "it costs $5 or $10" alone.
      { re: /\$(?!\s)((?:[^$\n]|\\\$)+?)(?<!\s)\$/g, display: false },
    ];

    let out = text;
    for (const { re, display } of patterns) {
      out = out.replace(re, (_whole, body) => {
        found.push({ body, display });
        return `${SENTINEL}${found.length - 1}${SENTINEL}`;
      });
    }
    return { text: out, found };
  }

  function renderMath(entry) {
    const span = document.createElement('span');
    span.className = entry.display ? 'math-display' : 'math-inline';

    if (!window.katex) {
      // Not loaded: show the source rather than nothing, so it can still be
      // read, just not prettily.
      span.textContent = entry.display ? entry.body.trim() : `$${entry.body}$`;
      return span;
    }

    try {
      window.katex.render(entry.body, span, {
        displayMode: entry.display,
        throwOnError: false,
        strict: false,
      });
    } catch {
      span.textContent = entry.body;
    }
    return span;
  }

  // --- inline markdown ------------------------------------------------------

  // Puts the original LaTeX back where a placeholder sits, for the one context
  // that must stay verbatim.
  function restoreMath(text, math) {
    return text.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'), (_w, n) => {
      const entry = math[Number(n)];
      if (!entry) return '';
      return entry.display ? `$$${entry.body}$$` : `$${entry.body}$`;
    });
  }

  function appendInline(parent, text, math) {
    // One pass, longest markers first so ** is not read as two separate *.
    const re = new RegExp(
      `(${SENTINEL}\\d+${SENTINEL})` +
        '|`([^`]+)`' +
        '|\\*\\*([^*]+)\\*\\*' +
        '|__([^_]+)__' +
        '|\\*([^*\\n]+)\\*' +
        '|_([^_\\n]+)_' +
        '|\\[([^\\]]+)\\]\\(([^)\\s]+)\\)',
      'g'
    );

    let last = 0;
    let m;

    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));

      if (m[1]) {
        const index = Number(m[1].slice(1, -1));
        if (math[index]) parent.appendChild(renderMath(math[index]));
      } else if (m[2] !== undefined) {
        const el = document.createElement('code');
        // Verbatim, so no recursion - but a placeholder left inside would be an
        // invisible character where the maths used to be, so put the source back.
        el.textContent = restoreMath(m[2], math);
        parent.appendChild(el);
      } else if (m[3] !== undefined || m[4] !== undefined) {
        const el = document.createElement('strong');
        // Recursive, not textContent. Maths inside bold - "**Newton's second
        // law ($F = ma$)**" is exactly how these replies are written - was
        // being flattened to a placeholder character and lost.
        appendInline(el, m[3] !== undefined ? m[3] : m[4], math);
        parent.appendChild(el);
      } else if (m[5] !== undefined || m[6] !== undefined) {
        const el = document.createElement('em');
        appendInline(el, m[5] !== undefined ? m[5] : m[6], math);
        parent.appendChild(el);
      } else if (m[7] !== undefined) {
        // Only http(s). javascript: and data: URLs are exactly why this is a
        // whitelist and not a blacklist.
        const safe = /^https?:\/\//i.test(m[8]);
        const el = document.createElement(safe ? 'a' : 'span');
        appendInline(el, m[7], math);
        if (safe) {
          el.href = m[8];
          el.target = '_blank';
          el.rel = 'noopener noreferrer';
        }
        parent.appendChild(el);
      }
      last = re.lastIndex;
    }

    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  // --- block markdown -------------------------------------------------------

  const BLOCK_START = /^(#{1,6}\s|>|\s*```|\s*[-*+]\s|\s*\d+[.)]\s)/;

  function render(text, into) {
    into.textContent = '';
    const { text: stripped, found } = extractMath(String(text == null ? '' : text));
    const lines = stripped.split('\n');

    let i = 0;
    let list = null;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code, verbatim: the one place markdown inside must not be read.
      const fence = line.match(/^\s*```(\w*)\s*$/);
      if (fence) {
        list = null;
        const body = [];
        i += 1;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
        i += 1;
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = body.join('\n');
        if (fence[1]) code.className = `lang-${fence[1]}`;
        pre.appendChild(code);
        into.appendChild(pre);
        continue;
      }

      if (!line.trim()) {
        list = null;
        i += 1;
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        list = null;
        // Never h1 or h2: the page already has those, and a reply should not
        // outrank the page it sits inside.
        const el = document.createElement(`h${Math.min(6, heading[1].length + 2)}`);
        appendInline(el, heading[2], found);
        into.appendChild(el);
        i += 1;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        list = null;
        into.appendChild(document.createElement('hr'));
        i += 1;
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        list = null;
        const parts = [quote[1]];
        i += 1;
        while (i < lines.length && /^>\s?/.test(lines[i])) parts.push(lines[i++].replace(/^>\s?/, ''));
        const el = document.createElement('blockquote');
        appendInline(el, parts.join(' ').trim(), found);
        into.appendChild(el);
        continue;
      }

      const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        const wanted = bullet ? 'ul' : 'ol';
        if (!list || list.tagName.toLowerCase() !== wanted) {
          list = document.createElement(wanted);
          into.appendChild(list);
        }
        const li = document.createElement('li');
        appendInline(li, (bullet || numbered)[1], found);
        list.appendChild(li);
        i += 1;
        continue;
      }

      list = null;
      const para = [line];
      i += 1;
      // Consecutive non-blank lines are one paragraph, as markdown has it.
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) para.push(lines[i++]);
      const p = document.createElement('p');
      appendInline(p, para.join('\n'), found);
      into.appendChild(p);
    }
  }

  window.renderMessage = render;
})();
