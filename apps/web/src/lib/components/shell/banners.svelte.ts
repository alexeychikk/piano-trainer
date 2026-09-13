/**
 * Global banner stack (UX spec §2.3): one-line, non-blocking, dismissible,
 * **never** a dialog. At most two are shown at once and the oldest wins — a
 * third banner is dropped rather than pushing a message the user is reading
 * off the screen.
 *
 * This is the project's shared-reactive-state pattern: a class instance
 * exported from a `*.svelte.ts` module, runes only (ADR 0001 §1).
 */

export type BannerTone = 'info' | 'success' | 'warn' | 'danger';

export interface Banner {
  id: string;
  tone: BannerTone;
  /** One short line; it is never a question. */
  message: string;
}

export const MAX_BANNERS = 2;

let nextId = 0;

export class BannerStack {
  items = $state<Banner[]>([]);

  /**
   * Show a banner. Returns its id, or `null` when the stack is full (oldest
   * wins) or the same message is already on screen.
   */
  show(message: string, tone: BannerTone = 'info'): string | null {
    if (this.items.length >= MAX_BANNERS) return null;
    if (this.items.some((item) => item.message === message)) return null;
    const id = `banner-${nextId++}`;
    this.items.push({ id, tone, message });
    return id;
  }

  dismiss(id: string): void {
    this.items = this.items.filter((item) => item.id !== id);
  }

  clear(): void {
    this.items = [];
  }
}

/** The app-wide stack. Components read `banners.items`. */
export const banners = new BannerStack();
