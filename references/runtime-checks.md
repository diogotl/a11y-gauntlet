# Runtime checks

Use these when there is a running app or a URL. Run snippets through the browser tool that evaluates JavaScript in the page (`evaluate_script` on Chrome DevTools). Each snippet is self-contained and returns plain JSON. Run them on each page and in each significant state (menu open, dialog open, error shown, mobile width). Report only confirmed findings.

## 0. Setup

The element queries below use a small `$$` helper that also walks open shadow roots (web components). It is defined inside each snippet. Iframes are separate documents: run the snippets inside each frame. ARIA id references do not cross shadow boundaries, so a reference that resolves in the page but points into a shadow root, or the reverse, counts as broken (ROLE-06).

1. Open the page and wait for it to settle.
2. Take an accessibility snapshot and keep it for comparing names, roles and states.
3. Check the console for errors that break behaviour.

## 1. Unnamed interactive elements (NAME-02, NAME-03)

```js
() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s), ...[...r.querySelectorAll('*')].filter(e => e.shadowRoot).flatMap(e => $$(s, e.shadowRoot))];
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=radio],[role=switch],[role=tab],[role=menuitem],[role=option],[role=combobox],[role=slider],[role=textbox],[tabindex]:not([tabindex="-1"])';
  const text = (el) => (el.getAttribute('aria-label') || '').trim()
    || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(i => document.getElementById(i)?.textContent || '').join(' ').trim()
    || (el.labels ? [...el.labels].map(l => l.textContent).join(' ').trim() : '')
    || (el.alt || '').trim()
    || (el.innerText || el.textContent || '').trim()
    || (el.getAttribute('title') || '').trim()
    || [...el.querySelectorAll('img[alt],svg[aria-label],svg title')].map(n => n.alt || n.getAttribute('aria-label') || n.textContent).join(' ').trim();
  return $$(sel)
    .filter(el => el.checkVisibility?.() ?? true)
    .filter(el => !text(el))
    .slice(0, 100)
    .map(el => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), html: el.outerHTML.slice(0, 160) }));
}
```

## 2. Broken ARIA references and duplicate ids (ROLE-06, ROLE-14)

```js
() => {
  const refs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-errormessage', 'aria-details', 'aria-flowto'];
  const broken = [];
  for (const attr of refs) {
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      for (const id of el.getAttribute(attr).split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) broken.push({ attr, id, html: el.outerHTML.slice(0, 140) });
      }
    }
  }
  const counts = {};
  document.querySelectorAll('[id]').forEach(el => counts[el.id] = (counts[el.id] || 0) + 1);
  const dupes = Object.entries(counts).filter(([, n]) => n > 1).map(([id, n]) => ({ id, n }));
  const forMissing = [...document.querySelectorAll('label[for]')].filter(l => !document.getElementById(l.htmlFor)).map(l => l.htmlFor);
  return { broken: broken.slice(0, 50), dupes: dupes.slice(0, 50), forMissing };
}
```

Note: `aria-controls` on a closed popup may point at an element not yet in the DOM. That is valid per LAYER-01 only if the attribute is removed while the popup is closed, so check the open and closed states.

## 3. Tab order and positive tabindex (KEY-01, KEY-05)

```js
() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s), ...[...r.querySelectorAll('*')].filter(e => e.shadowRoot).flatMap(e => $$(s, e.shadowRoot))];
  const focusables = $$('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[contenteditable=true]')
    .filter(el => !el.disabled && el.tabIndex >= 0 && (el.checkVisibility?.() ?? true));
  return {
    positive: focusables.filter(el => el.tabIndex > 0).map(el => el.outerHTML.slice(0, 120)),
    count: focusables.length,
    hiddenFocusable: [...document.querySelectorAll('[aria-hidden="true"] a[href],[aria-hidden="true"] button,[aria-hidden="true"] input,[aria-hidden="true"] [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.closest('[inert]')).map(el => el.outerHTML.slice(0, 120)),
    order: focusables.slice(0, 60).map(el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : ''}`),
  };
}
```

## 4. Focus visibility (FOCUS-01, FOCUS-03)

Focus each element with the keyboard (Tab) and read the computed style. This snippet checks the currently focused element, so call it after each `press_key Tab`.

```js
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { focus: 'body' };
  const cs = getComputedStyle(el);
  const bs = cs.boxShadow;
  return {
    el: el.outerHTML.slice(0, 120),
    focusVisible: el.matches(':focus-visible'),
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} offset ${cs.outlineOffset}`,
    boxShadow: bs === 'none' ? null : bs,
    visibleIndicator: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || bs !== 'none',
    rect: (({ top, bottom, left, right }) => ({ top, bottom, left, right }))(el.getBoundingClientRect()),
  };
}
```

