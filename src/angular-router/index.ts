/**
 * Adapter for the Angular Router.
 *
 * Why no `@Injectable`/`@Directive` here: this library is compiled by Vite,
 * not Angular's `ngtsc`, so shipping decorated classes would produce code
 * Angular's runtime refuses to use. Instead the module exports compiler-free
 * pieces that work in any Angular build; for an attribute directive
 * (`[glyphnavLink]`), copy the snippet from the Angular demo into your app,
 * where your own compiler processes it.
 *
 * Nothing is patched globally: only navigations made through the navigator
 * animate.
 */
import { Location } from '@angular/common';
import { InjectionToken } from '@angular/core';
import type { Provider } from '@angular/core';
import { Router } from '@angular/router';
import type { NavigationExtras, UrlTree } from '@angular/router';
import { GlyphnavController } from '../core';
import type { GlyphnavOptions, RunResult } from '../core';

export type AngularGlyphnavOptions = GlyphnavOptions;

/** An Angular-aware navigator that animates before delegating to the Router. */
export interface GlyphnavNavigator {
  /** The underlying controller (e.g. for `cancel()` / `update()`). */
  readonly controller: GlyphnavController;
  /** Like `Router.navigateByUrl`, but animated. */
  navigateByUrl: (url: string | UrlTree, extras?: NavigationExtras) => Promise<RunResult>;
  /** Like `Router.navigate`, but animated. */
  navigate: (commands: unknown[], extras?: NavigationExtras) => Promise<RunResult>;
}

/**
 * Bridge a glyphnav controller to an Angular `Router` instance.
 *
 * `prepareUrl` maps a router-internal URL (no base href) to the URL that
 * really lands in the address bar — {@link provideGlyphnav} wires it to
 * `Location.prepareExternalUrl` so apps served under a base href animate the
 * full path. Defaults to identity.
 */
export const createGlyphnavNavigator = (
  router: Router,
  options: AngularGlyphnavOptions = {},
  prepareUrl: (routerUrl: string) => string = (url) => url,
): GlyphnavNavigator => {
  const controller = new GlyphnavController(options);

  return {
    controller,
    navigateByUrl(url, extras) {
      const target = typeof url === 'string' ? url : router.serializeUrl(url);
      return controller.run(
        prepareUrl(target),
        () => router.navigateByUrl(url, extras) as Promise<unknown> as Promise<void>,
      );
    },
    navigate(commands, extras) {
      const tree = router.createUrlTree(commands, extras);
      const target = router.serializeUrl(tree);
      return controller.run(
        prepareUrl(target),
        () => router.navigateByUrl(tree, extras) as Promise<unknown> as Promise<void>,
      );
    },
  };
};

/** Injection token for the shared {@link GlyphnavNavigator}. */
export const GLYPHNAV = new InjectionToken<GlyphnavNavigator>('glyphnav.navigator');

/**
 * Standalone-friendly provider. Add it to your application providers:
 *
 *   bootstrapApplication(App, {
 *     providers: [provideRouter(routes), provideGlyphnav({ charset: MATRIX })],
 *   });
 *
 * then read it anywhere with `inject(GLYPHNAV)`.
 */
export const provideGlyphnav = (options: AngularGlyphnavOptions = {}): Provider[] => {
  return [
    {
      provide: GLYPHNAV,
      useFactory: (router: Router, location: Location) =>
        createGlyphnavNavigator(router, options, (url) => location.prepareExternalUrl(url)),
      deps: [Router, Location],
    },
  ];
};
