// vue-tsc needs the TypeScript JS Compiler API, which the Go-native
// typescript@7 no longer ships; run it against the official
// @typescript/typescript6 API package instead (vue-tsc's `run()` accepts the
// tsc script path). typescript6's own lib/tsc.js is a bare-specifier shim
// Volar's runTsc can't follow, so resolve its @typescript/old dependency (an
// alias of the real typescript@6) through typescript6's require context.
// Drop this wrapper once vue-tsc supports TypeScript 7.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const require6 = createRequire(require.resolve('@typescript/typescript6/package.json'));
require('vue-tsc').run(require6.resolve('@typescript/old/lib/tsc.js'));