A focused element with `visibleIndicator: false` and `focusVisible: true` is a FOCUS-01 failure unless the border, background or underline clearly changes (verify with a screenshot). For FOCUS-02, compare `rect` with the sticky elements:

```js
() => [...document.querySelectorAll('*')].filter(e => ['fixed', 'sticky'].includes(getComputedStyle(e).position) && e.offsetHeight > 0)
  .map(e => ({ el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''), top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, h: e.offsetHeight }))
```

## 5. Target size (PTR-04)

```js
() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s), ...[...r.querySelectorAll('*')].filter(e => e.shadowRoot).flatMap(e => $$(s, e.shadowRoot))];
  return $$('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=option]')
  .filter(el => el.checkVisibility?.() ?? true)
  .map(el => { const r = el.getBoundingClientRect(); return { el: el.outerHTML.slice(0, 100), w: Math.round(r.width), h: Math.round(r.height), inline: getComputedStyle(el).display === 'inline' && !!el.closest('p,li') }; })
  .filter(x => (x.w < 24 || x.h < 24) && !x.inline)
  .slice(0, 80);
}
```

Targets under 24×24 are only acceptable if a 24px circle centred on them does not touch another target (spacing exemption), or an equivalent target exists. Check the neighbours before reporting.

## 6. Document basics (STRUCT-01..05, VIS-01)

```js
() => {
  const h = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].map(e => ({ level: +(e.tagName[1] || e.getAttribute('aria-level')), text: e.textContent.trim().slice(0, 60) }));
  const skips = h.filter((x, i) => i > 0 && x.level - h[i - 1].level > 1);
  const vp = document.querySelector('meta[name=viewport]')?.content || null;
  return {
    lang: document.documentElement.lang || null,
    title: document.title,
    h1Count: h.filter(x => x.level === 1).length,
    headingSkips: skips,
    landmarks: ['main', 'nav', 'header', 'footer', 'aside', '[role=search]', '[role=banner]', '[role=contentinfo]'].map(s => [s, document.querySelectorAll(s).length]),
    skipLink: !!document.querySelector('a[href^="#"]:first-of-type'),
    viewport: vp,
    zoomBlocked: !!vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*(1(\.0)?|0?\.\d+)\b/i.test(vp),
    imagesNoAlt: [...document.querySelectorAll('img:not([alt])')].slice(0, 20).map(i => i.src.slice(-60)),
    tablesNoHeaders: [...document.querySelectorAll('table')].filter(t => !t.querySelector('th')).length,
    iframesNoTitle: [...document.querySelectorAll('iframe:not([title])')].length,
  };
}
```

## 7. State flip checks (STATE-01, STATE-02, STATE-03, LAYER-01)

For every trigger with `aria-expanded`, `aria-pressed`, `aria-checked` or `aria-selected`:

1. Read the attribute value.
2. Activate it with the keyboard.
3. Read it again. It must change, and the change must match what is visible.
4. Check `aria-controls` points at an element that exists while open.

```js
(selector) => {
  const el = document.querySelector(selector);
  const a = ['aria-expanded', 'aria-pressed', 'aria-checked', 'aria-selected', 'aria-controls', 'aria-haspopup'];
  return Object.fromEntries(a.map(n => [n, el?.getAttribute(n)]));
}
```

## 8. Keyboard walk script

Perform these steps with `press_key` and read `document.activeElement` after each (use the focus snippet above).

1. Reload. Press Tab once. Focus must land on a skip link or the first interactive element and be visible.
2. Tab through the page. For each stop note the name, role, and whether focus is visible. Stop when focus reaches the browser chrome or loops. Flag stops that are invisible, unnamed, or illogical in order. Flag any element where Tab does not advance (KEY-03).
3. Shift+Tab backwards through at least five stops. Order must be the reverse.
4. **Triggers.** For each popup trigger (menu, select, popover, dialog, tooltip):
   - Enter, then Escape. Focus must return to the trigger (LAYER-07).
   - Space, then Escape. Same.
   - ArrowDown on menu and select triggers should open them (MENU-03, SEL-03).
   - With the layer open, press Tab: modal dialogs must keep focus inside (DLG-03); menus close (MENU-05); popovers continue.
   - With the layer open, press Escape twice if nested: one layer per press (LAYER-04).
