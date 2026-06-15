# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/z1m1n/glyphnav/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/z1m1n/glyphnav/compare/v0.1.4...v1.0.0
[0.1.4]: https://github.com/z1m1n/glyphnav/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/z1m1n/glyphnav/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/z1m1n/glyphnav/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/z1m1n/glyphnav/releases/tag/v0.1.1
