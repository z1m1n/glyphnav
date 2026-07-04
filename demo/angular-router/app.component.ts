import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { GLYPHNAV } from 'glyphnav/angular-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { GlyphnavLinkDirective } from './glyphnav-link.directive';
import {
  CONTROL_TOOLTIPS,
  createHistoryToggle,
  currentUrl,
  DEFAULT_TOOLBAR,
  durationToSlider,
  glyphnavOptions,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
  SPEED_SLIDER,
  TOOLBAR_SELECTS,
} from '../shared/content';
import { initCodeBlocks } from '../shared/code-blocks';
import { initFwMenu } from '../shared/fw-menu';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';
import logoSrc from '../shared/logo.svg';

/** This page's own localStorage key — not shared with the other demos. */
const STORE_KEY = 'angular-router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlyphnavLinkDirective],
  template: `
    <h1>
      <img class="glyph-mark" [src]="logo" alt="" />
      <a [href]="base" data-glyphnav="off">glyphnav</a>
      <span class="sep">/</span>
      <span class="crumb">angular-router</span>
      <button type="button" class="fw-switch" aria-label="Switch demo" aria-expanded="false" aria-controls="fw-menu"></button>
    </h1>

    <p class="bar" [class.resolving]="resolving()">
      Watch the address bar. Current path: <span class="path">{{ path() }}</span>
    </p>

    <nav aria-label="demo pages">
      <a [href]="appBase" glyphnavLink="/" [class.active]="active() === '/'">Home</a>
      <a [href]="appBase + 'about'" glyphnavLink="/about" [class.active]="active() === '/about'"
        >About</a
      >
      <a [href]="appBase + 'docs'" glyphnavLink="/docs" [class.active]="active() === '/docs'"
        >Docs</a
      >
      <a [href]="appBase + 'blog'" glyphnavLink="/blog" [class.active]="active() === '/blog'"
        >Blog</a
      >
    </nav>

    <nav class="deep" aria-label="deep links">
      deep links:
      <a [href]="appBase + 'about?ref=deep&page=2'" glyphnavLink="/about?ref=deep&page=2">?query</a>
      <a [href]="appBase + 'docs#options'" glyphnavLink="/docs#options">#hash</a>
      <a [href]="appBase + 'about?q=glyph#results'" glyphnavLink="/about?q=glyph#results"
        >?query+#hash</a
      >
    </nav>

    <div class="controls">
      <label [attr.data-tip]="tips.charset"
        >charset
        <select [value]="charset()" (change)="onCharset($event)">
          @for (o of selects.charset; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>
      </label>
      <label [attr.data-tip]="tips.speed"
        >speed
        <input
          type="range"
          [min]="slider.min"
          [max]="slider.max"
          [step]="slider.step"
          [value]="durationToSlider(duration())"
          [attr.aria-valuetext]="duration() + 'ms'"
          (input)="onSpeed($event)"
        />
        <span class="ms">{{ duration() }}ms</span>
      </label>
      <label [attr.data-tip]="tips.effect"
        >effect
        <select [value]="effect()" (change)="onEffect($event)">
          @for (o of selects.effect; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>
      </label>
      <label [attr.data-tip]="tips.commit"
        >commit
        <select [value]="commit()" (change)="onCommit($event)">
          @for (o of selects.commit; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>
      </label>
      <label [attr.data-tip]="tips.scope"
        >scope
        <select [value]="scope()" (change)="onScope($event)">
          @for (o of selects.scope; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </select>
      </label>
      <label class="toggle" [attr.data-tip]="tips.backForward">
        <input type="checkbox" [checked]="backForward()" (change)="onBackForward($event)" />
        back/forward
      </label>
    </div>

    <router-outlet></router-outlet>

    <p class="foot">
      The <code>[glyphnavLink]</code> directive is copied from this demo into your app and calls the
      injected navigator. Compiled with Angular JIT inside the shared playground — the title link is
      a plain full-page load back to the picker.
    </p>
  `,
})
export class AppComponent {
  private readonly nav = inject(GLYPHNAV);

