#!/usr/bin/env node
/**
 * Static accessibility scanner: a fast first filter, not a verdict.
 *
 * Usage: node scan.mts <path> [--changed] [--json]
 *        (Node >= 22.18 runs .mts directly; on older Node use: npx tsx scan.mts <path>)
 *
 * Framework-agnostic heuristics over HTML, vanilla JS/TS, JSX/TSX (React, Preact, Solid, Qwik),
 * Vue, Svelte, Astro, Angular templates, Lit/web components, Alpine, htmx, Stimulus, server
 * templates (Blade, Razor, Twig, Jinja, Liquid, ERB, EJS, Handlebars, Nunjucks), CSS/SCSS and
 * CSS-in-JS, plus a few native patterns (Swift, Kotlin, Android XML, React Native).
 *
 * Every hit is a lead the auditor must confirm by reading the code. IDs match
 * references/rules.md and references/widget-contracts.md. The exit code is always 0.
 * The rendered DOM (runtime pass) is the ground truth; this scan only reads source.
 *
 * Only erasable TypeScript syntax is used (no enums, namespaces or parameter properties).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

type Finding = { id: string; sev: string; file: string; line: number; msg: string; snippet: string; review: boolean };

const WEB_EXT = new Set([".html", ".htm", ".xhtml", ".jsx", ".tsx", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".vue", ".svelte",
  ".astro", ".mdx", ".php", ".erb", ".ejs", ".hbs", ".handlebars", ".mustache", ".njk", ".twig", ".liquid",
  ".jinja", ".jinja2", ".j2", ".cshtml", ".razor", ".blade", ".tpl", ".marko", ".pug", ".svx"]);
const CSS_EXT = new Set([".css", ".scss", ".sass", ".less", ".pcss", ".styl"]);
const SWIFT_EXT = new Set([".swift"]);
const KOTLIN_EXT = new Set([".kt"]);
const XML_EXT = new Set([".xml"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", ".svelte-kit", "out", "coverage", ".output",
  ".turbo", ".cache", "vendor", "Pods", "DerivedData", ".gradle", ".expo", "storybook-static", "__snapshots__",
  ".angular", ".astro", ".parcel-cache", "bower_components", "target", "obj", "bin"]);
const MAX_BYTES = 1_000_000;

const findings: Finding[] = [];

// Tags with no native interactive role.
const NONINT = new Set(["div", "span", "li", "p", "td", "tr", "th", "section", "article", "img", "ul", "svg", "label", "i", "b", "em",
  "strong", "h1", "h2", "h3", "h4", "h5", "h6", "header", "footer", "aside", "figure", "dd", "dt"]);
const NATIVE_ICON = String.raw`(?:svg|img|i\b|[\w:.-]*icon[\w:.-]*|lucide-[\w-]+|bi-[\w-]+)`;

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countNl = (s: string, end: number) => {
  let n = 0;
  for (let i = 0; i < end; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
};

function add(id: string, sev: string, file: string, text: string, pos: number, msg: string, review = true): void {
  while (pos < text.length - 1 && isSpace(text[pos])) pos++;
  const line = countNl(text, pos) + 1;
  const snippet = text.slice(pos, pos + 140).split("\n")[0].trim();
  findings.push({ id, sev, file, line, msg, snippet, review });
}

function* filesUnder(root: string, changed: boolean): Generator<string> {
  if (changed) {
    try {
      const cwd = fs.statSync(root).isDirectory() ? root : path.dirname(root) || ".";
      const out = execFileSync("git", ["-C", cwd, "status", "--porcelain"], { encoding: "utf8", timeout: 20000 });
      const base = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", timeout: 20000 }).trim();
      for (const ln of out.split("\n")) {
        if (!ln) continue;
        const rel = ln.slice(3).split(" -> ").pop()!.trim().replace(/^"|"$/g, "");
        const p = path.join(base, rel);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) yield p;
      }
      return;
    } catch {
      /* fall through to a full walk */
    }
  }
  if (fs.statSync(root).isFile()) {
    yield root;
    return;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) stack.push(path.join(dir, e.name));
      } else if (e.isFile()) {
        yield path.join(dir, e.name);
      }
    }
  }
}

// ---------------------------------------------------------------- attributes
const BRACE = String.raw`\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}`;

type Tag = { index: number; end: number; tag: string; attrs: string };

/**
 * Linear tag tokenizer (no regex backtracking, safe on large files). Finds `<name attrs>` and honours quotes and
 * {braces} inside attributes. A `<` met at depth 0 (generics, comparisons) means "not a tag" and is skipped.
 */
function* tags(text: string): Generator<Tag> {
  const n = text.length;
  let i = text.indexOf("<");
  while (i !== -1) {
    const c = text.charCodeAt(i + 1);
    const letter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    let next = i + 1;
    if (letter) {
      let j = i + 1;
      while (j < n && /[\w.:-]/.test(text[j])) j++;
      const limit = Math.min(n, j + 4000);
      let k = j;
      let depth = 0;
      let quote = "";
      let end = -1;
      while (k < limit) {
        const ch = text[k];
        if (quote) {
          if (ch === "\\") k++;
          else if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'" || (depth > 0 && ch === "`")) {
          quote = ch;
        } else if (ch === "{") depth++;
        else if (ch === "}") depth = Math.max(0, depth - 1);
        else if (depth === 0) {
          if (ch === ">") {
            end = k;
            break;
          }
          if (ch === "<") break;
        }
        k++;
      }
      if (end !== -1) {
        let attrs = text.slice(j, end);
        if (attrs.endsWith("/")) attrs = attrs.slice(0, -1);
        yield { index: i, end: end + 1, tag: text.slice(i + 1, j), attrs };
        next = end + 1;
      }
    }
    i = text.indexOf("<", next);
  }
}
// Bound/dynamic prefixes: Vue (: v-bind:), Svelte (bind:), Angular ([x] [attr.x]), Lit (. ?), Alpine (x-bind:).
const BIND_PREFIX = String.raw`(?:v-bind:|x-bind:|bind:|:|\[attr\.|\[|\.|\?)?`;
const VALUE = String.raw`("[^"]*"|'[^']*'|${BRACE}|\$\{[^{}]*\}|[^\s"'<>=\`]+)`;

