import { beforeEach, describe, expect, it } from 'vitest';
import { BannerStack, MAX_BANNERS } from './banners.svelte';

describe('BannerStack', () => {
  let stack: BannerStack;

  beforeEach(() => {
    stack = new BannerStack();
  });

  it('shows banners in arrival order', () => {
    stack.show('Soundfont unavailable — using the built-in synth.', 'warn');
    stack.show('Could not save this attempt.', 'danger');
    expect(stack.items.map((item) => item.message)).toEqual([
      'Soundfont unavailable — using the built-in synth.',
      'Could not save this attempt.',
    ]);
    expect(stack.items[0].tone).toBe('warn');
  });

  it('stacks at most two — the oldest wins', () => {
    stack.show('one');
    stack.show('two');
    expect(stack.show('three')).toBeNull();
    expect(stack.items).toHaveLength(MAX_BANNERS);
    expect(stack.items.map((item) => item.message)).toEqual(['one', 'two']);
  });

  it('never shows the same message twice', () => {
    const id = stack.show('Device disconnected.');
    expect(stack.show('Device disconnected.')).toBeNull();
    expect(stack.items).toHaveLength(1);
    expect(stack.items[0].id).toBe(id);
  });

  it('dismisses by id and frees a slot', () => {
    const first = stack.show('one');
    stack.show('two');
    stack.dismiss(first!);
    expect(stack.items.map((item) => item.message)).toEqual(['two']);
    expect(stack.show('three')).not.toBeNull();
  });
});
