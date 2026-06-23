import { createApp, h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { glyphnav } from 'glyphnav/vue-router';
import { highlight } from '../shared/highlight';
import { DOCS_INSTALL } from '../shared/content';
import App from './App.vue';

/** A view as a render-function component (no runtime template compiler needed). */
const page = (title: string, body: string) => ({
  render: () =>
    h('div', { class: 'view' }, [
      h('article', [h('header', { class: 'lead' }, [h('h2', title), body])]),
    ]),
});

/** A code listing as a captioned `<figure>` vnode. */
const figure = (code: string, caption?: string, id?: string) =>
  h('figure', [
    caption ? h('figcaption', id ? { id } : {}, caption) : null,
    h('pre', h('code', { innerHTML: highlight(code) })),
  ]);

const DOCS_SETUP = `import { glyphnav } from 'glyphnav/vue-router';

const router = createRouter({ history: createWebHistory(), routes });

app.use(router);
app.use(glyphnav, { router, duration: 250, commit: 'before' });
// every <router-link> and router.push() now animates

// prefer to keep router.push untouched? animate explicitly instead:
app.use(glyphnav, { router, intercept: 'none' });
const { push } = useGlyphnavRouter();
await push('/dashboard?tab=2#top');`;

const DOCS_OPTIONS = `app.use(glyphnav, {
  router,
  duration: 250,        // total animation time (ms), spread over all frames
  effect: 'scramble',   // 'decode' grows + resolves; 'scramble' bursts, then locks randomly
  commit: 'before',     // navigate instantly, animate on top ('after' = classic order)
  charset: MATRIX,      // glyph pool — URL_SAFE stays readable in the bar
  scope: 'tail',        // animate only the part that differs from the current path
  animatePopState: true, // also animate browser back/forward (opt-in)
});`;

const docs = {
  render: () =>
    h('div', { class: 'view docs' }, [
      h('article', [
        h('header', { class: 'lead' }, [
          h('h2', 'docs'),
          'Install the package — Vue Router stays a peer dependency:',
        ]),
        figure(DOCS_INSTALL),
        figure(DOCS_SETUP, 'The plugin wraps router.push / router.replace:'),
        figure(DOCS_OPTIONS, 'Every entry point accepts the same options object:', 'options'),
      ]),
    ]),
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL + 'vue-router/'),
  routes: [
    {
      path: '/',
      component: page(
        'home',
        'Vue Router edition. The glyphnav plugin wraps router.push and router.replace, so every <router-link> click animates the address bar. With commit: "navigate first" the route swaps instantly and the bar decodes on top.',
      ),
    },
    {
      path: '/about',
      component: page(
        'about',
        'No guards, no boilerplate: app.use(glyphnav, { router }) is the whole integration. Deep links with ?query and #hash animate too — they are just part of the path.',
      ),
    },
    {
      path: '/features',
      component: page(
        'features',
        'Switch the charset, speed, effect and commit order in the controls — changes apply to the very next navigation via controller.update().',
      ),
    },
    { path: '/docs', component: docs },
  ],
});

createApp(App).use(router).use(glyphnav, { router, duration: 250, commit: 'before' }).mount('#app');