/** Value (stripped) if the attribute exists in any binding form, true if valueless, else null. */
const cache = new Map<string, RegExp>();
const rx = (key: string, build: () => RegExp): RegExp => {
  let r = cache.get(key);
  if (!r) cache.set(key, (r = build()));
  return r;
};

function attr(attrs: string, name: string): string | true | null {
  const n = esc(name);
  const m = rx(`a:${name}`, () => new RegExp(String.raw`(?:^|\s)${BIND_PREFIX}${n}\]?(?:\.[\w.]+)?(?:\s*=\s*${VALUE})?(?=\s|/|$)`, "i")).exec(attrs);
  if (m) {
    const v = m[1];
    return v === undefined ? true : v.replace(/^["'{ ]+|["'} ]+$/g, "");
  }
  if (rx(`s:${name}`, () => new RegExp(String.raw`\{\s*${n}\s*\}`)).test(attrs)) return true; // Svelte shorthand {alt}
  return null;
}

/** Value only when the attribute is a plain literal (no binding, no expression). */
function literal(attrs: string, name: string): string | null {
  const m = rx(`l:${name}`, () => new RegExp(String.raw`(?:^|\s)${esc(name)}\s*=\s*("[^"]*"|'[^']*')`, "i")).exec(attrs);
  return m ? m[1].slice(1, -1) : null;
}

const has = (attrs: string, ...names: string[]) => names.some((n) => attr(attrs, n) !== null);
const hasSpread = (a: string) =>
  /\{\s*\.\.\.|(?:^|\s)v-bind\s*(?:=|\s|$)|(?:^|\s)x-bind\s*=|\{@attach|\{@html|\$\$props|\$\$restProps/.test(a);

/** on<ev>, on:<ev>, @<ev>, v-on:<ev>, x-on:<ev>, (<ev>), ng-<ev>, onClick$ ... */
function hasEvent(attrs: string, ev: string): boolean {
  return rx(`e:${ev}`, () => new RegExp(
    String.raw`(?:^|\s)(?:on${ev}\$?|on:${ev}|@${ev}|v-on:${ev}|x-on:${ev}|\(${ev}\)|ng-${ev}|data-on-${ev})(?:[.|:\w-]*)(?=\s|=|/|$)`,
    "i",
  )).test(attrs);
}

function hasClickLike(a: string): string | null {
  if (["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup"].some((e) => hasEvent(a, e))) return "click handler";
  if (has(a, "routerLink", "ng-click", "hx-get", "hx-post", "hx-put", "hx-delete", "hx-patch", "up-follow", "wire:click", "phx-click",
    "data-bs-toggle", "data-toggle", "data-bs-target", "data-target", "data-dismiss", "data-bs-dismiss"))
    return "framework click attribute (routerLink / htmx / Livewire / LiveView / Bootstrap data-*)";
  if (/data-action\s*=\s*["'][^"']*(click|->)/i.test(a)) return "Stimulus data-action";
  return null;
}

const hasKeyHandler = (a: string) => ["keydown", "keyup", "keypress"].some((e) => hasEvent(a, e)) || has(a, "wire:keydown", "phx-keydown");
const hasFocusHandler = (a: string) => ["focus", "focusin", "blur"].some((e) => hasEvent(a, e)) || has(a, "wire:focus");

const NAME_ATTRS = ["aria-label", "aria-labelledby", "title", "ariaLabel", "ariaLabelledBy"];
const HREF_ATTRS = ["href", "routerLink", "ng-href", "xlink:href", "to", "hx-get", "hx-boost", "up-follow", "wire:navigate", "data-navigo",
  "data-turbo", "asp-action", "asp-controller", "asp-page", "asp-route", "asp-area", "navigate", "patch", "ui-sref", "sref"];

// ---------------------------------------------------------------- web scan
/** Blank out fenced and inline code in Markdown/MDX (keeps offsets and line numbers). */
function maskMarkdownCode(text: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return text.replace(/^(```|~~~)[\s\S]*?^\1/gm, blank).replace(/`[^`\n]*`/g, blank);
}

/** Blank out comments so documentation text such as `<input>` in JSDoc is not scanned (keeps offsets and lines). */
function maskComments(text: string, file: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let out = text;
  if (/\.(html?|xhtml|vue|svelte|astro|php|erb|ejs|hbs|handlebars|njk|twig|liquid|jinja2?|j2|cshtml|razor|blade|tpl|marko|mdx|svx)$/.test(file)) out = out.replace(/<!--[\s\S]*?-->/g, blank);
  if (/\.(m?[jt]sx?|c[jt]s|vue|svelte|astro|mdx|svx|marko|cshtml|razor)$/.test(file)) {
    out = out.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[ \t])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
  }
  return out;
}

function scanWeb(file: string, text: string): void {
  if (/\.(mdx|svx)$/.test(file)) text = maskMarkdownCode(text);
  text = maskComments(text, file);
  const ids = new Set([...text.matchAll(/\bid\s*=\s*["']([^"'{}$]+)["']/g)].map((m) => m[1]));
  // label targets: for="x", htmlFor="x", htmlFor={expr}, :for="expr", [for]="expr"
  const labelFor = new Set<string>();
  for (const m of text.matchAll(/\b(?:for|htmlFor|\[for\]|:for)\s*=\s*(?:["']([^"']+)["']|\{\s*([^{}]+?)\s*\})/g)) labelFor.add((m[1] ?? m[2]).trim());
  const isHtmlRoot = /<html[\s>]/i.exec(text);

  if (isHtmlRoot) {
    const m = /<html\b([^>]*)>/i.exec(text);
    if (m && !has(m[1], "lang", "xml:lang") && !hasSpread(m[1])) add("STRUCT-01", "Moderate", file, text, m.index, "<html> has no lang attribute");
    if (/\.html?$/.test(file) && !/<title[\s>]/i.test(text)) add("STRUCT-03", "Moderate", file, text, isHtmlRoot.index, "HTML document has no <title>");
  }

  for (const m of text.matchAll(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/gi)) {
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*(1(\.0)?|0?\.\d+)\b/i.test(m[0]))
      add("VIS-01", "Serious", file, text, m.index!, "Viewport disables or limits zoom", false);
  }
  const mm = /userScalable\s*:\s*false|maximumScale\s*:\s*1\b/.exec(text);
  if (mm) add("VIS-01", "Serious", file, text, mm.index, "Viewport config disables zoom", false);

  const hLevels: Array<[number, number]> = [];
  for (const tk of tags(text)) {
    const tag = tk.tag;
    const a = tk.attrs;
    const t = tag.toLowerCase();
    const role = literal(a, "role");
    const roleAny = has(a, "role");
    const spread = hasSpread(a);
    const tiRaw = attr(a, "tabindex");
    const ti: string | null = tiRaw === null ? null : typeof tiRaw === "string" ? tiRaw : "dyn";
    const click = hasClickLike(a);
    const at = tk.index;

    if (["img", "Image", "NextImage", "NuxtImg", "NuxtPicture", "NgOptimizedImage", "Picture", "ion-img", "ImageComponent"].includes(tag) && !has(a, "alt") && !spread)
      add("NAME-01", "Serious", file, text, at, `<${tag}> without alt`);

    if (t === "a") {
      const href = literal(a, "href");
      if (!has(a, ...HREF_ATTRS) && !spread && !has(a, "name", "id") && !has(a, "role")) {
        add("ROLE-07", "Serious", file, text, at, "<a> without href/routerLink (used as button?)");
      } else if (href !== null) {
        const h = href.replace(/ /g, "");
        if (h === "#" || /^javascript:/i.test(h)) {
          add("ROLE-07", "Serious", file, text, at, `<a href="${href}"> used as a button/placeholder`);
        } else if (h.startsWith("#") && h.length > 1 && !["#main", "#content", "#main-content", "#skip"].includes(h) && !ids.has(h.slice(1)) && !/[{$@%]/.test(h)) {
          add("ROLE-07", "Moderate", file, text, at, `<a href="${href}"> points to an id that is not in this file (may live in another file)`);
        }
      }
    }

    if (ti !== null && /^[1-9]\d*$/.test(ti)) add("KEY-01", "Serious", file, text, at, `Positive tabindex (${ti})`, false);

    if (NONINT.has(t) && click && !spread) {
      if (!roleAny) {
        add("ROLE-01", "Blocker", file, text, at, `${click} on non-interactive <${tag}> without role (no keyboard, no semantics)`);
      } else if (role && ["button", "link", "checkbox", "switch", "menuitem", "tab", "option", "radio"].includes(role) && !hasKeyHandler(a)) {
        add("ROLE-03", "Blocker", file, text, at, `role="${role}" on <${tag}> has a ${click} but no key handler`);
      }
      if (roleAny && ti === null) add("ROLE-03", "Blocker", file, text, at, `role="${role ?? "…"}" on <${tag}> without tabindex (not focusable)`);
    }

    if (role && ["div", "span", "li", "p", "section", "img", "ul", "table"].includes(t) &&
      ["button", "link", "checkbox", "textbox", "heading", "img", "list", "listitem", "navigation", "main", "banner", "contentinfo", "search", "article"].includes(role))
    {
      // role="img" with a name on a div is the standard way to name composed graphics (avatars, charts); list/listitem on
      // div/span is legitimate when markup is constrained. Only the rest is "a native element exists".
      const namedImg = role === "img" && has(a, "aria-label", "aria-labelledby");
      if (!namedImg) add("ROLE-02", role === "list" || role === "listitem" ? "Minor" : "Moderate", file, text, at, `<${tag} role="${role}"> — a native element exists`);
    }

    const redundant = new Set(["button|button", "a|link", "nav|navigation", "main|main", "header|banner", "footer|contentinfo", "img|img", "li|listitem",
      "input|textbox", "select|listbox", "aside|complementary", "form|form", "table|table", "article|article"]);
    if (role && redundant.has(`${t}|${role}`)) add("ROLE-04", "Minor", file, text, at, `Redundant role="${role}" on <${tag}>`, false);

    if (literal(a, "aria-hidden") === "true" &&
      (["button", "a", "input", "select", "textarea", "summary"].includes(t) || (ti !== null && /^\d+$/.test(ti) && ti !== "0" && ti !== "-1") || ti === "0"))
      add("ROLE-05", "Serious", file, text, at, `aria-hidden="true" on focusable <${tag}>`, false);

    for (const ref of ["aria-labelledby", "aria-describedby", "aria-controls", "aria-owns", "aria-errormessage", "aria-activedescendant"]) {
      const v = literal(a, ref);
      if (v && !/[{$@%]|<\?/.test(v)) {
        for (const rid of v.split(/\s+/).filter(Boolean)) {
          if (!ids.has(rid)) add("ROLE-06", "Serious", file, text, at, `${ref}="${rid}" — no element with that id in this file (may be defined elsewhere)`);
        }
      }
    }

    // Bootstrap modals, offcanvas and toasts get role="dialog"/"status" from their JS when shown: confirm at runtime.
    const jsRole = /(^|\s)(modal|offcanvas|toast|popover|tooltip)(\s|$)/.test(literal(a, "class") ?? "");
    if (has(a, "aria-label", "aria-labelledby") && ["div", "span", "p", "b", "i", "em", "strong"].includes(t) && !roleAny && !spread && !jsRole)
      add("NAME-05", "Moderate", file, text, at, `aria-label on role-less <${tag}> (name is ignored by most screen readers)`);

    if (t === "input" || t === "textarea" || t === "select") {
      const typ = literal(a, "type") || "text";
      if ((t !== "input" || !["hidden", "submit", "button", "reset", "image"].includes(typ)) && !spread) {
        const named = has(a, ...NAME_ATTRS, "formControlName", "matInput");
        const idv = attr(a, "id");
        const iid = typeof idv === "string" ? idv : null;
        const labelled = !!iid && labelFor.has(iid);
        const pre = text.slice(Math.max(0, at - 400), at);
        const enclosed = /<label\b[^>]*>(?:(?!<\/label>).)*$/is.test(pre);
        const wrapper = /<(mat-form-field|mat-label|ion-item|ion-label|v-text-field|el-form-item|q-input|b-form-group|FormField|Field|TextField|FormControl|Field\.\w+|Fieldset\.\w+|FormGroup|InputGroup)\b/.test(pre.slice(-300));
        if (!(named || labelled || enclosed || wrapper)) {
          if (has(a, "placeholder") && !iid) add("NAME-03", "Blocker", file, text, at, `<${t}> labelled by placeholder only`);
          else if (!iid) add("NAME-03", "Blocker", file, text, at, `<${t}> without label, aria-label or id (check wrapping <label>)`);
        }
      }
      if (has(a, "autofocus", "autoFocus")) add("KEY-10", "Minor", file, text, at, "autofocus (acceptable only for the single purpose of a screen)");
    } else if (has(a, "autofocus", "autoFocus")) {
      add("KEY-10", "Minor", file, text, at, "autofocus (acceptable only for the single purpose of a screen)");
    }

    if (t === "iframe" && !has(a, "title", "aria-label", "aria-labelledby") && !spread) add("NAME-04", "Serious", file, text, at, "<iframe> without title");

    if ((t === "video" || t === "audio") && has(a, "autoplay", "autoPlay") && !has(a, "muted"))
      add("MEDIA-02", "Serious", file, text, at, `<${t}> autoplays with sound (needs muted or controls)`);
    if (t === "marquee" || t === "blink") add("MOTION-02", "Serious", file, text, at, `<${t}> is deprecated and cannot be paused`, false);

    if (NONINT.has(t) && (hasEvent(a, "mouseenter") || hasEvent(a, "mouseover") || hasEvent(a, "pointerenter")) && !hasFocusHandler(a) && !spread)
      add("KEY-02", "Serious", file, text, at, `Hover handler on <${tag}> without a focus equivalent (hover-only content)`);

    if (/^h[1-6]$/.test(t)) hLevels.push([Number(t[1]), at]);
  }

  for (const m of text.matchAll(/<a\b[^>]*>\s*(click here|here|read more|more|learn more|link|saiba mais|leia mais|clique aqui)\s*<\/a>/gi))
    add("NAME-06", "Moderate", file, text, m.index!, "Link text is not meaningful out of context");

  // buttons / links with only an icon (closing tag found with indexOf, linear)
  const lower = text.toLowerCase();
  for (const tk of tags(text)) {
    const tl = tk.tag.toLowerCase();
    if (tl !== "button" && tl !== "a") continue;
    const a = tk.attrs;
    if (has(a, ...NAME_ATTRS) || hasSpread(a)) continue;
    const close = lower.indexOf(`</${tl}>`, tk.end);
    if (close === -1 || close - tk.end > 6000) continue;
    const inner = text.slice(tk.end, close);
    if (/\{\s*(children|props\.children|label|text|title|t\()|<slot\b|<ng-content|\{\{\s*[\w.$]+\s*\}\}|\{\{\s*['"$]/.test(inner)) continue;
    const stripped = inner.replace(/<(mat-icon|ion-icon|fa-icon|iconify-icon)\b[^>]*>.*?<\/\1>/gis, "<icon/>");
    const visible = stripped.replace(/<(svg|img)\b[^>]*\balt\s*=\s*["'][^"']+["'][^>]*>/g, "label").replace(/<[^>]+>/g, "").trim();
    const hasSr = /(sr-only|visually-?hidden|VisuallyHidden|screen-?reader|cdk-visually-hidden)/.test(inner);
    const hasExpr = /\{[^{}]+\}|\{\{[^{}]+\}\}|<\?|\$\{/.test(stripped.replace(/<[^>]+>/g, ""));
    const icon = new RegExp(`<${NATIVE_ICON}`, "i").test(stripped) ||
      /class\s*=\s*["'][^"']*(\bicon\b|\bfa[srlb]?\b|fa-|bi-|glyphicon|material-icons|ti-|i-[a-z])/i.test(stripped) ||
      stripped.includes("<icon/>");
    if (!visible.replace("<icon/>", "").trim() && !hasSr && !hasExpr && icon)
      add("NAME-02", "Blocker", file, text, tk.index, `<${tk.tag}> contains only an icon/image and no accessible name`);
  }

  const h1 = hLevels.filter(([l]) => l === 1).map(([, p]) => p);
  if (h1.length > 1) add("STRUCT-02", "Moderate", file, text, h1[1], `${h1.length} <h1> in one file`);
  let prev: number | null = null;
  for (const [lvl, p] of hLevels) {
    if (prev !== null && lvl - prev > 1) add("STRUCT-02", "Moderate", file, text, p, `Heading level skips from h${prev} to h${lvl}`);
    prev = lvl;
  }

  const dlg = /role\s*=\s*["'](dialog|alertdialog)["']|aria-modal|<dialog\b|showModal/.exec(text);
  if (dlg && !/Escape|onCancel|oncancel|\bcancel\b|closedby|onOpenChange|onDismiss|useDismiss|Dialog\.Root|DialogPrimitive|<dialog|@keydown\.esc|keydown\.escape|\(keydown\.escape\)|cdkTrapFocus|mat-dialog|MatDialog|ngbModal|bootstrap|data-bs-dismiss|data-dismiss|focus-trap|focusTrap|a11y-dialog/i.test(text))
    add("DLG-04", "Serious", file, text, dlg.index, "Dialog markup with no Escape/cancel/dismiss handling in this file");
  const d2 = /role\s*=\s*["'](dialog|alertdialog)["']/.exec(text);
  if (d2 && !/aria-label(ledby)?|<DialogTitle|Dialog\.Title|\.Title\b|<Title|mat-dialog-title|modal-title|<h[1-6]/.test(text))
    add("DLG-02", "Serious", file, text, d2.index, "role=dialog without aria-label/aria-labelledby/title in this file");
  const hp = /aria-haspopup/.exec(text);
  if (hp && !/aria-expanded/.test(text)) add("LAYER-01", "Serious", file, text, hp.index, "aria-haspopup without aria-expanded in this file");

  for (const m of text.matchAll(/(?<![\w-])(focus:outline-none|outline-none|outline-0)(?![\w-])/g)) {
    const i = m.index!;
    const win = text.slice(Math.max(0, i - 300), i) + " " + text.slice(i + m[0].length, i + m[0].length + 300);
    if (!/focus(-visible)?:(ring|outline-(?!none|0)|border|shadow|underline|bg)|focus-visible:/.test(win)) {
      if (m[1].startsWith("focus:"))
        add("FOCUS-01", "Blocker", file, text, i, "focus:outline-none with no focus replacement nearby (Tailwind/utility class)");
      else
        add("FOCUS-01", "Moderate", file, text, i, "outline-none/outline-0 with no focus replacement nearby; fine on containers focused by script (popups, lists), a failure on buttons, links and inputs");
    }
  }
  for (const m of text.matchAll(/style\s*=\s*(?:\{\{|["'])[^>]*?outline\s*:\s*['"]?(none|0)\b/g))
    add("FOCUS-01", "Blocker", file, text, m.index!, "outline removed in an inline style; confirm a visible replacement exists");

  for (const m of text.matchAll(/["']Escape["']|\.esc\b|keydown\.escape|\(keydown\.escape\)/g)) {
    const i = m.index!;
    const win = text.slice(Math.max(0, i - 400), i + m[0].length + 400);
    if (/addEventListener\(\s*['"]keydown|onKeyDown|@keydown|keydown|on:keydown/.test(win) &&
      !/isComposing|keyCode\s*===?\s*229|Dismiss|Primitive|Dialog\.|Popover\.|Menu\.|cdk|focus-trap|a11y-dialog/.test(win)) {
      add("KEY-06", "Moderate", file, text, i, "Custom Escape handler does not check IME composition (event.isComposing)");
      break;
    }
  }

  scanVanillaJs(file, text);
}

// ---------------------------------------------------------------- vanilla JS / DOM scripting
function scanVanillaJs(file: string, text: string): void {
  if (!/\.(js|mjs|cjs|ts|mts|cts|html|htm|vue|svelte|astro|marko|php|erb|ejs)$/.test(file)) return;
  const created = /(?:const|let|var)\s+(\w+)\s*=\s*(?:document|\w+)\.createElement\(\s*['"](div|span|li|p|img|td|tr|section|i)['"]\s*\)/g;
  for (const m of text.matchAll(created)) {
    const v = esc(m[1]);
    const tag = m[2];
    const ev = new RegExp(String.raw`\b${v}\.(?:addEventListener\(\s*['"](?:click|mousedown|mouseup|pointerdown|pointerup)['"]|onclick\s*=|onmousedown\s*=)`).exec(text);
    if (!ev) continue;
    const hasRole = new RegExp(String.raw`\b${v}\.(?:setAttribute\(\s*['"]role['"]|role\s*=)`).test(text);
    const hasTab = new RegExp(String.raw`\b${v}\.(?:setAttribute\(\s*['"]tabindex['"]|tabIndex\s*=)`).test(text);
    const hasKey = new RegExp(String.raw`\b${v}\.(?:addEventListener\(\s*['"]key(?:down|up|press)['"]|onkey(?:down|up|press)\s*=)`).test(text);
    if (!hasRole) add("ROLE-01", "Blocker", file, text, ev.index, `createElement('${tag}') gets a click handler but no role (use createElement('button'))`);
    else if (!(hasTab && hasKey)) add("ROLE-03", "Blocker", file, text, ev.index, `createElement('${tag}') with role but missing tabindex or key handler`);
  }
  for (const m of text.matchAll(/setAttribute\(\s*['"]tabindex['"]\s*,\s*['"]?([1-9]\d*)/g))
    add("KEY-01", "Serious", file, text, m.index!, `setAttribute('tabindex', ${m[1]}): positive tabindex`, false);
  for (const m of text.matchAll(/\.tabIndex\s*=\s*([1-9]\d*)/g)) add("KEY-01", "Serious", file, text, m.index!, `.tabIndex = ${m[1]}: positive tabindex`, false);
  for (const m of text.matchAll(/\.style\.outline\s*=\s*['"](none|0)|\.style\.setProperty\(\s*['"]outline['"]\s*,\s*['"](none|0)/g))
    add("FOCUS-01", "Blocker", file, text, m.index!, "outline removed from script; confirm a visible replacement exists");
  const hover = /addEventListener\(\s*['"](mouseenter|mouseover|pointerenter)['"]/.exec(text);
  if (hover && !/addEventListener\(\s*['"](focus|focusin)['"]|:focus|\.focus\(\)/.test(text))
    add("KEY-02", "Serious", file, text, hover.index, "Hover listener with no focus listener in this file (hover-only content?)");
  const cust = /customElements\.define\(/.exec(text);
  if (cust && /addEventListener\(\s*['"]click['"]/.test(text) &&
    !/addEventListener\(\s*['"]key(down|up|press)['"]|(?:this|host|element)\.(?:setAttribute\(\s*['"](?:role|aria-)|role\s*=|ariaLabel)|ElementInternals|attachInternals/.test(text))
    add("ROLE-01", "Serious", file, text, cust.index, "Custom element handles click but sets no role/ARIA and has no key handling (use ElementInternals or a real <button> inside)");
  for (const m of text.matchAll(/(?:toast|snackbar|notification|alert|flash|message)[\s\S]{0,240}?setTimeout\([^,]+,\s*(\d{3,5})\s*\)/gi)) {
    if (Number(m[1]) <= 8000) {
      add("MOTION-04", "Moderate", file, text, m.index!, `Transient message auto-dismisses after ${m[1]} ms; confirm it pauses on hover/focus and can be extended`);
      break;
    }
  }
  const smooth = /\.scrollTo\(\s*\{[^}]*behavior\s*:\s*['"]smooth|scrollIntoView\(\s*\{[^}]*behavior\s*:\s*['"]smooth/.exec(text);
  if (smooth && !/prefers-reduced-motion|matchMedia/.test(text)) add("MOTION-01", "Moderate", file, text, smooth.index, "Smooth scrolling in script with no prefers-reduced-motion check");
  const raf = /requestAnimationFrame|\.animate\(/.exec(text);
  if (raf && !/prefers-reduced-motion|matchMedia|useReducedMotion|reducedMotion/.test(text))
    add("MOTION-01", "Moderate", file, text, raf.index, "JS-driven animation with no reduced-motion check in this file");
  for (const m of text.matchAll(/['"]keydown['"][\s\S]{0,300}?\.preventDefault\(\)/g)) {
    if (/['"]Tab['"]|keyCode\s*===?\s*9\b/.test(m[0]) && !/Escape|focus-trap|trap|modal|dialog/i.test(text)) {
      add("KEY-03", "Blocker", file, text, m.index!, "keydown handler prevents default on Tab with no visible escape route (possible keyboard trap)");
      break;
    }
  }
}

// ---------------------------------------------------------------- CSS
function cssChunks(text: string): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  for (const m of text.matchAll(/<style\b[^>]*>(.*?)<\/style>/gids)) out.push([m.indices![1][0], m[1]]);
  for (const m of text.matchAll(/(?:styled(?:\.\w+|\([^)]*\))|css|createGlobalStyle|keyframes|injectGlobal|stylex\.create|@apply)\s*`([^`]*)`/gds))
    out.push([m.indices![1][0], m[1]]);
  return out;
}

function scanCss(file: string, css: string, full: string = css, off = 0): void {
  const put = (id: string, sev: string, pos: number, msg: string, review = true) => add(id, sev, file, full, off + pos, msg, review);

  for (const m of css.matchAll(/([^{}]+)\{[^{}]*outline\s*:\s*(none|0)\b[^{}]*\}/g)) {
    const sel = m[1].trim();
    if (/:focus/.test(sel) && !/focus-visible/.test(sel)) {
      if (!/:focus-visible/.test(css) && !/:focus-within/.test(css) && !/box-shadow/.test(m[0]) && !/border/.test(m[0]))
        put("FOCUS-01", "Blocker", m.index!, `\`${sel.slice(-60)}\` removes outline, no :focus-visible/box-shadow/border replacement in file`);
    } else if (!/:focus/.test(sel) && !/-webkit-|::|input\[type=range\]/.test(sel)) {
      const interactive = /(^|[\s>+~.#,&])(button|a|input|select|textarea|summary)\b|\[role=|btn|button|link|input|tab\b|item|trigger|control|toggle|switch|checkbox|radio|select|menu|chip|field/i.test(sel);
      put("FOCUS-01", interactive ? "Serious" : "Minor", m.index!, `\`${sel.slice(-60)}\` sets outline:none on a base selector; ${interactive ? "confirm :focus-visible replaces it" : "likely a wrapper or a script-focused container, confirm it is not a Tab target"}`);
    }
  }
  const anim = /(?:^|[;{\s])(?:animation(?:-name)?|transition(?:-property)?)\s*:|@keyframes/.exec(css);
  if (anim) put("MOTION-01", "Moderate", anim.index, "Animations/transitions with no prefers-reduced-motion in this file (check global rules)");
  const sb = /scroll-behavior\s*:\s*smooth/.exec(css);
  if (sb) put("MOTION-01", "Moderate", sb.index, "scroll-behavior: smooth with no prefers-reduced-motion guard");
  for (const m of css.matchAll(/(?:^|[;{\s])(?:height|max-height)\s*:\s*\d+(?:\.\d+)?px[^;}]*;[^}]*overflow\s*:\s*hidden/g))
    put("VIS-05", "Moderate", m.index!, "Fixed pixel height with overflow:hidden may clip enlarged text (check text containers)");
  for (const m of css.matchAll(/font-size\s*:\s*(?:[0-9]|1[01])(?:\.\d+)?px/g)) put("VIS-05", "Moderate", m.index!, "Font size under 12px (readability and zoom)");
  for (const m of css.matchAll(/(sr-only|visually-hidden|screen-?reader[\w-]*|cdk-visually-hidden)[^{]*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden)/g))
    put("STATE-08", "Serious", m.index!, "Visually-hidden helper uses display:none/visibility:hidden, which also hides it from screen readers");
  const orient = /@media[^{]*orientation\s*:/.exec(css);
  if (orient && /@media[^{]*orientation\s*:\s*(portrait|landscape)/.test(css) && /display\s*:\s*none/.test(css))
    put("VIS-09", "Moderate", orient.index, "Orientation media query hides content (is orientation locked?)");
  for (const m of css.matchAll(/([^{}]*:hover[^{}]*)\{[^{}]*(?:display|visibility|opacity)\s*:\s*(?:block|flex|visible|1|inline)/g)) {
    const sel = m[1].trim();
    const i = m.index!;
    if (!/:focus|:focus-within|:focus-visible/.test(sel) && !/:focus(-within|-visible)?/.test(css.slice(Math.max(0, i - 600), i + m[0].length + 600))) {
      put("PTR-06", "Serious", i, `\`${sel.slice(-60)}\` reveals content on :hover with no :focus/:focus-within equivalent nearby`);
      break;
    }
  }
}

// ---------------------------------------------------------------- native
function scanSwift(file: string, text: string): void {
  for (const m of text.matchAll(/\.onTapGesture\b/g)) {
    const i = m.index!;
    if (!/accessibility(Label|AddTraits|Action)|\.isButton/.test(text.slice(Math.max(0, i - 400), i + 400)))
      add("NATIVE-02", "Serious", file, text, i, "onTapGesture on a view without accessibility traits/label (use Button or add traits)");
  }
  for (const m of text.matchAll(/\bImage\(\s*(?!systemName)[^)]*\)/g)) {
    const i = m.index!;
    if (!/accessibilityLabel|accessibilityHidden|decorative:|Label\(/.test(text.slice(i, i + m[0].length + 250)))
      add("NATIVE-01", "Serious", file, text, i, "Image without accessibilityLabel/accessibilityHidden or decorative");
  }
  for (const m of text.matchAll(/\.font\(\s*\.system\(\s*size\s*:\s*\d+/g))
    add("NATIVE-03", "Serious", file, text, m.index!, "Fixed system font size (does not scale with Dynamic Type); use text styles or relativeTo");
  for (const m of text.matchAll(/UIFont\.(?:systemFont|boldSystemFont)\(ofSize/g))
    add("NATIVE-03", "Serious", file, text, m.index!, "Fixed UIFont size; use preferredFont(forTextStyle:) and adjustsFontForContentSizeCategory");
  const anim = /withAnimation|\.animation\(/.exec(text);
  if (anim && !/accessibilityReduceMotion|isReduceMotionEnabled/.test(text)) add("NATIVE-05", "Moderate", file, text, anim.index, "Animation with no reduce-motion check in this file");
  for (const m of text.matchAll(/UIButton\(|UIImageView\(/g)) {
    const i = m.index!;
    if (!/accessibilityLabel|isAccessibilityElement|setTitle/.test(text.slice(i, i + m[0].length + 400)))
      add("NATIVE-01", "Serious", file, text, i, "UIKit control/image without accessibilityLabel within the next lines");
  }
}

function scanKotlin(file: string, text: string): void {
  for (const m of text.matchAll(/contentDescription\s*=\s*null/g)) {
    const i = m.index!;
    if (/clickable|IconButton|Button|onClick/.test(text.slice(Math.max(0, i - 200), i + m[0].length + 200)))
      add("NATIVE-01", "Blocker", file, text, i, "contentDescription = null on a clickable element");
  }
  for (const m of text.matchAll(/\bImage\(|\bIcon\(/g)) {
    const i = m.index!;
    if (!text.slice(i, i + m[0].length + 250).includes("contentDescription")) add("NATIVE-01", "Serious", file, text, i, "Image/Icon composable without contentDescription");
  }
  for (const m of text.matchAll(/fontSize\s*=\s*\d+\.dp/g)) add("NATIVE-03", "Serious", file, text, m.index!, "Font size in dp instead of sp (does not scale)");
  for (const m of text.matchAll(/\.clickable\b/g)) {
    const i = m.index!;
    if (!/role\s*=|semantics|onClickLabel/.test(text.slice(i, i + m[0].length + 160)))
      add("NATIVE-02", "Moderate", file, text, i, "clickable without role/onClickLabel (announced as a generic element)");
  }
  for (const m of text.matchAll(/\.size\(\s*(\d{1,2})\.dp\s*\)/g)) {
    const i = m.index!;
    if (Number(m[1]) < 48 && /clickable|IconButton/.test(text.slice(Math.max(0, i - 150), i + m[0].length + 150)))
      add("NATIVE-04", "Moderate", file, text, i, `Interactive element under 48dp (${m[1]}dp)`);
  }
}

function scanXmlLayout(file: string, text: string): void {
  for (const m of text.matchAll(/<(ImageButton|ImageView)\b[^>]*>/gs)) {
    if (!m[0].includes("contentDescription") && !m[0].includes("importantForAccessibility"))
      add("NATIVE-01", "Serious", file, text, m.index!, `<${m[1]}> without contentDescription`);
  }
  for (const m of text.matchAll(/android:textSize\s*=\s*"\d+(?:\.\d+)?dp"/g)) add("NATIVE-03", "Serious", file, text, m.index!, "textSize in dp, use sp");
  for (const m of text.matchAll(/android:(?:layout_)?(?:minHeight|minWidth|height|width)\s*=\s*"(\d{1,2})dp"/g)) {
    const i = m.index!;
    if (Number(m[1]) < 48 && /Button|clickable/.test(text.slice(Math.max(0, i - 300), i + m[0].length + 100)))
      add("NATIVE-04", "Moderate", file, text, i, `Interactive view dimension under 48dp (${m[1]}dp)`);
  }
}

function scanRn(file: string, text: string): void {
  for (const tk of tags(text)) {
    const tag = tk.tag;
    const a = tk.attrs;
    const i = tk.index;
    if (["TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback", "Pressable"].includes(tag) && !hasSpread(a)) {
      if (!has(a, "accessibilityRole", "role")) add("NATIVE-02", "Serious", file, text, i, `<${tag}> without accessibilityRole`);
      if (!has(a, "accessibilityLabel", "aria-label")) add("NATIVE-01", "Review", file, text, i, `<${tag}> without accessibilityLabel (ok if it contains text)`);
    }
    if (tag === "Image" && !(has(a, "accessibilityLabel", "alt", "accessible") || hasSpread(a)))
      add("NATIVE-01", "Serious", file, text, i, "<Image> without accessibilityLabel/alt or accessible={false}");
    if ((tag === "Text" || tag === "TextInput") && attr(a, "allowFontScaling") === "false")
      add("NATIVE-03", "Serious", file, text, i, "allowFontScaling={false} blocks user text size");
  }
  const an = /Animated\./.exec(text);
  if (an && !/isReduceMotionEnabled|useReducedMotion|ReducedMotion/.test(text)) add("NATIVE-05", "Moderate", file, text, an.index, "Animated API with no reduce-motion check in this file");
}

// ---------------------------------------------------------------- stack detection
const DEPS: Array<[string, string]> = [["react", "React"], ["preact", "Preact"], ["solid-js", "Solid"], ["@builder.io/qwik", "Qwik"], ["next", "Next.js"],
  ["@remix-run/react", "Remix"], ["gatsby", "Gatsby"], ["vue", "Vue"], ["nuxt", "Nuxt"], ["svelte", "Svelte"],
  ["@sveltejs/kit", "SvelteKit"], ["astro", "Astro"], ["@angular/core", "Angular"], ["lit", "Lit"], ["lit-element", "Lit"],
  ["alpinejs", "Alpine.js"], ["htmx.org", "htmx"], ["@hotwired/stimulus", "Stimulus"], ["@hotwired/turbo", "Turbo"],
  ["@stencil/core", "Stencil"], ["ember-source", "Ember"], ["marko", "Marko"], ["react-native", "React Native"],
  ["expo", "Expo"], ["@ionic/core", "Ionic"], ["@11ty/eleventy", "Eleventy"], ["vite", "Vite"], ["webpack", "webpack"],
  ["tailwindcss", "Tailwind"], ["bootstrap", "Bootstrap"], ["@mui/material", "MUI"], ["@angular/material", "Angular Material"]];

function detectStack(root: string, exts: Set<string>): string[] {
  const stack: string[] = [];
  const base = fs.statSync(root).isDirectory() ? root : path.dirname(root) || ".";
  const pkg = path.join(base, "package.json");
  if (fs.existsSync(pkg)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkg, "utf8"));
      const deps = { ...(data.dependencies ?? {}), ...(data.devDependencies ?? {}) };
      for (const [dep, label] of DEPS) if (dep in deps && !stack.includes(label)) stack.push(label);
    } catch {
      /* ignore malformed package.json */
    }
  }
  const byExt: Array<[string[], string]> = [[[".cshtml", ".razor"], "Razor"], [[".blade"], "Blade"], [[".twig"], "Twig"], [[".njk"], "Nunjucks"],
    [[".jinja", ".jinja2", ".j2"], "Jinja/Django"], [[".liquid"], "Liquid"], [[".erb"], "ERB"], [[".ejs"], "EJS"],
    [[".hbs", ".handlebars"], "Handlebars"], [[".swift"], "Swift"], [[".kt"], "Kotlin"], [[".vue"], "Vue SFC"],
    [[".svelte"], "Svelte SFC"], [[".astro"], "Astro"]];
  for (const [es, label] of byExt) if (es.some((e) => exts.has(e)) && !stack.includes(label)) stack.push(label);
  if (exts.has(".html") || exts.has(".htm")) stack.push("HTML");
  if ([".js", ".mjs", ".ts"].some((e) => exts.has(e)) && !["React", "Vue", "Svelte", "Angular", "Preact", "Solid", "Qwik"].some((x) => stack.includes(x))) stack.push("vanilla JS/TS");
  return stack;
}

// ---------------------------------------------------------------- main
function main(): void {
  const argv = process.argv.slice(2);
  const args = argv.filter((a) => !a.startsWith("--"));
  if (!args.length) {
    console.log("Usage: node scan.mts <path> [--changed] [--json]");
    return;
  }
  const root = args[0];
  if (!fs.existsSync(root)) {
    console.error(`Path not found: ${root}`);
    return;
  }
  const changed = argv.includes("--changed");
  const asJson = argv.includes("--json");
  const base = fs.statSync(root).isDirectory() ? root : path.dirname(root) || ".";
  let isRn = false;
  const pkg = path.join(base, "package.json");
  if (fs.existsSync(pkg)) {
    try {
      isRn = /"react-native"|"expo"/.test(fs.readFileSync(pkg, "utf8"));
    } catch {
      /* ignore */
    }
  }

  let nFiles = 0;
  const exts = new Set<string>();
  let rmAnywhere = false;
  for (const p of filesUnder(root, changed)) {
    const low = p.toLowerCase();
    let ext = low.endsWith(".blade.php") ? ".blade" : path.extname(low);
    if (/\.html\.(erb|twig|j2)$/.test(low)) ext = low.endsWith(".erb") ? ".erb" : ".twig";
    if (!(WEB_EXT.has(ext) || CSS_EXT.has(ext) || SWIFT_EXT.has(ext) || KOTLIN_EXT.has(ext) || XML_EXT.has(ext))) continue;
    const norm = "/" + p.replace(/\\/g, "/").replace(/^\.\//, "");
    if (/\.(min\.js|min\.css|d\.ts|test\.[cm]?[jt]sx?|spec\.[cm]?[jt]sx?|cy\.[cm]?[jt]sx?|stories\.[jt]sx?|bundle\.js|chunk\.js)$/.test(low) ||
      /\/(__tests__|cypress|e2e|playwright|__mocks__|__fixtures__)\//.test(norm.toLowerCase())) continue;
    let text: string;
    try {
      if (fs.statSync(p).size > MAX_BYTES) continue;
      text = fs.readFileSync(p, "utf8");
    } catch {
      continue;
    }
    nFiles++;
    exts.add(ext);
    const rel = path.relative(process.cwd(), p);
    if (/prefers-reduced-motion|useReducedMotion|reducedMotion|prefersReducedMotion|isReduceMotionEnabled|accessibilityReduceMotion/.test(text)) rmAnywhere = true;
    if (WEB_EXT.has(ext)) {
      if (isRn) scanRn(rel, text);
      scanWeb(rel, text);
      for (const [off, chunk] of cssChunks(text)) scanCss(rel, chunk, text, off);
    } else if (CSS_EXT.has(ext)) scanCss(rel, text);
    else if (SWIFT_EXT.has(ext)) scanSwift(rel, text);
    else if (KOTLIN_EXT.has(ext)) scanKotlin(rel, text);
    else if (XML_EXT.has(ext) && (p.includes("layout") || p.includes("res/"))) scanXmlLayout(rel, text);
  }

  if (rmAnywhere) {
    for (const f of findings) {
      if (f.id === "MOTION-01") {
        f.sev = "Minor";
        f.msg += " [reduced-motion handling exists elsewhere in the project: confirm it covers this]";
      }
    }
  }

  const seen = new Set<string>();
  const uniq = findings.filter((f) => {
    const k = `${f.id}|${f.file}|${f.line}|${f.msg}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const order: Record<string, number> = { Blocker: 0, Serious: 1, Moderate: 2, Minor: 3, Review: 4 };
  uniq.sort((x, y) => (order[x.sev] ?? 9) - (order[y.sev] ?? 9) || x.id.localeCompare(y.id) || x.file.localeCompare(y.file) || x.line - y.line);
  const stack = detectStack(root, exts);

  if (asJson) {
    console.log(JSON.stringify({ files: nFiles, stack, findings: uniq }, null, 2));
    return;
  }
  console.log(`Detected: ${stack.join(", ") || "unknown stack"}`);
  console.log(`Scanned ${nFiles} files. ${uniq.length} leads (heuristic: confirm each by reading the code).\n`);
  // Group identical messages: show the first few locations, then a count (JSON keeps everything).
  const SHOW = 5;
  let cur = "";
  const groups = new Map<string, Finding[]>();
  for (const f of uniq) {
    const k = `${f.sev}|${f.id}|${f.msg.replace(/\d+/g, "N")}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  for (const list of groups.values()) {
    const f0 = list[0];
    const key = `${f0.sev}|${f0.id}`;
    if (key !== cur) {
      cur = key;
      console.log(`\n## ${f0.sev} · ${f0.id}`);
    }
    for (const f of list.slice(0, SHOW)) console.log(`- ${f.file}:${f.line}  ${f.msg}${f.review ? " [review]" : ""}\n    ${f.snippet}`);
    if (list.length > SHOW) {
      const files = new Set(list.map((f) => f.file)).size;
      console.log(`  … +${list.length - SHOW} more of the same (${files} files in total). Use --json for every location.`);
    }
  }
  if (!uniq.length) console.log("No leads. This is not a pass: contrast, behaviour, focus and screen reader output are not covered by this scan.");
}

main();
