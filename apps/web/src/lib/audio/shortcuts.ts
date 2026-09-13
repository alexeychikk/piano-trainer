/**
 * The audio half of the global shortcut contract (UX spec §4.5): `m` mutes and
 * unmutes, anywhere. Pure predicate so the rule is tested once; the "ignore it
 * while typing" check belongs to the caller, which already owns
 * `isTypingTarget` for the note keys.
 */

export const MUTE_KEY = 'm';

/** True for an unmodified, non-repeating `m`. */
export function isMuteShortcut(event: KeyboardEvent): boolean {
  if (event.repeat) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.toLowerCase() === MUTE_KEY;
}
