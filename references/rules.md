# Rule catalogue

Each rule has an ID (used in the report), the WCAG 2.2 success criterion (SC) when one applies, how to detect it (**S** static scan or code read, **R** runtime in the browser, **M** manual), and the default severity. Validate level A and AA by default. Rows whose SC is marked (AAA) are best-practice checks: report them as Minor/Moderate under the default level and as full failures only with `--level AAA`. Every active WCAG 2.2 success criterion is covered by at least one row: 31 at level A, 24 at AA and 31 at AAA (checked against the W3C text). Criteria that code or a browser cannot decide are marked **M** and must appear under **Not verified** unless you checked them by hand: 1.2.x media, 1.3.3, 2.3.1, 2.4.5, 3.2.3, 3.2.4, 3.2.6, 3.3.4, 3.3.7 and most of level AAA.

WCAG 2.2 changes to remember: 4.1.1 Parsing was removed (duplicate ids still matter when ARIA references them). New in 2.2, level A: 3.2.6 Consistent Help, 3.3.7 Redundant Entry. New, level AA: 2.4.11 Focus Not Obscured (Minimum), 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum), 3.3.8 Accessible Authentication (Minimum). New, level AAA: 2.4.12 Focus Not Obscured (Enhanced), 2.4.13 Focus Appearance, 3.3.9 Accessible Authentication (Enhanced).

## Names and labels (NAME)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| NAME-01 | Every `<img>` / `<Image>` has `alt`. Informative images describe purpose; decorative use `alt=""` | 1.1.1 | S, R | Serious |
| NAME-02 | Every button, link, menu item, tab and custom control has an accessible name (text, `aria-label`, `aria-labelledby`). Icon-only controls named, icon `aria-hidden` | 4.1.2, 2.4.4, 1.1.1 | S, R | Blocker |
| NAME-03 | Every form control has a programmatic label (`<label for>`, wrapping label, `aria-label`, `aria-labelledby`). Placeholder is not a label | 1.3.1, 3.3.2, 4.1.2 | S, R | Blocker |
| NAME-04 | `<iframe>`, `<object>`, `<svg role="img">`, `<canvas>` with meaning have a title/name | 4.1.2, 1.1.1 | S | Serious |
| NAME-05 | `aria-label` / `aria-labelledby` only on elements whose role supports naming (not bare `div` / `span`) | 4.1.2 | S | Moderate |
| NAME-06 | Link text makes sense out of context ("Read more", "Click here", "Here" are findings) | 2.4.4 | S | Moderate |
| NAME-07 | Accessible name contains the visible label text (Label in Name) | 2.5.3 | R, M | Serious |
| NAME-08 | Repeated controls are distinguishable ("Delete invoice 1042", not ten "Delete"). Link purpose from the link alone is AAA (2.4.9) | 2.4.6, 2.4.9 (AAA) | M | Moderate |
| NAME-09 | Name does not include the role ("Menu button") and does not change when state changes (switch, toggle) | 4.1.2 | S, M | Minor |
| NAME-10 | Grouped controls (radio, checkbox, address) are in `<fieldset>` + `<legend>` or `role="group"`/`radiogroup` with a name | 1.3.1, 3.3.2 | S | Moderate |
| NAME-11 | Landmarks of the same type (two `nav`) have distinct `aria-label`s | 2.4.6 | S, R | Minor |

