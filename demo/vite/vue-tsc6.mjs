// vue-tsc needs the TypeScript JS Compiler API, which the Go-native
// typescript@7 no longer ships; run it against the official
// @typescript/typescript6 API package instead (vue-tsc's `run()` accepts the
// tsc script path). vue-tsc resolves the compatibility package's compiler shim
// to the full TypeScript 6 implementation.
// Drop this wrapper once vue-tsc supports TypeScript 7.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('vue-tsc').run(require.resolve('@typescript/typescript6/lib/tsc.js'));
