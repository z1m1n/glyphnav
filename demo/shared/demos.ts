/**
 * The canonical demo catalog — the single source of truth for "which demos
 * exist", kept here instead of hard-coded inside a feature file. The masthead
 * framework switcher (demo/shared/fw-menu.ts) builds its menu from this list.
 *
 * Order is picker order. **Adding a demo?** Add an entry here, then the two
 * pieces this can't own: a card in `demo/index.html` and the framework's
 * accent hue + `[data-fw]` icon rule in `demo/shared/styles.css`.
 */

/** One demo in the catalog. */
export interface DemoEntry {
  /** Breadcrumb / path segment — must equal the demo page's `.crumb` text. */
  readonly name: string;
  /** `[data-fw]` key (see styles.css): selects the accent hue + framework icon. */
  readonly fw: string;
}

/** Every demo, in picker order. */
export const DEMOS: readonly DemoEntry[] = [
  { name: 'vanilla', fw: 'vanilla' },
  { name: 'core', fw: 'core' },
  { name: 'vue-router', fw: 'vue-router' },
  { name: 'react-router', fw: 'react-router' },
  { name: 'solid-router', fw: 'solid-router' },
  { name: 'tanstack-router/react', fw: 'tanstack-react' },
  { name: 'tanstack-router/solid', fw: 'tanstack-solid' },
  { name: 'angular-router', fw: 'angular-router' },
  { name: 'preact-iso', fw: 'preact-iso' },
  { name: 'next', fw: 'next' },
  { name: 'nuxt', fw: 'nuxt' },
  { name: 'sveltekit', fw: 'sveltekit' },
];