## Roles, states and relationships (ROLE)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| ROLE-01 | No click handler on non-interactive elements (`div`, `span`, `li`, `img`) without a role, focusability and key handling. Prefer native | 2.1.1, 4.1.2 | S | Blocker |
| ROLE-02 | Native element preferred over `role="button|link|checkbox|textbox|heading|list|img…"` on a generic element | 4.1.2 | S | Moderate |
| ROLE-03 | Elements with `role="button"` etc. respond to Enter and Space, have `tabindex="0"` and show focus | 2.1.1 | S, R | Blocker |
| ROLE-04 | No redundant roles (`<button role="button">`, `<nav role="navigation">`, `<ul role="list">` except where list semantics are stripped by CSS) | 4.1.2 | S | Minor |
| ROLE-05 | `aria-hidden="true"` and `inert`/`hidden` never on focusable elements or their ancestors while visible. Focusable children of `aria-hidden` content are a failure | 4.1.2, 1.3.1 | S, R | Serious |
| ROLE-06 | Every `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant`, `aria-errormessage` id resolves to an existing element in the DOM when relevant | 4.1.2 | S, R | Serious |
| ROLE-07 | `<a>` has a real `href`. `href="#"`, `javascript:` or no `href` used as a button is a failure; SPA links render real anchors | 2.1.1, 4.1.2 | S | Serious |
| ROLE-08 | Valid role and attribute combinations; required attributes present (`checkbox` + `aria-checked`, `slider` + `aria-valuenow/min/max`, `combobox` + `aria-expanded` + `aria-controls`, `tab` + `aria-selected`, `progressbar` + value or indeterminate) | 4.1.2 | S, R | Serious |
| ROLE-09 | `aria-disabled` used when an item must remain focusable; native `disabled` otherwise. `aria-disabled` elements actually block the action | 4.1.2 | S, R | Moderate |
| ROLE-10 | `aria-haspopup` matches the popup role (`menu`, `listbox`, `dialog`, `tree`, `grid`) and is absent for plain disclosures | 4.1.2 | S, R | Moderate |
| ROLE-11 | `aria-orientation` set when a slider, tablist, toolbar, menu, separator or listbox is vertical (the default differs per role) | 4.1.2 | S | Moderate |
| ROLE-12 | `aria-multiselectable="true"` on multi-select listbox / grid / tree; `aria-readonly` and `aria-required` on custom controls that are read-only or required | 4.1.2, 3.3.2 | S | Moderate |
| ROLE-13 | Decorative elements use `role="presentation"`/`none` or `aria-hidden`; never on focusable elements | 1.3.1 | S | Minor |
| ROLE-14 | Duplicate `id` values do not exist where an ARIA reference or `for` points at them | 4.1.2 | R | Serious |
| ROLE-15 | `aria-roledescription` is used sparingly, is localised, and never replaces or contradicts the real role. A search field uses `type="search"` or `role="searchbox"`; a labelled region uses `role="region"` with a name | 4.1.2 | S, R | Minor |
| ROLE-16 | Required owned elements stay valid: an element that places a portalled popup in reading order (`aria-owns` owner) has no role at root level and `role="group"` when it lives inside a menu or menubar; a separator inside a listbox popup is presentational; a listbox owns only options and groups, a menubar only menu items | 4.1.2 | S, R | Minor |

## State exposure (STATE)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| STATE-01 | Disclosure and popup triggers expose `aria-expanded` and it flips on open/close | 4.1.2 | S, R | Serious |
| STATE-02 | Selected tab/option/row exposes `aria-selected` (or `aria-checked` for menuitemradio / checkbox / radio, with `mixed` for indeterminate) and it flips | 4.1.2 | S, R | Serious |
| STATE-03 | Toggle buttons expose `aria-pressed`; switches use `role="switch"` + `aria-checked` or native checkbox | 4.1.2 | S, R | Serious |
| STATE-04 | Current page / step uses `aria-current` (location is AAA, 2.4.8; the programmatic state is best practice) | 4.1.2, 2.4.8 (AAA) | S | Minor |
| STATE-05 | Invalid fields have `aria-invalid="true"` plus message linked via `aria-describedby` or `aria-errormessage`; cleared when fixed | 3.3.1, 4.1.2 | S, R | Serious |
| STATE-06 | Loading regions use `aria-busy` and a status message; busy state removed afterwards | 4.1.3 | S, R | Moderate |
| STATE-07 | Range-like controls have `aria-valuetext` when the number alone is not meaningful ("3 hours", "indeterminate progress") | 4.1.2 | S | Moderate |
| STATE-08 | Collapsed or closed content is not exposed (`hidden`, `inert`, `display:none`), not merely moved off screen or set to `opacity:0` | 1.3.1, 4.1.2 | S, R | Serious |
| STATE-09 | Live regions: `aria-atomic="true"` when the whole message must be read as one; `aria-relevant` only when the default (additions and text) is wrong; one polite region per message stream, not one per message | 4.1.3 | S, R | Moderate |

