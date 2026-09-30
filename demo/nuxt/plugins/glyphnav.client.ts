// Client-only: glyphnav rewrites the address bar via history.replaceState, so it
// must not run during prerender. `installGlyphnav` wraps router.push/replace, so
// every <NuxtLink> click and navigateTo() call navigates first, then animates.
// The instance is exposed as `useNuxtApp().$glyphnav`.
import { installGlyphnav } from 'glyphnav/nuxt';

export default defineNuxtPlugin((nuxtApp) => {
  installGlyphnav(
    {
      $router: useRouter(),
      provide: (name, value) => nuxtApp.provide(name, value),
      vueApp: nuxtApp.vueApp,
    },
    { duration: 250, commit: 'before', historyMode: 'history' },
  );
});
