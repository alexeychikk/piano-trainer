import { describe, expect, it } from 'vitest';
import { isMuteShortcut } from './shortcuts';

function press(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('isMuteShortcut', () => {
  it('matches a plain m, upper or lower case', () => {
    expect(isMuteShortcut(press({ key: 'm' }))).toBe(true);
    expect(isMuteShortcut(press({ key: 'M', shiftKey: true }))).toBe(true);
  });

  it('leaves browser and OS shortcuts alone', () => {
    expect(isMuteShortcut(press({ key: 'm', metaKey: true }))).toBe(false);
    expect(isMuteShortcut(press({ key: 'm', ctrlKey: true }))).toBe(false);
    expect(isMuteShortcut(press({ key: 'm', altKey: true }))).toBe(false);
  });

  it('ignores auto-repeat, so holding m does not flap the mute', () => {
    expect(isMuteShortcut(press({ key: 'm', repeat: true }))).toBe(false);
  });

  it('ignores every other key', () => {
    expect(isMuteShortcut(press({ key: 'n' }))).toBe(false);
    expect(isMuteShortcut(press({ key: ' ' }))).toBe(false);
  });
});
