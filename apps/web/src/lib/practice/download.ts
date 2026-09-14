/**
 * The browser half of slice 5b's export: turning the payload `transfer.ts`
 * builds into a file on the user's disk. Local-first means the "backup" is a
 * `Blob` and an anchor click — nothing leaves the machine, and there is no
 * endpoint to leave it through.
 *
 * It lives beside the store rather than in a component because two screens run
 * the same action (`/settings` → Data and `/progress`'s `Export JSON`), and a
 * copy-pasted download is how the two would drift. It is not a component and
 * imports none (ADR §9); reading the DOM is as allowed here as reading
 * IndexedDB is in `store.svelte.ts`.
 */

import { settings } from '$lib/storage/settings.svelte';
import { practice } from './store.svelte';
import {
  buildPracticeFile,
  exportFilename,
  serialisePracticeFile,
} from './transfer';

/** Save text to a file the user chooses a home for. */
export function downloadText(
  filename: string,
  text: string,
  type = 'application/json',
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Firefox only follows a click on a connected element.
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been dispatched, not during it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Write the practice payload out, and remember when. Both halves re-read
 * storage first — queued attempt writes are allowed to land (`practice.sync`)
 * and settings are parsed fresh (`settings.read`, because `hydrate()` is
 * one-shot and another tab may have moved on) — so the file is what is
 * *stored*, not what this tab happened to load.
 */
export async function exportPracticeData(
  exportedAt: number = Date.now(),
): Promise<{ attempts: number; skills: number }> {
  await practice.sync();
  const file = buildPracticeFile({
    settings: settings.read(),
    data: { attempts: practice.attempts, skills: practice.skills },
    exportedAt,
  });
  downloadText(exportFilename(file.exportedAt), serialisePracticeFile(file));
  // Stamped onto storage, not onto this tab's snapshot: we read storage two
  // lines ago precisely because the two can disagree, and recording one field
  // must not write a stale copy of every other one back over another tab.
  settings.patchStored({ lastExportAt: file.exportedAt });
  return { attempts: file.attempts.length, skills: file.skills.length };
}
