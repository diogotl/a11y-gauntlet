# a11y-audit

An accessibility **validator** skill for AI coding agents (Claude Code and similar). You run it on a project and the agent audits it against **WCAG 2.2 level A and AA** plus a **widget behaviour contract**: roles, ARIA states, keyboard map, focus management and accessible names for dialogs, menus, selects, comboboxes, tabs, accordions, sliders, switches, toasts and forms.

It is not a linter replacement. Automated tools catch roughly a third of real accessibility problems. This skill adds the part they cannot see: what happens on Tab, on Escape, on open, on close, after a state change. It also says plainly what it could **not** verify.

## What it does

When invoked, the agent:

1. **Detects the stack** and scopes the audit (a path, a URL, a component, or only the files changed in git).
2. **Runs a static scan** (`scripts/scan.mts`, TypeScript, no dependencies) as a first filter, then reads the flagged code. Hits are leads, not verdicts.
3. **Compares widgets against their contracts.** Core rules apply to every widget. Deep rules apply to hand-built widgets, or with `--deep`.
4. **Walks the WCAG 2.2 A/AA catalogue** and marks each rule Fail, Pass, Needs review, or Not verifiable here.
5. **Uses what the project already has**: ESLint a11y plugins, axe tests, Playwright specs, Xcode audits.
6. **Runs a runtime pass** if there is a URL or dev server: accessibility snapshot, browser snippets (unnamed controls, broken ARIA references, tab stops, focus visibility, target size, document basics), a keyboard walk, preference emulation and a Lighthouse cross-check.
7. **Reports** one Before / After / Why table with severity, rule ID and `file:line`, then **Summary**, **Passed** and **Not verified**.

By default it reports only. It does not change your code unless you ask for fixes afterwards.

## Works on

Plain HTML and vanilla JS, and any framework: React, Preact, Solid, Qwik, Next.js, Remix, Vue, Nuxt, Svelte, Angular, Astro, Lit and web components, Alpine, htmx, Stimulus, Livewire, and server templates (Blade, Razor, Twig, Jinja/Django, Liquid, ERB, EJS, Handlebars, Nunjucks). Native apps are covered too: SwiftUI, UIKit, Android (Compose and Views), React Native.

The runtime pass works on any stack because it reads the rendered DOM. For a stack it does not know, the agent falls back to the runtime pass and says what the static scan did not cover (see `references/frameworks.md`).

## Install

With the [skills CLI](https://github.com/vercel-labs/skills), which finds the `SKILL.md` at the root of this repo:

```bash
npx skills add diogotl/a11y-audit
```

Or copy the folder into your agent's skills directory by hand. For Claude Code:

```bash
git clone https://github.com/diogotl/a11y-audit ~/.claude/skills/a11y-audit
```

Then ask for it by name (`/a11y-audit`) or just ask the agent to audit the accessibility of a project, a page or a component.

Flags you can type with the request: `--static`, `--runtime`, `--level A|AA|AAA` (default AA), `--component <name>`, `--changed`, `--deep`.

## Requirements

- The static scan needs **Node 22.18 or newer** (it runs TypeScript directly: `node scripts/scan.mts <path>`). On older Node use `npx tsx scripts/scan.mts <path>`. Without Node the agent reads the sources by hand using the patterns in `references/`.
- The runtime pass needs a browser tool the agent can drive (for example Chrome DevTools). It is optional.

## Layout

| Path | What it holds |
| --- | --- |
| `SKILL.md` | The workflow, report format, severity rules |
| `references/rules.md` | The rule catalogue: WCAG 2.2 A/AA plus implementation checks, each with an ID, how to detect it and a default severity |
| `references/widget-contracts.md` | Core widget contracts (names, roles, states, keys, focus, Escape, focus return, announcements) |
| `references/widget-contracts-deep.md` | Deep widget contracts (timings, hover intent, scroll lock, IME, touch arbitration), for hand-built widgets and `--deep` |
| `references/frameworks.md` | How the checks apply to each stack, SPAs, hydration and shadow DOM |
| `references/runtime-checks.md` | Browser snippets and the keyboard walk |
| `references/native-apps.md` | SwiftUI, Android and React Native checks |
| `scripts/scan.mts` | The static scanner |

## Honest limits

- **Status: not yet validated on real projects.** The scanner was tested on fixtures and on a large open source codebase, and tuned for false positives there. The full flow (static scan, runtime pass, report) has not been through a broad field test, and the browser snippets have been run against one real documentation site (54 pages) but not across stacks. It has been tried on one real project so far.
- **The scanner is heuristic.** It misses components passed through spread props or wrappers, and a clean scan is never a pass.
- **No tool verifies everything.** Contrast over images, real screen reader output (VoiceOver, NVDA, TalkBack), caption quality, alt text quality and cognitive load always end up under *Not verified*.
- **The widget contracts come from reading tests, not from a standard.** They were derived from the behaviour a mature primitives library asserts in its test suite (472 test files read), and checked against WCAG and the WAI-ARIA Authoring Practices. Where more than one implementation is legitimate the contract says so and marks it as a variant or **Review**, not a failure. Treat the contracts as strong guidance and confirm edge cases against current WCAG 2.2, the WAI-ARIA Authoring Practices Guide and MDN.

## Credits

The skill's structure (philosophy, a required Before / After / Why review table, decision-driven workflow) follows the format of Emil Kowalski's [`emil-design-eng`](https://aiforui.dev/skills/emil-design-eng) skill. The content is original to this repo.

## License

No license has been chosen yet, so by default all rights are reserved. Open an issue if you want to use it in a way that needs one.
