import { defineConfig } from 'vitest/config';

// Node has `EventTarget`, `Event` and `DOMException`, which is all the shim
// needs; the navigator and the plugin are fakes the tests pass in.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
