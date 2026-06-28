# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Smaller type declarations (~74%).** The published `.d.ts` dropped from
  ~270 KB to ~70 KB. They are now emitted per source file (`vite-plugin-dts`
  with `bundleTypes: false`) so the core API is shared by reference across the
  framework adapters instead of being inlined into every entry point. Inferred
  inline `import('react').X` references are hoisted to top-level imports
  (`staticImport`), and the two React `<GlyphnavLink>` components annotate their
  return type as `ReactElement` so each no longer emits a ~24 KB inferred anchor
  type. Full TSDoc is preserved for editor hover.
- **`dist` layout.** Each entry point now ships as
  `dist/<name>/index.{js,cjs,d.ts}` (previously a flat `dist/<name>.{js,cjs}`
  plus a bundled `.d.ts`), so every entry's JavaScript sits next to its
  declaration file. This is wired through the package `exports` map, so the
  import specifiers (`glyphnav`, `glyphnav/core`, `glyphnav/react-router`, …)
  are unchanged. The declaration files target bundler module resolution
  (`moduleResolution: "bundler"`), not `node16`/`nodenext`.

## [2.2.0] - 2026-06-25

### Added

- **SvelteKit adapter** (`glyphnav/sveltekit`): `attachGlyphnav(goto, options)`
  for Svelte's official application framework and router. SvelteKit exposes no
  patchable router object, so by default the adapter installs a capture-phase
  `<a>` click listener that `preventDefault()`s eligible same-origin links —
  making SvelteKit's own handler stand down (it bails on an already-defaulted
  click) — and drives the real navigation through `goto` (passed in by the
  caller, since `$app/navigation` is a virtual module only resolvable inside a
  SvelteKit app). Every internal link therefore animates with no per-link
  wiring, like the Nuxt plugin. Because `goto` resolves a tick before the address
  bar settles, the adapter waits for the URL to land (like the Next App Router
  adapter) so the default `commit: 'before'` decodes the path that actually
  landed rather than the old one. Also exposes an animated
  `navigate()`, a `use:link` Svelte action for opt-in per-link animation under
  `intercept: 'none'`, and an opt-in `animatePopState`. Ships compiler-free (a
  structurally-typed `goto`, no Svelte import); `@sveltejs/kit` (`>=2`) and
  `svelte` (`>=4`) are optional peer dependencies. The shared `eligibleAnchor`
  link-eligibility rules move into the internal module so the vanilla `install()`
  and the SvelteKit adapter define them once. Adds the eleventh package entry
  point and a live SvelteKit demo to the playground.

## [2.1.0] - 2026-06-24

### Added

- **Solid Router adapter** (`glyphnav/solid-router`): `GlyphnavProvider`,
  `GlyphnavLink`, `useGlyphnavNavigate` and `useGlyphnavController` for the
  official Solid Router (`@solidjs/router`). `GlyphnavLink` is a drop-in for
  `<A>` — its destination is resolved exactly like the real one (route-relative
  via `useResolvedPath`, base-aware via `useHref`) and it `preventDefault()`s so
  Solid Router's own delegated click handler (which bails on an already-handled
  event) doesn't double-navigate; `useGlyphnavNavigate()` mirrors `useNavigate()`
  (a numeric history delta is passed straight through). Like the React and
  TanStack-Solid adapters it patches nothing globally and ships compiler-free
  (no JSX in the build); `@solidjs/router` (`>=0.14`) and `solid-js` are optional
  peer dependencies. Adds the tenth package entry point and a live Solid Router
  demo to the playground.

## [2.0.0] - 2026-06-23

### Added

