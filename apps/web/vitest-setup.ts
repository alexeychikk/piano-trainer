import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver; `bind:clientWidth` (the piano keyboard) needs
// one. Sizes stay 0 in tests, which is fine — geometry is tested separately.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