## Keyboard (KEY)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| KEY-01 | No positive `tabindex`; DOM order equals visual and logical order | 2.4.3, 1.3.2 | S, R | Serious |
| KEY-02 | Every action available by pointer is available by keyboard (no hover-only, drag-only, right-click-only, double-click-only, mouse-down-only) | 2.1.1 | S, R, M | Blocker |
| KEY-03 | No keyboard trap; any trapped context (modal) offers a documented key to leave (Escape) | 2.1.2 | R | Blocker |
| KEY-04 | Single-character shortcuts can be turned off, remapped, or only fire when the component has focus | 2.1.4 | S | Serious |
| KEY-05 | Composite widgets have exactly one tab stop (roving `tabindex` or `aria-activedescendant`); arrow keys move inside; Tab leaves | 2.1.1, 2.4.3 | R | Serious |
| KEY-06 | Escape closes the topmost layer only (not all nested layers) and does nothing while an IME composition is active (`isComposing`, `keyCode 229`) | 2.1.1 | S, R | Serious |
| KEY-07 | Home/End jump to first/last, type-ahead jumps by character in menus, selects and listboxes; PageUp/PageDown in sliders only (a number field does not handle them; its large step is Shift+Arrow and Shift on the stepper buttons) | 2.1.1 | S, R | Moderate |
| KEY-08 | Arrow-key directions follow orientation and writing direction (RTL swaps left/right) | 2.1.1 | S, R | Moderate |
| KEY-09 | Enter activates links and buttons; Space activates buttons, checkboxes and switches; neither scrolls the page when used on a control | 2.1.1 | R | Serious |
| KEY-10 | `autoFocus` / `autofocus` only on the single purpose of a screen or inside a just-opened layer | 3.2.1 | S | Minor |
| KEY-11 | Disabled items that need explaining remain focusable and discoverable | 4.1.2 | S, R | Minor |
| KEY-12 | Content on hover or focus (tooltip, popover, preview) is dismissible (Escape), hoverable (pointer can enter it) and persistent | 1.4.13 | S, R | Serious |
| KEY-13 | Focus handlers do not change context on focus alone; input does not change context on change without warning | 3.2.1, 3.2.2 | S, M | Serious |

## Focus (FOCUS)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| FOCUS-01 | A visible focus indicator on every focusable element. `outline: none/0` always has a replacement, including in Windows high contrast (`forced-colors`, outline not box-shadow) | 2.4.7 | S, R | Blocker |
| FOCUS-02 | Focused element is not entirely hidden by sticky headers, footers, banners, chat widgets or cookie bars. Use `scroll-padding` | 2.4.11 | R | Serious |
| FOCUS-03 | Focus indicator has 3:1 contrast against adjacent colours and is at least 2 CSS px (AAA: 2.4.13) | 1.4.11 | R, M | Moderate |
| FOCUS-04 | Focus moves into a layer on open and returns to the trigger on close (or to a sensible neighbour if the trigger is gone). Initial and final targets are configurable where defaults are wrong | 2.4.3 | S, R | Serious |
| FOCUS-05 | Focus is never lost to `<body>` after removing, replacing or filtering the focused element | 2.4.3 | R | Serious |
| FOCUS-06 | Client-side route changes move focus to the new heading or main region and update `document.title` | 2.4.3, 2.4.2, 4.1.3 | R | Serious |
| FOCUS-07 | Modal layers make the rest of the page inert and contain focus. Non-modal popups do not trap | 2.4.3, 1.3.2 | R | Serious |
| FOCUS-08 | Focus order within a widget matches the visual order after dynamic insertion | 2.4.3 | R | Moderate |
| FOCUS-09 | Elements that must be skipped by Tab are removed with `display:none`, `hidden`, `inert` or `disabled`, not just moved off screen or `aria-hidden`; closed `<details>` content is not tabbable (see TABB-* in `widget-contracts.md`) | 2.4.3, 4.1.2 | S, R | Moderate |

## Structure and navigation (STRUCT)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| STRUCT-01 | `<html lang>` is set and valid; foreign passages carry `lang` | 3.1.1, 3.1.2 | S, R | Moderate |
| STRUCT-02 | One `<h1>`; heading levels do not skip; headings describe content; headings are not used just for style. A toast title is rendered as a heading and its description as a paragraph, so toasts add headings to the outline: check their level and count against the page structure | 1.3.1, 2.4.6 | S, R | Moderate |
| STRUCT-03 | Each page has a unique, descriptive `<title>` that updates on route change | 2.4.2 | S, R | Moderate |
| STRUCT-04 | Landmarks present: `main`, `nav`, `header`, `footer`; content is inside a landmark | 1.3.1, 2.4.1 | S, R | Moderate |
| STRUCT-05 | A skip link to main content is the first focusable element (or landmarks suffice) | 2.4.1 | S, R | Moderate |
| STRUCT-06 | Lists, tables and definition lists use proper elements; data tables have `<caption>` or name, `<th scope>`; no layout tables | 1.3.1 | S | Moderate |
| STRUCT-07 | Multiple ways to reach pages (nav, search, sitemap) in multi-page sites | 2.4.5 | M | Minor |
| STRUCT-08 | Navigation, help links and repeated components appear in the same order across pages | 3.2.3, 3.2.4, 3.2.6 | M | Moderate |
| STRUCT-09 | Link purpose is clear from text or context (AA). External/new-window links say so (best practice; 3.2.5 Change on Request is AAA) | 2.4.4, 3.2.5 (AAA) | S | Minor |
| STRUCT-10 | Content reflows without information loss in a landmark-based reading order | 1.3.2 | R | Moderate |
| STRUCT-11 | Scrollable regions are keyboard-reachable (focusable, named) | 2.1.1 | R | Serious |