- **Animate browser back/forward (popstate).** The core controller gains
  `enableHistoryAnimation()` — which plays the glyph decode on history traversals
  (back/forward), where the browser moves the URL itself and there is nothing to
  commit — and the lower-level `replay(from, to)` it builds on (decode between two
  known paths without committing). The vanilla `install()` enables it **by default**
  when intercepting links (a no-op in reload/MPA mode; pass `animatePopState: false`
  to disable). Every router adapter exposes an opt-in `animatePopState` option
  (default `false`), preserving their "nothing patched globally" contract:
  `<GlyphnavProvider animatePopState>` for React Router, TanStack Router (React &
  Solid) and Next.js; `animatePopState: true` on `attachGlyphnav` / `installGlyphnav`
  (Vue / Nuxt) and `provideGlyphnav` / `createGlyphnavNavigator` (Angular). In-flight
  runs still back off from an external URL change as before.
- **React Router adapter** (`glyphnav/react-router`): support for React Router v8,
  alongside the existing v6 and v7.

### Changed

- **Breaking — React Router adapter** (`glyphnav/react-router`): the peer
  dependency is now `react-router` (`>=6`) instead of `react-router-dom`, and the
  adapter imports its navigation hooks (`useNavigate`, `useHref`) from
  `react-router`. v8 ships only `react-router` (the `react-router-dom` package was
  dropped), while v6 and v7 expose the same hooks there too, so one import path
  covers all three majors. `GlyphnavLink` now renders a plain `<a>` (its `href`
  resolved via `useHref`) instead of wrapping `<Link>`, so `GlyphnavLinkProps`
  extends the anchor attributes plus `to`/`replace`/`state` rather than React
  Router's `LinkProps`. Apps on v6/v7 keep working without changes — `react-router`
  is already present as a dependency of `react-router-dom`.
- **Smaller adapters.** The React-family adapters (`glyphnav/react-router`,
  `glyphnav/tanstack-router/react`, `glyphnav/next`) now share their controller
  lifecycle and link-click handling through an internal module instead of each
  re-implementing it, and the Next.js adapter no longer strips its adapter-only
  options before the core (`resolveOptions` reads only the keys it knows, so they
  were already inert). Every adapter entry is around **1 kB gzipped or less**; the
  Next.js adapter — previously the largest at ~1.16 kB — drops to ~1 kB (it ticks
  just over once the opt-in back/forward wiring is included). No API changes.
- **Build.** The published package no longer ships sourcemaps, and the build
  target is raised from `es2020` to `es2022`. This roughly halves the size of the
  published `dist/` (sourcemaps were ~48% of it) and lets the minifier keep modern
  syntax instead of down-leveling it.
