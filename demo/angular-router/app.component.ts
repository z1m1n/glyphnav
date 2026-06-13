import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { GLYPHNAV } from 'glyphnav/angular-router';
import type { AnimateScope, CommitTiming, GlyphEffect } from 'glyphnav/core';
import { GlyphnavLinkDirective } from './glyphnav-link.directive';
import { charsets, currentUrl, durationToSlider, sliderToDuration } from '../shared/content';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlyphnavLinkDirective],
  template: `
    <h1>
      <a [href]="base" data-glyphnav="off">glyphnav</a>
      <span class="crumb">&ngsp;/ angular-router</span>
    </h1>

    <p class="bar" [class.resolving]="resolving()">
      Watch the address bar. Current path: <span class="path">{{ path() }}</span>
    </p>

    <nav>
      <a [href]="appBase" glyphnavLink="/" [class.active]="active() === '/'">home</a>
      <a [href]="appBase + 'about'" glyphnavLink="/about" [class.active]="active() === '/about'"
        >about</a
      >
      <a [href]="appBase + 'docs'" glyphnavLink="/docs" [class.active]="active() === '/docs'"
        >docs</a
      >
      <a [href]="appBase + 'blog'" glyphnavLink="/blog" [class.active]="active() === '/blog'"
        >blog</a
      >
    </nav>

    <p class="deep">
      deep links:
      <a [href]="appBase + 'about?ref=deep&page=2'" glyphnavLink="/about?ref=deep&page=2">?query</a>
      <a [href]="appBase + 'docs#options'" glyphnavLink="/docs#options">#hash</a>
      <a [href]="appBase + 'about?q=glyph#results'" glyphnavLink="/about?q=glyph#results"
        >?query+#hash</a
      >
    </p>

    <div class="controls">
      <label
        >charset
        <select (change)="onCharset($event)">
          <option value="url">url-safe</option>
          <option value="hex">hex</option>
          <option value="matrix">matrix</option>
          <option value="symbols">symbols</option>
        </select>
      </label>
      <label
        >speed
        <input
          type="range"
          min="20"
          max="1000"
          step="10"
          [value]="durationToSlider(duration())"
          (input)="onSpeed($event)"
        />
        <span class="ms">{{ duration() }}ms</span>
      </label>
      <label
        >effect
        <select (change)="onEffect($event)">
          <option value="decode">decode</option>
          <option value="scramble">scramble</option>
        </select>
      </label>
      <label
        >commit
        <select (change)="onCommit($event)">
          <option value="before">navigate first</option>
          <option value="after">animate first</option>
        </select>
      </label>
      <label
        >scope
        <select (change)="onScope($event)">
          <option value="full">full</option>
          <option value="tail">tail</option>
        </select>
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

  readonly path = signal(currentUrl());
  readonly resolving = signal(false);
  readonly active = signal('/');
  readonly duration = signal(250);

  // Exposed for the template's inverted speed slider.
  readonly durationToSlider = durationToSlider;

  private charset = charsets.url;
  private effect: GlyphEffect = 'decode';
  private commit: CommitTiming = 'before';
  private scope: AnimateScope = 'full';

  constructor() {
    this.apply();
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.active.set(event.urlAfterRedirects.split(/[?#]/)[0]);
      }
    });
  }

  private apply(): void {
    this.nav.controller.update({
      charset: this.charset,
      duration: this.duration(),
      effect: this.effect,
      commit: this.commit,
      scope: this.scope,
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
  }

  onCharset(event: Event): void {
    this.charset = charsets[(event.target as HTMLSelectElement).value];
    this.apply();
  }

  onSpeed(event: Event): void {
    // Slider is inverted: full right = 20 ms (fastest whole animation).
    this.duration.set(sliderToDuration(Number((event.target as HTMLInputElement).value)));
    this.apply();
  }

  onEffect(event: Event): void {
    this.effect = (event.target as HTMLSelectElement).value as GlyphEffect;
    this.apply();
  }

  onCommit(event: Event): void {
    this.commit = (event.target as HTMLSelectElement).value as CommitTiming;
    this.apply();
  }

  onScope(event: Event): void {
    this.scope = (event.target as HTMLSelectElement).value as AnimateScope;
    this.apply();
  }
}
