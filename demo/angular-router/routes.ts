import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Routes } from '@angular/router';
import { highlight } from '../shared/highlight';
import { DOCS_INSTALL } from '../shared/content';

@Component({
  selector: 'app-page',
  template: `<div class="view">
    <article>
      <header class="lead">
        <h2>{{ data.title }}</h2>
        {{ data.body }}
      </header>
    </article>
  </div>`,
})
export class PageComponent {
  readonly data = inject(ActivatedRoute).snapshot.data as { title: string; body: string };
}

@Component({
  selector: 'app-docs',
  template: `
    <div class="view docs">
      <article>
        <header class="lead">
          <h2>Docs</h2>
          Install the package — the Angular Router stays a peer dependency:
        </header>
        <figure>
          <pre><code [innerHTML]="installHtml"></code></pre>
        </figure>
        <figure>
          <figcaption>
            Register the navigator next to your router, then inject it anywhere:
          </figcaption>
          <pre><code [innerHTML]="setupHtml"></code></pre>
        </figure>
        <figure>
          <figcaption id="options">Every entry point accepts the same options object:</figcaption>
          <pre><code [innerHTML]="optionsHtml"></code></pre>
        </figure>
        <aside class="note">
          For an animated link, copy <code>demo/angular-router/glyphnav-link.directive.ts</code>
          into your app — glyphnav ships compiler-free helpers, so the directive must be compiled by
          your own Angular build. Or wrap a Router directly with
          <code>createGlyphnavNavigator(router, options)</code>.
        </aside>
      </article>
    </div>
  `,
})
export class DocsComponent {
  readonly install = DOCS_INSTALL;

  readonly setup = [
    "import { provideGlyphnav, GLYPHNAV } from 'glyphnav/angular-router';",
    '',
    'bootstrapApplication(App, {',
    '  providers: [provideRouter(routes), provideGlyphnav({ duration: 250 })],',
    '});',
    '',
    '// in any component or service:',
    'const nav = inject(GLYPHNAV);',
    "await nav.navigateByUrl('/about?q=42#results');",
    "await nav.navigate(['/users', 42]);",
  ].join('\n');

  readonly optionsCode = [
    '{',
    '  duration: 250,        // total animation time (ms), spread over all frames',
    "  effect: 'scramble',   // 'decode' grows + resolves; 'scramble' bursts, then locks randomly",
    "  commit: 'before',     // navigate instantly, animate on top ('after' = classic order)",
    '  charset: MATRIX,      // glyph pool — URL_SAFE stays readable in the bar',
    "  scope: 'tail',        // animate only the part that differs from the current path",
    '  animatePopState: true, // also animate browser back/forward (opt-in)',
    '}',
  ].join('\n');

  // Angular's [innerHTML] sanitizer keeps the highlighter's <span class> markup.
  readonly installHtml = highlight(this.install);
  readonly setupHtml = highlight(this.setup);
  readonly optionsHtml = highlight(this.optionsCode);
}

export const routes: Routes = [
  {
    path: '',
    component: PageComponent,
    data: {
      title: 'Home',
      body: 'Angular Router edition. provideGlyphnav() registers a navigator you inject as GLYPHNAV; the [glyphnavLink] directive uses it. With commit: "before" the route swaps instantly and the bar animates on top.',
    },
  },
  {
    path: 'about',
    component: PageComponent,
    data: {
      title: 'About',
      body: 'This demo runs inside the shared Vite playground using Angular JIT: @angular/compiler is loaded in the browser, so no separate ngtsc build is needed. The package itself stays compiler-free.',
    },
  },
  { path: 'docs', component: DocsComponent },
  {
    path: 'blog',
    component: PageComponent,
    data: {
      title: 'Blog',
      body: 'The real navigation is still the Angular Router’s — glyphnav only animates the address bar on the way there. Deep links with ?query and #hash animate too: they are just part of the path.',
    },
  },
];
