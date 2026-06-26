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

// SVG assets resolve to their (local) URL when imported — the demo breadcrumbs
// import the shared logo this way. (Next types `*.svg` as a static-image object
// via next/image-types and reads `.src`; it doesn't use this declaration.)
declare module '*.svg' {
  const src: string;
  export default src;
}

// Vite's `?raw` suffix inlines a file's contents as a string — the changelog
// demo imports the project CHANGELOG.md this way to render it as markdown.
declare module '*?raw' {
  const content: string;
  export default content;
}
