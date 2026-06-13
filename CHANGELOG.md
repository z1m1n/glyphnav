# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/z1m1n/glyphnav/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/z1m1n/glyphnav/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/z1m1n/glyphnav/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/z1m1n/glyphnav/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/z1m1n/glyphnav/releases/tag/v0.1.1
