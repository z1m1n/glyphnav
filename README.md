<p align="center">
  <img src="https://z1m1n.github.io/glyphnav/wordmark.svg" alt="glyphnav" width="280" />
</p>

# glyphnav

> Animate navigation: watch the URL **decode itself, glyph by glyph**, right in the address bar — then commit the real navigation.

**[GitHub](https://github.com/z1m1n/glyphnav)** · **[Live demo](https://z1m1n.github.io/glyphnav/)** · **[npm](https://www.npmjs.com/package/glyphnav)**

```
/  →  /x  →  /xy  →  /xyz  →  /xyzw  →  /tyzw  →  /tezw  →  /tesw  →  /test
      └────────────  grow  ────────────┘└───────────  resolve  ──────────┘
```

### ▶ [Live demo](https://z1m1n.github.io/glyphnav/)

Jump straight to an integration:
[vanilla](https://z1m1n.github.io/glyphnav/vanilla/) ·
[Vue Router](https://z1m1n.github.io/glyphnav/vue-router/) ·
[React Router](https://z1m1n.github.io/glyphnav/react-router/) ·
[TanStack (React)](https://z1m1n.github.io/glyphnav/tanstack-router/react/) ·
[TanStack (Solid)](https://z1m1n.github.io/glyphnav/tanstack-router/solid/) ·
[Angular Router](https://z1m1n.github.io/glyphnav/angular-router/) ·
[Next.js](https://z1m1n.github.io/glyphnav/next/) ·
[Nuxt](https://z1m1n.github.io/glyphnav/nuxt/)

`glyphnav` rewrites `history.replaceState` frame by frame: it fills the destination
path with random glyphs (the **grow** phase), then resolves the real characters
left‑to‑right (the **resolve** phase). When the animation finishes it performs the
actual navigation — a hard reload for plain links, or a hand‑off to your router for SPAs.

- 🧩 **Framework‑agnostic core** — a tiny, dependency‑free engine.
- 🔌 **Adapters named after the router they wrap**: `glyphnav/vue-router`,
  `glyphnav/react-router`, `glyphnav/tanstack-router/react`, `glyphnav/angular-router`,
  `glyphnav/next` (App **and** Pages Router) and `glyphnav/nuxt`.
- ⚡ **Navigate‑first by default** (`commit: 'before'`) — the page changes
  instantly and the animation plays on top; switch to `commit: 'after'` for the
  classic animate‑then‑commit order.
- 🎞️ **Two effects**: `decode` (grow + resolve left‑to‑right) and `scramble`
  (full‑length noise at once, characters lock in random order).
- ⏱️ **`duration`** budgets the _whole_ animation — frames auto‑scale to fit.
- 🪶 **<1 kB** per adapter (gzipped) on top of a ~3 kB core.
- ♿ Honors `prefers-reduced-motion`, supersedes overlapping navigations, fully cancelable.
- 🛡️ Writes only rooted same‑origin paths and backs off if the URL changes
  underneath it (back button mid‑animation) — the address bar can't be corrupted.
- 🧪 ESM + CJS + types, built with **Vite**, covered by **Vitest**.

---

## Install

```bash
pnpm add glyphnav
# npm install glyphnav  ·  yarn add glyphnav
```

Router adapters use your existing router as a peer dependency — nothing extra to install.

---

## Quick start (no framework)

▶ **[Live demo](https://z1m1n.github.io/glyphnav/vanilla/)**

```ts
import { install, navigate } from 'glyphnav';

// Hijack same-origin <a> clicks so every navigation animates, then reloads.
install();

// Animate only programmatic calls, leave links alone:
install({ intercept: 'none' });
await navigate('/dashboard'); // hard reload: animate, then location.assign('/dashboard')

// Navigate-first is the default for SPA navigations: pushState immediately,
// then decode the bar on top (hard reloads fall back to animate-then-commit
// because the page unloads):
await navigate('/dashboard', { reload: false });

// Opt back into the classic animate-then-commit order, per call or per install:
install({ reload: false, commit: 'after', duration: 250, effect: 'scramble' });
```

`install()` ignores the things a good link interceptor should: modified clicks
(⌘/Ctrl/Shift/middle), `target="_blank"`, `download`, `rel="external"`,
cross‑origin links, and anything marked `data-glyphnav="off"`.

---

## How it works

Given a target like `/test` (query and hash included — they are just part of the
path), glyphnav splits it into a **fixed prefix** and the **animated text**, then
generates frames. Two effects:

- **`decode`** (default) —
  1. **grow**: append one random glyph per frame until the text reaches the
     target length, producing a random "base" string.
  2. **resolve**: lock in the real characters left‑to‑right, leaving the
     unresolved tail at its base glyphs.
- **`scramble`** — a random string of the target's full length appears
  immediately, then the real characters lock in at **random positions** while
  every unresolved slot keeps flickering:
  `/qqqq → /qeqq → /qesq → /qest → /test`.

By default (`commit: 'before'`) the navigation goes out **immediately** — the
page never waits for the animation — and the bar replays the decode from the old
path to wherever the navigation landed (router redirects included). With
`commit: 'after'` the order flips back to the classic one: the real navigation
is committed only after the last frame has been drawn.

Each frame is written with `history.replaceState` (no new history entries, back button
untouched, and via `History.prototype` so router‑patched history wrappers never see the
frames). The starting path is restored right before the real navigation so router
history stays clean. Safety rails:

- Relative targets are resolved against the current path; only rooted same‑origin
  paths are animated (cross‑origin targets are committed without animation).
- If the URL changes externally mid‑animation (back/forward button, another script),
  the run cancels itself and leaves the new URL alone.

Frame generation is pure and deterministic given an `rng`, which is exactly what the
test‑suite pins down.

---

## Options

Every entry point accepts the same options object.

| Option                 | Type                     | Default       | Description                                                                                                                      |
| ---------------------- | ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `charset`              | `string`                 | url‑safe set  | Pool of random glyphs. Non‑URL‑safe glyphs are percent‑encoded in the bar.                                                       |
| `duration`             | `number \| null`         | `null`        | **Total animation time in ms**, spread over all frames (frames auto‑scale, ≥ ~15 ms each). Takes precedence over `stepDuration`. |
| `stepDuration`         | `number`                 | `40`          | Milliseconds per frame, used when no `duration` is set.                                                                          |
| `effect`               | `'decode' \| 'scramble'` | `'decode'`    | `decode` grows then resolves left‑to‑right; `scramble` bursts to full length, then locks characters in random order.             |
| `commit`               | `'after' \| 'before'`    | `'before'`    | `before` navigates **immediately** and animates on top of the landed URL; `after` animates first, then navigates.                |
| `growStep`             | `number`                 | `1`           | Characters added per grow frame.                                                                                                 |
| `resolveStep`          | `number`                 | `1`           | Characters locked per resolve frame.                                                                                             |
| `maxFrames`            | `number`                 | `120`         | Hard cap; steps auto‑scale so long paths never overrun.                                                                          |
| `scope`                | `'full' \| 'tail'`       | `'full'`      | `full` animates the whole path; `tail` keeps the common prefix and only animates what differs.                                   |
| `preserveLeadingSlash` | `boolean`                | `true`        | Keep the leading `/` fixed (for `scope: 'full'`).                                                                                |
| `respectReducedMotion` | `boolean`                | `true`        | Skip the animation under `prefers-reduced-motion`.                                                                               |
| `rng`                  | `() => number`           | `Math.random` | Random source — inject for reproducibility/tests.                                                                                |
| `hooks`                | `object`                 | `{}`          | `onStart`, `onFrame`, `onCommit`, `onCancel`, `onComplete`.                                                                      |

### Built‑in charsets

```ts
import { URL_SAFE, ALPHANUMERIC, LOWER_ALPHA, HEX, SYMBOLS, MATRIX, BINARY } from 'glyphnav/core';
```

`URL_SAFE` is the default and the only one that stays verbatim in the real address bar.

---

## Router adapters

Each subpath is named after the router it wraps. The Vue and Nuxt plugins (and
vanilla `install()`) intercept globally — and all can be told not to. The React,
TanStack, Angular and Next adapters are opt‑in by design: only navigations made
through their links/hooks animate.

### Vue Router — `glyphnav/vue-router`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/vue-router/)**

```ts
import { createRouter, createWebHistory } from 'vue-router';
import { glyphnav } from 'glyphnav/vue-router';

const router = createRouter({ history: createWebHistory(), routes });

app.use(router);
app.use(glyphnav, { router, duration: 250, commit: 'before' });
```

The plugin wraps `router.push`/`router.replace`, so every `<router-link>` click and
programmatic navigation animates first — `await router.push(...)` still resolves to the
real navigation result. Read the controller anywhere with `useGlyphnav()`, or attach to
a router manually with `attachGlyphnav(router, options)`.

Prefer to leave the router untouched? Pass `intercept: 'none'` and use the animated
`push`/`replace` explicitly:

```ts
app.use(glyphnav, { router, intercept: 'none' });

// in a component:
const { push } = useGlyphnavRouter();
await push('/dashboard'); // animated; plain router.push stays native
```

### React Router — `glyphnav/react-router`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/react-router/)**

```tsx
import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/react-router';

<GlyphnavProvider duration={250} effect="scramble" commit="before">
  <GlyphnavLink to="/about">About</GlyphnavLink>
</GlyphnavProvider>;

// imperative, drop-in for useNavigate():
const navigate = useGlyphnavNavigate();
await navigate('/dashboard');
```

`GlyphnavLink` is a drop‑in for `<Link>` (basename‑aware via `useHref`), and
`useGlyphnavNavigate()` mirrors `useNavigate()`. The provider is optional — without it,
hooks create their own controller.

### TanStack Router (React) — `glyphnav/tanstack-router/react`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/tanstack-router/react/)**

```tsx
import {
  GlyphnavProvider,
  GlyphnavLink,
  useGlyphnavNavigate,
} from 'glyphnav/tanstack-router/react';

<GlyphnavProvider duration={250} commit="before">
  <RouterProvider router={router} />
</GlyphnavProvider>;

// inside the router tree:
<GlyphnavLink to="/about">About</GlyphnavLink>;

const navigate = useGlyphnavNavigate();
await navigate({ to: '/posts' });
```

`useGlyphnavNavigate()` mirrors TanStack's `useNavigate()` (same `NavigateOptions`
object) and resolves the basepath‑aware target via `router.buildLocation()`.
`GlyphnavLink` renders a real `<a href>`; for fully type‑safe links wrap
`useGlyphnavNavigate()` in your own component.

### TanStack Router (Solid) — `glyphnav/tanstack-router/solid`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/tanstack-router/solid/)**

TanStack Router's `buildLocation`/`navigate` come from its framework‑agnostic
core, so the engine is shared — only the bindings differ. The Solid adapter has
the **same API** as the React one, with Solid components and hooks (and
`solid-js` + `@tanstack/solid-router` as peers):

```tsx
import {
  GlyphnavProvider,
  GlyphnavLink,
  useGlyphnavNavigate,
} from 'glyphnav/tanstack-router/solid';

<GlyphnavProvider duration={250} commit="before">
  <RouterProvider router={router} />
</GlyphnavProvider>;

// inside the router tree:
<GlyphnavLink to="/about">About</GlyphnavLink>;

const navigate = useGlyphnavNavigate();
await navigate({ to: '/posts' });
```

`useGlyphnavNavigate()` mirrors Solid's `useNavigate()`, and `GlyphnavLink`
renders a real `<a href>` resolved through `router.buildLocation()` — identical
in spirit to the React adapter above.

### Angular Router — `glyphnav/angular-router`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/angular-router/)**

Because glyphnav is built by Vite (not Angular's `ngtsc`), it ships **compiler‑free**
helpers rather than decorated classes:

```ts
import { provideGlyphnav, GLYPHNAV } from 'glyphnav/angular-router';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideGlyphnav({ duration: 250, commit: 'before' })],
});

// inject anywhere:
const nav = inject(GLYPHNAV);
await nav.navigateByUrl('/about');
await nav.navigate(['/users', 42]);
```

The navigator is base‑href aware: `provideGlyphnav` resolves the animated path
through `Location.prepareExternalUrl`, so apps served under a base href animate
the URL that really lands in the bar.

For an animated link directive (`[glyphnavLink]`), copy the small directive from
[`demo/angular-router/glyphnav-link.directive.ts`](demo/angular-router/glyphnav-link.directive.ts)
into your app, where your own Angular build compiles it. Or wrap a `Router` directly with
`createGlyphnavNavigator(router, options)`.

### Next.js — `glyphnav/next`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/next/)**

One adapter for **both** Next routers. `routerMode` selects which one performs the
real navigation — `'app'` (default, via `next/navigation`) or `'pages'` (via
`next/compat/router`) — so the same code animates whether your routes live in
`app/` or `pages/`.

```tsx
'use client';
import { GlyphnavProvider, GlyphnavLink, useGlyphnavNavigate } from 'glyphnav/next';

<GlyphnavProvider duration={250} commit="after" routerMode="app">
  <GlyphnavLink href="/about?tab=2#top">About</GlyphnavLink>
</GlyphnavProvider>;

// imperative, mirrors useRouter().push:
const navigate = useGlyphnavNavigate();
await navigate('/dashboard');
```

`GlyphnavLink` is a drop‑in for `next/link` (prefetch and all) that animates on
click; `useGlyphnavNavigate()` mirrors `useRouter().push` (pass `{ replace: true }`
for `replace`). Pass `basePath` if the app is served under one. **App Router note:**
its navigations are asynchronous, so `commit: 'after'` (animate, then navigate) is
the reliable mode there; the Pages Router resolves synchronously and works with
either timing.

### Nuxt — `glyphnav/nuxt`

▶ **[Live demo](https://z1m1n.github.io/glyphnav/nuxt/)**

Nuxt runs on Vue Router, so a single client plugin wraps `router.push`/`replace` and
every `<NuxtLink>` click and `navigateTo()` call animates — no per‑link wiring:

```ts
// plugins/glyphnav.client.ts
import { installGlyphnav } from 'glyphnav/nuxt';

export default defineNuxtPlugin((nuxtApp) => {
  installGlyphnav(
    { $router: useRouter(), provide: (name, value) => nuxtApp.provide(name, value) },
    { duration: 250, commit: 'before' },
  );
});

// anywhere: const { controller, navigate } = useNuxtApp().$glyphnav;
```

`historyMode: 'hash'` keeps the animated target correct for hash‑mode routers, and
`intercept: 'none'` leaves the router untouched so only the instance's
`navigate()`/`push()`/`replace()` animate. Attach to a router manually with
`attachGlyphnav(router, options)`.

---

## Core API — `glyphnav/core`

```ts
import { createGlyphnav, generateFrames } from 'glyphnav/core';

// Orchestrate it yourself:
const glyph = createGlyphnav({ duration: 300, effect: 'scramble' });
await glyph.run('/somewhere', () => myRouter.go('/somewhere'));
glyph.cancel();

// Or just compute the frames (pure, DOM-free):
generateFrames('/', '/test', { charset: 'xyzw' }).map((f) => f.path);
// → ['/x','/xy','/xyz','/xyzw','/tyzw','/tezw','/tesw','/test']
```

`createGlyphnav(options, deps)` returns a controller with `run(to, commit, perCall?)`,
`cancel()`, `update(options)` and an `animating` flag. `deps` lets you inject `history`,
`getCurrentPath`, a `scheduler` and a reduced‑motion probe (used throughout the tests).

---

## Demos

**▶ Hosted live at <https://z1m1n.github.io/glyphnav/>** — the same playground,
deployed to GitHub Pages.

One Vite playground covers **six** integrations — vanilla, Vue Router,
React Router, TanStack Router (React **and** Solid) and Angular Router:

```bash
pnpm install
pnpm demo                  # → http://localhost:5173  (picker + all eight, live)
# …or run one server individually:
pnpm demo:vite             # → http://localhost:5173  (just the six Vite demos)
pnpm demo:next             # → http://localhost:5174/next   (Next.js, own dev server)
pnpm demo:nuxt             # → http://localhost:5176/nuxt   (Nuxt, own dev server)
```

Next.js and Nuxt have their own build systems, so they're separate workspace
projects under `demo/next` and `demo/nuxt` rather than Vite entries — each runs on
its own dev server. `pnpm demo` (`run-p` via `npm-run-all2`) starts all three
together, and the Vite dev server proxies `/next` and `/nuxt` to them, so the picker
at `:5173` reaches every demo from one origin (run just `pnpm demo:vite` and those two
links show a hint pointing at their own server). Run a **single** `pnpm demo` — a
second Nuxt instance sharing `demo/nuxt/.nuxt` breaks dev; kill any stale `:5176`
server first. For the deployed artifact,
`pnpm demo:build` (`run-s`) builds the Vite playground, statically exports Next
(`output: 'export'`) and Nuxt (`nuxi generate`), and copies their output into
`demo/dist/{next,nuxt}` so a single `demo/dist` deploys all eight. All demos — Vite,
Next and Nuxt — share one `@glyphnav-demo/shared` workspace package for the charsets,
address‑bar helpers, syntax highlighter and styles.

The Angular demo runs in **JIT mode** inside the same dev server: it imports
`@angular/compiler` in the browser, so no ngtsc build step (and no second app)
is needed. The trade‑offs of JIT‑in‑Vite — no AOT template type‑checking, the
compiler in the bundle, `inject()` instead of constructor DI — are fine for a
demo; a real app keeps using its own Angular build, which compiles the copied
directive with AOT as usual.

Every demo shares the same bare, monospace look: a clickable `glyphnav / <router>`
breadcrumb back to the picker, an in‑page mirror of the address bar, a `docs` tab
with copy‑paste integration snippets, **deep links with `?query` and `#hash`**
(they animate like any path), and controls for charset, speed (whole‑animation
duration 20–1000 ms, slider inverted so full right is fastest), effect
(`decode`/`scramble`), commit order (`navigate first`/`animate first`) and scope.
The demos alias `glyphnav` to `src/`, so editing the library updates them live.

---

## Development

The repo is a [pnpm](https://pnpm.io) **11.5** workspace: the library is the root
package, with the Next.js and Nuxt demos as members under `demo/` (the other demos
are plain files in the root package).

```bash
pnpm test            # Vitest (jsdom) — core, controller, vanilla + all adapters
pnpm run typecheck   # tsc --noEmit
pnpm run build       # Vite library build → dist/ (ESM + CJS + .d.ts)
pnpm run coverage    # V8 coverage
```

The package is built with **Vite 8** in library mode with nine entry points
(`.`, `./core`, `./vue-router`, `./react-router`, `./tanstack-router/react`,
`./tanstack-router/solid`, `./angular-router`, `./next`, `./nuxt`); router/framework
deps are always externalized. Declarations are
generated against `tsconfig.build.json` so they mirror the entry layout in `dist/`.

---

## License

[MIT](LICENSE)
