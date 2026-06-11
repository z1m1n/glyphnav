// Lets plain `tsc` resolve `*.vue` imports (e.g. `import App from './App.vue'`).
// Full single-file-component type-checking is handled by Volar / vue-tsc, not
// by this declaration.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