## Forms and input (FORM)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| FORM-01 | Required and format instructions are visible and linked (`aria-describedby`), not only in the placeholder | 3.3.2, 1.3.1 | S | Serious |
| FORM-02 | Inputs use correct `type`, `inputmode` and `autocomplete` tokens for personal data | 1.3.5 | S | Serious |
| FORM-03 | Errors are in text, identify the field and say how to fix it; colour is not the only cue | 3.3.1, 3.3.3, 1.4.1 | S, R | Serious |
| FORM-04 | On failed submit, focus goes to the first invalid field or an error summary; error count announced | 3.3.1, 4.1.3 | R | Serious |
| FORM-05 | Legal, financial or data-deleting submissions are reversible, checked or confirmed | 3.3.4 | M | Serious |
| FORM-06 | Previously entered info is not asked again in the same flow, or is auto-populated / selectable | 3.3.7 | M | Moderate |
| FORM-07 | Login and verification do not require a cognitive test (memorising, transcribing, puzzle) unless an alternative exists; paste and password managers are not blocked | 3.3.8 | S, M | Serious |
| FORM-08 | Submit button is not disabled to hide missing fields; if disabled, the reason is exposed | 3.3.1, 4.1.2 | S | Moderate |
| FORM-09 | Validation does not fire on every keystroke, does not clear user input, does not time out without warning | 3.3.1, 2.2.1 | S, R | Moderate |
| FORM-10 | Custom selects, comboboxes, date pickers, number and OTP fields satisfy their contract (see `widget-contracts.md`) | 4.1.2 | S, R | Serious |

## Visual (VIS)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| VIS-01 | Viewport meta does not disable zoom (`user-scalable=no`, `maximum-scale` below 2) | 1.4.4 | S, R | Serious |
| VIS-02 | Text contrast at least 4.5:1 (3:1 for 24px or 18.66px bold). Check hover, focus, selected, disabled-but-readable, placeholder, dark theme, text on images and gradients | 1.4.3 | R, M | Serious |
| VIS-03 | Non-text contrast at least 3:1 for input borders, icons that carry meaning, focus rings, chart marks, state indicators | 1.4.11 | R, M | Serious |
| VIS-04 | Colour is not the only means of conveying state, error, status, link-in-text or chart series | 1.4.1 | S, M | Serious |
| VIS-05 | Text scales to 200% with no loss; no fixed pixel heights on text containers; text uses relative units | 1.4.4 | S, R | Serious |
| VIS-06 | Reflow at 320 CSS px width (400% zoom) without two-dimensional scroll, except data tables, maps, code, images | 1.4.10 | R | Serious |
| VIS-07 | Text spacing overrides (line-height 1.5, paragraph 2em, letter 0.12em, word 0.16em) do not clip or overlap | 1.4.12 | R | Moderate |
| VIS-08 | No images of text unless essential (logos) | 1.4.5 | S, M | Minor |
| VIS-09 | Orientation is not locked unless essential | 1.3.4 | S | Moderate |
| VIS-10 | Styling respects forced colors (`@media (forced-colors: active)`): borders on controls, system colours, no background-only state | 1.4.11 | S, R | Moderate |
| VIS-11 | Sensory-only instructions avoided ("the red button", "on the right") | 1.3.3 | M | Minor |

## Motion and time (MOTION)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| MOTION-01 | Non-trivial motion (translate, scale, parallax, auto-scroll, spin, large fade) is gated by `prefers-reduced-motion`; opacity and colour feedback remain. Animation from interactions is AAA (2.3.3) but treated as a default check because of vestibular harm | 2.3.3 (AAA) | S, R | Moderate |
| MOTION-02 | Auto-playing, moving, blinking or auto-updating content lasting over 5 s can be paused, stopped or hidden (carousels, tickers, videos, loaders) | 2.2.2 | S, R | Serious |
| MOTION-03 | No content flashes more than three times per second | 2.3.1 | M | Blocker |
| MOTION-04 | Time limits (sessions, toasts with actions, OTP) can be turned off, adjusted or extended, with a warning | 2.2.1 | S, M | Serious |
| MOTION-05 | Functions triggered by device motion also have a UI control and can be disabled | 2.5.4 | S | Moderate |
| MOTION-06 | Animations do not delay access: closing layers release focus and scroll lock immediately | 2.4.3 | R | Minor |
| MOTION-07 | Toasts and transient messages pause on hover and focus, and remain reachable | 2.2.1, 4.1.3 | S, R | Moderate |

