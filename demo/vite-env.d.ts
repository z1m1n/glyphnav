// Minimal typing for the `import.meta.env.BASE_URL` the demos read to stay
// base-aware ('/' in dev, '/glyphnav/' on the deployed project page). Vite
// substitutes the value at build time. Kept narrow on purpose so the demo
// tsconfigs can stay on `"types": []`.
interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
