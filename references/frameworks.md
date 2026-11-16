# Frameworks and plain web

The skill validates the same rules everywhere. The **rendered DOM is the ground truth**: ARIA, focus and keyboard behaviour are properties of the page the browser builds, not of the framework that built it. The static scan only reads source, so it needs to understand each framework's syntax. When it cannot, fall back to the runtime pass.

## Decision

| Situation | Do |
| --- | --- |
| A URL or dev server is available | Run the runtime pass first. It works for any stack, including ones this file does not list |
| Source only, stack is listed below | Run `scripts/scan.mts`, then read the flagged files using the syntax notes below |
| Source only, unknown framework or template language | Read the templates by hand with the rule catalogue, grep for the patterns in the "What to grep" column, and say in **Not verified** that the static scan did not cover this syntax |
| Server-rendered templates (Blade, Razor, Twig, Django, ERB...) | Static scan for the markup, but ids, labels and `aria-*` values built at runtime need the runtime pass |

## Syntax map

What the scanner understands, and what to look for when reading by hand.

| Stack | Event handlers | Dynamic attributes | Templates / files | What to grep |
| --- | --- | --- | --- | --- |
| Plain HTML | `onclick="…"` | none | `.html` | `<div onclick`, `<a>` without `href`, `<img>` without `alt`, `<input>` without label |
| Vanilla JS/TS (DOM scripting) | `addEventListener('click', …)`, `el.onclick =` | `setAttribute('aria-…', …)`, `el.ariaLabel`, `el.role` | `.js .mjs .ts`, template strings with HTML | `createElement('div')` + click listener, `setAttribute('tabindex', …)`, `style.outline`, `innerHTML` templates |
| React, Preact, Solid, Qwik | `onClick`, `onClick$` | `aria-label={x}`, spread `{...props}` | `.jsx .tsx` | `<div onClick`, `role=` without `tabIndex` + `onKeyDown`, `aria-*` ids not in file |
| Next.js, Remix, Gatsby | as React | as React | `.tsx`, `layout.tsx` (`<html lang>`), `metadata.viewport` | `userScalable: false`, `<Image>` without `alt`, `<Link>` without text |
| Vue / Nuxt | `@click`, `v-on:click` | `:aria-label="x"`, `v-bind="obj"` | `.vue` (template, style) | `<div @click`, `:aria-hidden`, `v-if` toggled live regions, `<NuxtLink>` |
| Svelte / SvelteKit | `on:click`, `onclick` (Svelte 5) | `aria-label={x}`, shorthand `{alt}`, `{...props}` | `.svelte` | `<div on:click`, `a11y-*` compiler warnings (read them, they are findings) |
| Angular | `(click)="…"` | `[attr.aria-label]="x"`, `[alt]="x"`, `[routerLink]` | `.component.html`, inline `template:` in `.ts` | `<div (click)`, `<a (click)` without `routerLink`, `mat-icon` only buttons, `*ngIf` on live regions |
| Astro | `onclick`, island framework syntax | `aria-label={x}` | `.astro` | `<html lang>` in layouts, islands that hydrate with `client:only` |
| Lit / web components | `@click`, `addEventListener` | `.ariaLabel=${x}`, `?hidden=${x}` | template literals in `.ts` | `customElements.define` + click without `role`/`ElementInternals`, `slot`-based labels, shadow DOM id references |
| Alpine.js | `x-on:click`, `@click` | `:aria-expanded="open"`, `x-bind` | HTML | `<div @click`, missing `:aria-expanded`, `x-show` without `aria-hidden` handling |
| htmx | `hx-get`, `hx-post`, `hx-trigger` | `hx-swap` into regions | HTML, server templates | `<div hx-get`, swapped content without `aria-live`, focus after swap |
| Stimulus / Turbo / Livewire / Phoenix LiveView | `data-action="click->x#y"`, `wire:click`, `phx-click` | server-driven | HTML, Blade, HEEx | `<div data-action`, `<div wire:click`, focus lost after DOM patch |
| Server templates | `onclick`, framework attributes | `{{ }}`, `@`, `{% %}`, `<?= ?>` | `.blade.php .cshtml .twig .njk .liquid .jinja .erb .ejs .hbs` | same HTML checks, plus `lang`, `<title>` per layout |
| Markdown / MDX | JSX in MDX | n/a | `.mdx` | code fences are ignored by the scanner; only real JSX is checked |
| Component libraries (MUI, Angular Material, Vuetify, Quasar, shadcn/Radix, Bootstrap) | their own | their own | their own | Check the app's *usage*: icon-only buttons need `aria-label`, custom `render`/`as` replacing the element must keep semantics, `data-bs-toggle` on non-buttons |
| React Native / Expo | `onPress` | `accessibilityLabel`, `role` | `.tsx` | see `native-apps.md` |
| SwiftUI, UIKit, Android | native | native | `.swift .kt` and XML layouts | see `native-apps.md` |

## Vanilla JS and DOM scripting

Plain JS is where most of the contract has to be implemented by hand, so the contracts in `widget-contracts.md` apply line by line. Check, for each imperative widget:

- Is it built from a native element (`document.createElement('button')`), or from a `div` that then needs role, `tabindex`, key handling and states?
- Are states written to the DOM at the moment they change (`setAttribute('aria-expanded', String(open))`)? A boolean in a JS variable is not state for assistive technology.
- Does opening move focus, does closing return it, does Escape work, is the rest of the page `inert`?
- Are dynamic messages written into a live region that existed before the text changed?
- Do listeners run for keyboard as well as pointer (`click` fires for Enter and Space on native buttons; `mousedown`, `pointerdown` and `mouseover` do not)?
- Are listeners removed when the widget is destroyed, and is focus handled when its element is removed?

## Single-page apps and hydration

- After a client-side route change focus and the page title must update (FOCUS-06, STRUCT-03). Frameworks do this inconsistently, so verify at runtime in every router.
- Server-rendered HTML can differ from the hydrated DOM: ids generated at runtime (`useId`, `_uid`), attributes added after hydration. Static reading of source cannot confirm `aria-labelledby` targets, so confirm them in the runtime pass.
- Suspense, loading skeletons and optimistic UI need `aria-busy` and a status message (STATE-06).
- Portals move DOM out of the tree that React, Vue or Angular show in source. Check focus order and `aria-owns` in the real DOM.

## Web components and shadow DOM

- `document.querySelectorAll` does not pierce shadow roots. Use the deep query helper in `runtime-checks.md`.
- ARIA id references (`aria-labelledby`, `aria-controls`, `for`) do not cross shadow boundaries. A reference from light DOM into a shadow root, or the other way, is broken (ROLE-06). Use `ElementInternals`, slotted content, or put both ends in the same tree.
- A custom element that behaves like a control needs a role and name (`ElementInternals.role`, `ariaLabel`), focusability (`delegatesFocus` or `tabindex`), and keyboard handling.
- Iframes are separate documents: run the checks inside each one and give it a `title`.