5. **Composite widgets.** In tab lists, menus, listboxes, radio groups, toolbars and sliders: arrows must move within, Home/End jump, one Tab leaves (KEY-05).
6. **Type-ahead.** In menus and selects, type the first letter of an item.
7. **Forms.** Submit an empty form. Focus must move to the first error or a summary; each error must be associated with its field (FORM-04, STATE-05).
8. **Dynamic changes.** Add or remove a list item, apply a filter, change a tab. Focus must not drop to the body (FOCUS-05) and status changes must be announced (MEDIA-04): check for a live region element that exists before the message and updates with it.
9. **Route changes.** Navigate to another route. Focus moves to the new heading or main (FOCUS-06) and the title changes (STRUCT-03).
10. **IME.** Open a combobox or menu, type with an IME composition if available. Escape during composition must not close the layer (LAYER-05). If no IME is available, read the key handler instead.

## 9. Preferences and reflow

- Emulate `prefers-reduced-motion: reduce`, reload, trigger the main animations. Large movement must be gone; the UI must still give feedback (MOTION-01).
- Emulate dark mode and re-check contrast of text, borders, focus rings and states (VIS-02, VIS-03). Compute text contrast on suspect elements:

```js
(selector) => {
  const el = document.querySelector(selector);
  const cs = getComputedStyle(el);
  const parse = c => c.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bg = el, bgc = null;
  while (bg && !bgc) { const c = getComputedStyle(bg).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') bgc = c; bg = bg.parentElement; }
  const fg = parse(cs.color), b = parse(bgc || 'rgb(255,255,255)');
  const [l1, l2] = [lum(fg), lum(b)].sort((a, b) => b - a);
  return { color: cs.color, background: bgc, ratio: +((l1 + 0.05) / (l2 + 0.05)).toFixed(2), fontSize: cs.fontSize, fontWeight: cs.fontWeight };
}
```

This ignores background images, gradients and alpha, so mark those cases **Needs review** and verify visually.

- Resize to 320px width and scroll. No horizontal scroll except tables, maps, code (VIS-06).
- Zoom to 200% and 400%. Nothing may be clipped or overlap (VIS-05, VIS-07).
- Apply text spacing overrides and check for clipping:

```js
() => { const s = document.createElement('style'); s.id = '__ts'; s.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}'; document.head.append(s); return 'applied'; }
```

Screenshot, then remove `#__ts`.

## 10. Lighthouse cross-check

Run the accessibility category. Use failures as leads, not as the final answer. Lighthouse covers a subset of axe rules, so a score of 100 does not mean the page passes.

## Headless pitfalls (read before you report a failure)

Three measurement mistakes produced false alarms in a real audit. Rule out each before you report a runtime failure:

1. **Timers are delayed in a headless browser that is not in the foreground.** Transitions and `setTimeout` callbacks can take over a second. A modal whose `hidden` event has not fired yet still has focus inside it, so "focus did not return to the trigger" read right after Escape is not a finding. Wait for the framework's own completion event (`hidden.bs.modal`, `transitionend`, the attribute you expect to change) with a bounded poll, never a fixed sleep.
2. **`element.focus()` from a script is not the same as the user tabbing there.** Libraries that open on `focusin` (tooltips, some popovers) may not react, and the page may not own focus. Reach the element with real `Tab` presses from the previous focusable element, then judge.
3. **Do not infer missing keyboard support from the first trial.** Many widgets attach their key handler lazily (after the first click or after hydration). If a key did nothing, repeat after the page has settled and after one interaction, and report the difference as **Review** if it does not reproduce.

Measure state, not time: poll for the condition you are asserting, give up after a bounded wait, and say in the report which waits you used.

## What runtime cannot tell you

Real screen reader output, whether alt text is meaningful, whether captions are accurate, cognitive load and reading level, voice control behaviour, and anything behind authentication you cannot reach. Put these in **Not verified**.