- **Animation runs on `requestAnimationFrame`.** The frame player now schedules
  ticks via `requestAnimationFrame` keyed off a `performance.now` start time
  (with a `setTimeout` fallback for SSR/non-visual environments) instead of a
  chain of `setTimeout`s. The animation now **pauses entirely while the tab is in
  the background** (rather than dribbling `replaceState` calls into a hidden page
  at the browser's throttled ~1/s) and stays time-accurate under main-thread load
  instead of drifting. Each frame also skips a now-hoisted `instanceof History` +
  prototype lookup. The frame sequence and ordering are unchanged.
  - **Breaking (advanced).** The injectable `Scheduler` (via `createGlyphnav(_, { scheduler })`
    / `createPlayer`) changed shape from `{ setTimeout, clearTimeout }` to
    `{ now, requestFrame, cancelFrame }`. Only code that supplies its own
    `scheduler` is affected; the default and every adapter are unchanged.

### Fixed

- **Next.js adapter** (`glyphnav/next`): navigate-first (`commit: 'before'`) on the
  App Router no longer skips the address-bar animation. The App Router commits
  navigations asynchronously — `router.push` returns before the URL updates — so
  reading the landed path back synchronously found no change and played nothing
  (the bar just jumped). The adapter now waits for the navigation to actually land
  before animating to the resolved path, matching synchronous routers. A no-op
  navigation still skips cleanly, and animate-first (`commit: 'after'`) was
  unaffected.

## [1.0.2] - 2026-06-16

### Changed

- Extracted repeated parts of the core and adapters into shared helpers to reduce bundle size.

## [1.0.1] - 2026-06-15

### Fixed

- **Nuxt adapter** (`glyphnav/nuxt`): the address bar no longer decodes on a plain
  page reload. Nuxt re-issues the current route through `router.replace` on every
  client hydration, which the adapter was treating as a navigation. It now skips
  animating a navigation that only re-points at the route already shown —
  including a trailing-slash form difference, the case static hosts such as GitHub
  Pages introduce via their `/about` → `/about/` redirect (so the reloaded URL
  differs from Vue Router's canonical resolution). Genuine navigations still
  animate.

## [1.0.0] - 2026-06-14

### Changed

- **Breaking:** renamed the TanStack adapter subpath exports to nest them under a
  shared `tanstack-router/` namespace: `glyphnav/tanstack-react-router` →
  `glyphnav/tanstack-router/react` and `glyphnav/tanstack-solid-router` →
  `glyphnav/tanstack-router/solid`. The backing `src/` folders and emitted
  `dist/` files moved accordingly. Update imports to the new paths.

### Added

- **Next.js adapter** (`glyphnav/next`): `GlyphnavProvider`, `GlyphnavLink`,
  `useGlyphnavNavigate` and `useGlyphnavController`. A `routerMode` option drives
  the real navigation through either the App Router (`next/navigation`) or the
  Pages Router (`next/compat/router`), so one adapter covers both folder
  conventions; `basePath` keeps the animated target accurate under a base path.
- **Nuxt adapter** (`glyphnav/nuxt`): `installGlyphnav` / `attachGlyphnav` wrap
  Vue Router's `push`/`replace` so every `<NuxtLink>` and `navigateTo()` animates,
  with `intercept` ('router' | 'none') and `historyMode` ('history' | 'hash')
  options.
- Next.js (App Router) and Nuxt demos, added as pnpm workspace projects under
  `demo/` and statically exported into the combined `demo/dist` by `pnpm demo:build`,
  so the GitHub Pages deploy publishes all eight integrations from one artifact.

## [0.1.4] - 2026-06-13

### Added

- Footer with GitHub and npm links on every demo page.

### Changed

- Documented the public API with TSDoc parameter descriptions and `@defaultValue` tags.
- Pointed the package `homepage` at the live demo (GitHub Pages).
- Demo apps now share common content and utility helpers to stay in sync.
- Build minifies with the `oxc` minifier via Vite.

### Fixed

- Broken demo index page.

## [0.1.3] - 2026-06-11

### Fixed

- Release tooling: removed the redundant `--access public` flag from the npm publish step (not needed for an unscoped public package). No functional changes to the library.

## [0.1.2] - 2026-06-11

### Fixed

- Release tooling: added `--access public` to the npm publish step. No functional changes to the library.

## [0.1.1] - 2026-06-11

Initial public release.

### Added

- Framework-agnostic core that animates navigation by scrambling random glyphs which resolve into the destination URL right in the address bar.
- Router adapters: Vue Router, React Router, TanStack React Router, TanStack Solid Router, and Angular Router.

[Unreleased]: https://github.com/z1m1n/glyphnav/compare/2.2.0...HEAD
[2.2.0]: https://github.com/z1m1n/glyphnav/compare/2.1.0...2.2.0
[2.1.0]: https://github.com/z1m1n/glyphnav/compare/2.0.0...2.1.0
[2.0.0]: https://github.com/z1m1n/glyphnav/compare/1.0.2...2.0.0
[1.0.2]: https://github.com/z1m1n/glyphnav/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/z1m1n/glyphnav/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/z1m1n/glyphnav/compare/0.1.4...1.0.0
[0.1.4]: https://github.com/z1m1n/glyphnav/compare/0.1.3...0.1.4
[0.1.3]: https://github.com/z1m1n/glyphnav/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/z1m1n/glyphnav/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/z1m1n/glyphnav/releases/tag/0.1.1
