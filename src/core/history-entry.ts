// A frame can outlive its controller when the user leaves mid-animation.
// Each native replaceState creates a distinct entry object. Weak keys let the
// browser discard abandoned frames along with their session-history entries.
const frameRoutes = new WeakMap<NavigationHistoryEntry, string>();

function restoreTraversal(event: NavigationCurrentEntryChangeEvent): void {
  if (event.navigationType !== 'traverse') return;
  const entry = window.navigation.currentEntry;
  const path = entry && frameRoutes.get(entry);
  if (path) {
    // currententrychange fires after the traversal commits and before popstate.
    // The router therefore sees the real URL, including its query and fragment.
    const history = window.history;
    History.prototype.replaceState.call(history, history.state, '', path);
  }
}

export function rememberFrame(navigation: Navigation, restoreTo: string): void {
  const entry = navigation.currentEntry;
  if (!entry) return;
  frameRoutes.set(entry, restoreTo);
  // Shared by all controllers in the document. It holds no controller references.
  navigation.addEventListener('currententrychange', restoreTraversal);
}
