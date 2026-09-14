/**
 * The leave paths of the practice write queue (ticket: an attempt can be lost
 * if you answer and immediately navigate).
 *
 * `practice.record()` returns before its IndexedDB transaction commits — by
 * design, because the runner's callback runs while audio is being scheduled.
 * The cost is a race at the door: answer, click a nav link or close the tab,
 * and the transaction may never have run. So the queue is drained wherever the
 * user leaves, and nowhere else:
 *
 * - **client-side navigation** — SvelteKit's `onNavigate`, wired in the root
 *   layout, which awaits what the hook returns;
 * - **`visibilitychange` → `hidden`** — the last moment a browser guarantees
 *   us, and the one that fires when a tab is switched away from or closed on
 *   mobile;
 * - **`pagehide`** — a reload, a back/forward, a closing window.
 *
 * The two document events cannot be awaited: nothing may hold a page that is
 * going away. Starting the drain there is still what makes the write land —
 * the browser keeps a running IndexedDB transaction alive, it is a *pending*
 * one behind an open that would be dropped.
 *
 * Kept out of the layout so it can be tested without mounting the app, and out
 * of `store.svelte.ts` so the store stays a plain data structure with no DOM.
 */

/** Just enough of `Window` to attach to — a test passes a stub. */
export interface LeaveTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  document: { visibilityState: string };
}

/**
 * Call `flush` whenever the page is being left. Returns the detach function,
 * so the layout can hand it straight back from `onMount`.
 *
 * `flush` is fired and not awaited: these handlers must return immediately
 * (`pagehide` above all), and the flush itself is a no-op when nothing is
 * queued, so a tab switched back and forth costs nothing.
 */
export function attachFlushOnLeave(
  target: LeaveTarget,
  flush: () => void,
): () => void {
  const onVisibilityChange = () => {
    // Becoming *visible* is not leaving, and flushing then would be the one
    // case where a drill is on screen while we wait.
    if (target.document.visibilityState === 'hidden') flush();
  };
  const onPageHide = () => flush();

  // `visibilitychange` is dispatched at the document and bubbles, so a window
  // listener sees it; `pagehide` is dispatched at the window and never
  // reaches the document. One target, both events.
  target.addEventListener('visibilitychange', onVisibilityChange);
  target.addEventListener('pagehide', onPageHide);

  return () => {
    target.removeEventListener('visibilitychange', onVisibilityChange);
    target.removeEventListener('pagehide', onPageHide);
  };
}