  // '/' in dev, '/glyphnav/' on the deployed project page. The glyphnavLink
  // directive routes base-aware on its own; these drive the visible hrefs.
  readonly base = import.meta.env.BASE_URL;
  readonly appBase = `${this.base}angular-router/`;
  // The shared glyphnav logo mark, shown before the wordmark in the breadcrumb.
  readonly logo = logoSrc;

  // Restore this page's toolbar (charset is the option key; resolved to a glyph
  // pool only when handing options to the controller). Not shared with other demos.
  private readonly saved = loadToolbar(STORE_KEY, DEFAULT_TOOLBAR);

  readonly path = signal(currentUrl());
  readonly resolving = signal(false);
  readonly active = signal('/');
  readonly tips = CONTROL_TOOLTIPS;
  readonly selects = TOOLBAR_SELECTS;
  readonly slider = SPEED_SLIDER;

  readonly charset = signal(this.saved.charset);
  readonly duration = signal(this.saved.duration);
  readonly effect = signal<GlyphEffect>(this.saved.effect);
  readonly commit = signal<CommitTiming>(this.saved.commit);
  readonly scope = signal<AnimateScope>(this.saved.scope);
  readonly backForward = signal(this.saved.backForward);

  // Back/forward animation is opt-in; the checkbox attaches/detaches the
  // popstate listener (the cleanup returned by enableHistoryAnimation).
  private readonly toggleHistory = createHistoryToggle(() =>
    this.nav.controller.enableHistoryAnimation(),
  );

  // Exposed for the template's inverted speed slider.
  readonly durationToSlider = durationToSlider;

  constructor() {
    this.apply();
    // Wire the theme switcher + styled control tooltips + code-block helpers once.
    initTheme();
    initTooltips();
    initCodeBlocks();
    // The framework menu hooks into the rendered breadcrumb, so it must wait
    // for the template (the other inits are DOM-independent or delegated),
    // and it injects into this component's DOM, so it unhooks on destroy.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(initFwMenu()));
    this.toggleHistory(this.backForward());
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Keep the full URL (incl. query/hash) so a deep link like
        // /about?ref=deep never matches a plain tab target ('/about') below.
        this.active.set(event.urlAfterRedirects);
      }
    });
  }

  private apply(): void {
    this.nav.controller.update(
      glyphnavOptions(
        {
          charset: this.charset(),
          duration: this.duration(),
          effect: this.effect(),
          commit: this.commit(),
          scope: this.scope(),
        },
        (p, r) => {
          this.path.set(p);
          this.resolving.set(r);
        },
      ),
    );
    this.persist();
  }

  private persist(): void {
    saveToolbar(STORE_KEY, {
      charset: this.charset(),
      duration: this.duration(),
      effect: this.effect(),
      commit: this.commit(),
      scope: this.scope(),
      backForward: this.backForward(),
    });
  }

  onCharset(event: Event): void {
    this.charset.set((event.target as HTMLSelectElement).value);
    this.apply();
  }

  onSpeed(event: Event): void {
    // Slider is inverted: full right = 20 ms (fastest whole animation).
    this.duration.set(sliderToDuration(Number((event.target as HTMLInputElement).value)));
    this.apply();
  }

  onEffect(event: Event): void {
    this.effect.set((event.target as HTMLSelectElement).value as GlyphEffect);
    this.apply();
  }

  onCommit(event: Event): void {
    this.commit.set((event.target as HTMLSelectElement).value as CommitTiming);
    this.apply();
  }

  onScope(event: Event): void {
    this.scope.set((event.target as HTMLSelectElement).value as AnimateScope);
    this.apply();
  }

  onBackForward(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.backForward.set(on);
    this.toggleHistory(on);
    this.persist();
  }
}