## Pointer and touch (PTR)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| PTR-01 | Multi-point or path-based gestures (pinch, swipe, drag path) have a single-pointer alternative | 2.5.1 | S, M | Serious |
| PTR-02 | Actions fire on pointer up / click, not on down, or can be aborted. Non-destructive, reversible selection (automatic tab activation) may fire on pointer down; a secondary-button press never activates, also not through the focus it causes | 2.5.2 | S | Moderate |
| PTR-03 | Dragging has a non-drag alternative (buttons, menus, number input) | 2.5.7 | S, M | Serious |
| PTR-04 | Targets are at least 24×24 CSS px, or have enough spacing, or are inline text, or have an equivalent target (aim for 44×44) | 2.5.8 | R | Moderate |
| PTR-05 | Pointer-only interactions (hover reveal, long press, right click) have keyboard and touch equivalents | 2.1.1, 2.5.1 | S, R | Serious |
| PTR-06 | Hover-only content has a focus equivalent | 1.4.13 | S | Serious |

## Media, status and live updates (MEDIA)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| MEDIA-01 | Prerecorded video with audio has synchronised captions (`<track kind="captions">`, or burned in) | 1.2.2 | S, M | Serious |
| MEDIA-02 | No auto-playing audio over 3 s without a way to pause or mute | 1.4.2 | S | Serious |
| MEDIA-03 | Media controls are keyboard operable and named | 2.1.1, 4.1.2 | R | Serious |
| MEDIA-04 | Status messages (saved, results updated, errors, cart count) are exposed via `role="status"` / `role="alert"` / `aria-live` without moving focus, and the region exists in the DOM before the message appears | 4.1.3 | S, R | Serious |
| MEDIA-05 | Charts have a text alternative or data table and do not rely on colour alone | 1.1.1, 1.4.1 | S, M | Serious |
| MEDIA-06 | Audio-only and video-only (silent) prerecorded media have a transcript or text/audio alternative | 1.2.1 | M | Serious |
| MEDIA-08 | Prerecorded video has audio description or a full text alternative (A), and audio description for the video track (AA) | 1.2.3, 1.2.5 | S, M | Serious |
| MEDIA-09 | Live audio with synchronised media (webinars, streams) has live captions | 1.2.4 | M | Serious |
| MEDIA-07 | Notifications and live regions are not noisy: no announcing every keystroke, tick or animation frame | 4.1.3 | M | Minor |

## Authentication, help and context (CTX)

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| CTX-01 | Help mechanisms (contact, chat, FAQ) appear in the same relative place across pages | 3.2.6 | M | Moderate |
| CTX-02 | Consistent identification: same function, same name and icon | 3.2.4 | M | Minor |
| CTX-03 | Error prevention for account, payment or legal changes | 3.3.4 | M | Serious |
| CTX-04 | CAPTCHA has a non-cognitive alternative | 3.3.8 | M | Serious |

## Level AAA

Checked only with `--level AAA`. Under the default level, report these as best practice (Minor) and say they were not required. Where a row overlaps an AA row it states the stricter threshold.

