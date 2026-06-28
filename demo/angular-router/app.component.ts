import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { GLYPHNAV } from 'glyphnav/angular-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { GlyphnavLinkDirective } from './glyphnav-link.directive';
import {
  charsets,
  CONTROL_TOOLTIPS,
  currentUrl,
  DEFAULT_TOOLBAR,
  durationToSlider,
  loadToolbar,
  saveToolbar,
  sliderToDuration,
} from '../shared/content';
import { initTheme } from '../shared/theme';
import { initTooltips } from '../shared/tooltip';
import logoSrc from '../shared/logo.svg';
import stackIconSrc from '../shared/icons/angular.svg';

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
      <img class="crumb-icon" [src]="stackIcon" alt="" />
      <span class="crumb">angular-router</span>
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
          <option value="url">url-safe</option>
          <option value="hex">hex</option>
          <option value="matrix">matrix</option>
          <option value="symbols">symbols</option>
        </select>
      </label>
      <label [attr.data-tip]="tips.speed"
        >speed
        <input
          type="range"
          min="20"
          max="1000"
          step="10"
          [value]="durationToSlider(duration())"
          [attr.aria-valuetext]="duration() + 'ms'"
          (input)="onSpeed($event)"
        />
        <span class="ms">{{ duration() }}ms</span>
      </label>
      <label [attr.data-tip]="tips.effect"
        >effect
        <select [value]="effect()" (change)="onEffect($event)">
          <option value="decode">decode</option>
          <option value="scramble">scramble</option>
        </select>
      </label>
      <label [attr.data-tip]="tips.commit"
        >commit
        <select [value]="commit()" (change)="onCommit($event)">
          <option value="before">navigate first</option>
          <option value="after">animate first</option>
        </select>
      </label>
      <label [attr.data-tip]="tips.scope"
        >scope
        <select [value]="scope()" (change)="onScope($event)">
          <option value="full">full</option>
          <option value="tail">tail</option>
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
  // The Angular brand mark, shown before the breadcrumb name (the stack's logo).
  readonly stackIcon = stackIconSrc;

  // Restore this page's toolbar (charset is the option key; resolved to a glyph
  // pool only when handing options to the controller). Not shared with other demos.
  private readonly saved = loadToolbar(STORE_KEY, DEFAULT_TOOLBAR);

  readonly path = signal(currentUrl());
  readonly resolving = signal(false);
  readonly active = signal('/');
  readonly tips = CONTROL_TOOLTIPS;

  readonly charset = signal(this.saved.charset);
  readonly duration = signal(this.saved.duration);
  readonly effect = signal<GlyphEffect>(this.saved.effect);
  readonly commit = signal<CommitTiming>(this.saved.commit);
  readonly scope = signal<AnimateScope>(this.saved.scope);
  readonly backForward = signal(this.saved.backForward);

  // Back/forward animation is opt-in; the checkbox attaches/detaches the
  // popstate listener (the cleanup returned by enableHistoryAnimation).
  private stopPopState: (() => void) | null = null;

  // Exposed for the template's inverted speed slider.
  readonly durationToSlider = durationToSlider;

  constructor() {
    this.apply();
    // Wire the theme switcher + styled control tooltips once (idempotent).
    initTheme();
    initTooltips();
    if (this.backForward()) {
      this.stopPopState = this.nav.controller.enableHistoryAnimation();
    }
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Keep the full URL (incl. query/hash) so a deep link like
        // /about?ref=deep never matches a plain tab target ('/about') below.
        this.active.set(event.urlAfterRedirects);
      }
    });
  }

  private apply(): void {
    this.nav.controller.update({
      charset: charsets[this.charset()],
      duration: this.duration(),
      effect: this.effect(),
      commit: this.commit(),
      scope: this.scope(),
      hooks: {
        onFrame: (f) => {
          this.path.set(f.path);
          this.resolving.set(f.phase === 'resolve');
        },
        onComplete: () => {
          this.resolving.set(false);
          this.path.set(currentUrl());
        },
      },
    });
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
    if (on && !this.stopPopState) {
      this.stopPopState = this.nav.controller.enableHistoryAnimation();
    } else if (!on && this.stopPopState) {
      this.stopPopState();
      this.stopPopState = null;
    }
    this.persist();
  }
}
