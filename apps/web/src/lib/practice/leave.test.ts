import { describe, expect, it, vi } from 'vitest';
import { attachFlushOnLeave, type LeaveTarget } from './leave';

/** A window stand-in: no jsdom needed to assert which events we listen to. */
function fakeWindow() {
  const listeners = new Map<string, Set<() => void>>();
  let visibilityState = 'visible';
  const target: LeaveTarget = {
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    document: {
      get visibilityState() {
        return visibilityState;
      },
    },
  };
  return {
    target,
    count: (type: string) => listeners.get(type)?.size ?? 0,
    fire(type: string) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
    hide() {
      visibilityState = 'hidden';
    },
    show() {
      visibilityState = 'visible';
    },
  };
}

describe('attachFlushOnLeave', () => {
  it('flushes when the tab is hidden and when the page goes away', () => {
    const win = fakeWindow();
    const flush = vi.fn();
    attachFlushOnLeave(win.target, flush);

    win.hide();
    win.fire('visibilitychange');
    expect(flush).toHaveBeenCalledTimes(1);

    win.fire('pagehide');
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('does not flush when the tab comes back', () => {
    // Coming *back* is not leaving — and it is the one moment a drill may be
    // on screen, which the ticket keeps writes out of.
    const win = fakeWindow();
    const flush = vi.fn();
    attachFlushOnLeave(win.target, flush);

    win.show();
    win.fire('visibilitychange');
    expect(flush).not.toHaveBeenCalled();
  });

  it('detaches both listeners', () => {
    const win = fakeWindow();
    const flush = vi.fn();
    const detach = attachFlushOnLeave(win.target, flush);
    expect(win.count('visibilitychange')).toBe(1);
    expect(win.count('pagehide')).toBe(1);

    detach();
    expect(win.count('visibilitychange')).toBe(0);
    expect(win.count('pagehide')).toBe(0);

    win.hide();
    win.fire('visibilitychange');
    win.fire('pagehide');
    expect(flush).not.toHaveBeenCalled();
  });
});