| ID | Check | SC | Detect | Sev |
| --- | --- | --- | --- | --- |
| AAA-01 | Prerecorded video with audio has a sign-language interpretation | 1.2.6 | M | Minor |
| AAA-02 | Where pauses in the soundtrack are too short for audio description, extended audio description is provided | 1.2.7 | M | Minor |
| AAA-03 | Prerecorded synchronized media and video-only have a full text alternative (a script that includes what is said and what is seen) | 1.2.8 | S, M | Minor |
| AAA-04 | Live audio-only content has a text alternative (live transcript) | 1.2.9 | M | Minor |
| AAA-05 | The purpose of inputs, icons, regions and other UI components can be programmatically determined (landmarks, `autocomplete` for all collected personal data, semantic markup for icons and regions) | 1.3.6 | S, R | Minor |
| AAA-06 | Text contrast is at least 7:1 (4.5:1 for large text) in every state and theme | 1.4.6 | R | Minor |
| AAA-07 | Audio-only speech has no background audio, or it can be turned off, or it is at least 20 dB quieter | 1.4.7 | M | Minor |
| AAA-08 | Blocks of text: user can pick foreground and background colours, lines are at most 80 characters wide (40 CJK), text is not justified, line spacing is at least 1.5 within paragraphs and paragraph spacing at least 1.5 times that, and text resizes to 200% without horizontal scrolling. Flag `text-align: justify`, missing `max-width` on prose and a `line-height` under 1.5 | 1.4.8 | S, R | Minor |
| AAA-09 | Images of text are used only for decoration or where the presentation is essential (logos); no exception for convenience | 1.4.9 | S, M | Minor |
| AAA-10 | Every function is operable by keyboard with no exception for path-dependent input (freehand drawing, drag along a path) | 2.1.3 | R, M | Minor |
| AAA-11 | There is no timing at all, except for non-interactive synchronized media and real-time events | 2.2.3 | S, M | Minor |
| AAA-12 | Non-emergency interruptions (auto-updating notices, pop-ups, banners) can be postponed or suppressed by the user | 2.2.4 | S, M | Minor |
| AAA-13 | When an authenticated session expires, the user can continue after re-authenticating without losing data | 2.2.5 | R, M | Minor |
| AAA-14 | Users are warned of the duration of inactivity that causes data loss, unless data is preserved for more than 20 hours | 2.2.6 | S, M | Minor |
| AAA-15 | No content flashes at all (stricter than 2.3.1, which allows up to three flashes per second) | 2.3.2 | M | Minor |
| AAA-16 | Content sections are organised with headings (long pages, article sections, form groups) | 2.4.10 | S, R | Minor |
| AAA-17 | No part of the focused element is hidden by author-created content, such as sticky headers, banners and chat widgets (stricter than 2.4.11, which only requires it not to be entirely hidden) | 2.4.12 | R | Minor |
| AAA-18 | The focus indicator encloses the control or is at least a 2 CSS px perimeter, has a 3:1 contrast between focused and unfocused state, and is not hidden by author content | 2.4.13 | R | Minor |
| AAA-19 | Pointer targets are at least 44×44 CSS px (except inline text, user-agent controls, or where the size is essential) | 2.5.5 | R | Minor |
| AAA-20 | Input is not restricted to one modality: do not attach only touch handlers or only mouse handlers, and do not disable the other (`touchstart` without `mousedown`/`click`, mouse-only widgets on touch devices) | 2.5.6 | S, M | Minor |
| AAA-21 | Unusual words, idioms, jargon and abbreviations are explained by a mechanism (glossary, inline definition) | 3.1.3 | M | Minor |
| AAA-22 | The expansion of each abbreviation is available (`<abbr title>` on first use, a glossary or inline expansion) | 3.1.4 | S, M | Minor |
| AAA-23 | Text beyond lower secondary education level has a simpler summary or version | 3.1.5 | M | Minor |
| AAA-24 | Where meaning depends on pronunciation of an ambiguous word, a pronunciation is provided | 3.1.6 | M | Minor |
| AAA-25 | Context-sensitive help is available where input errors are likely (help links beside fields, hints linked with `aria-describedby`) | 3.3.5 | S, M | Minor |
| AAA-26 | For every form submission, submissions are reversible, checked, or confirmed (stricter than 3.3.4, which applies only to legal, financial and data changes) | 3.3.6 | M | Minor |
| AAA-27 | Authentication has no cognitive function test at all, including recognising objects or user-provided images; paste and password managers are allowed | 3.3.9 | S, M | Minor |

## Widget behaviour

Widget rules (LAYER, DLG, POP, TIP, MENU, LIST, TABB, BTN, SEL, CMB, TAB, ACC, CTRL, RNG, TOAST, TLB, NAV, FLD, FORM-C, MISC, DEV) live in `widget-contracts.md` (Core) and `widget-contracts-deep.md` (Deep) and map to SC 2.1.1, 2.4.3, 3.2.1, 4.1.2 and 4.1.3.

## Platform-native checks (NATIVE)

See `native-apps.md`. IDs: NATIVE-01 label on every control, NATIVE-02 role and traits, NATIVE-03 dynamic type, NATIVE-04 touch target 44pt / 48dp, NATIVE-05 reduced motion, NATIVE-06 focus order and grouping, NATIVE-07 live announcements, NATIVE-08 custom actions for swipe-only gestures.
