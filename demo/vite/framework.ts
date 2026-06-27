import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import type { PluginOption } from 'vite';

/**
 * Packages kept out of Vite's dependency pre-bundle. The Solid routers ship a
 * `solid`-condition entry that is JSX *source*; it must pass through
 * vite-plugin-solid, not esbuild's pre-bundler, so it reaches the Solid compiler
 * intact.
 */
export const SOLID_OPTIMIZE_EXCLUDE = ['@tanstack/solid-router', '@solidjs/router'];

/**
 * The framework compilers for the playground, each scoped to its own demos.
 *
 * React's Babel pass is restricted to the React demos so it never sees Angular's
 * decorators — the Angular demo runs in JIT mode and needs no Vite plugin. Solid
 * has its own JSX runtime, so its compiler is scoped to the Solid demos, disjoint
 * from React's glob. The `solid` resolve condition the plugin adds makes
 * `@tanstack/solid-router` resolve to its JSX source, so that package's `.jsx`
 * files are compiled here too — and excluded from pre-bundling via
 * {@link SOLID_OPTIMIZE_EXCLUDE} so they reach this transform instead of esbuild.
 *
 * @returns The configured Vue, React and Solid plugins.
 */
export function frameworkPlugins(): PluginOption[] {
  return [
    vue(),
    react({ include: /demo\/(react-router|tanstack-router\/react)\/.*\.tsx?$/ }),
    solid({
      include: [
        /demo\/tanstack-router\/solid\/.*\.[tj]sx$/,
        /@tanstack\/solid-router\/.*\.jsx$/,
        /demo\/solid-router\/.*\.[tj]sx$/,
        /@solidjs\/router\/.*\.jsx$/,
      ],
    }),
  ];
}
