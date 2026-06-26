import { marked } from 'marked';
// The project changelog is the single source of truth — import it as raw text
// (Vite's `?raw` suffix) and render it to HTML at runtime, so this page never
// drifts from the real release notes.
import changelog from '../../CHANGELOG.md?raw';
import { initTheme } from '../shared/theme';

// Mount the shared light/dark/system theme switcher, like every other demo page.
initTheme();

// The CHANGELOG is authored by us (not user input), so rendering its parsed
// markup is safe. `marked.parse` is synchronous with the default options.
const el = document.getElementById('changelog')!;
el.innerHTML = marked.parse(changelog, { async: false });

// Open the reference links in the changelog (GitHub compare URLs, Keep a
// Changelog, SemVer) in a new tab so they don't navigate away from the demo.
for (const a of el.querySelectorAll('a[href^="http"]')) {
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener');
}
