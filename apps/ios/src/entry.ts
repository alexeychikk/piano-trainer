/**
 * The bundled shim (`pnpm --filter ios build:shim` → `dist/web-midi-shim.js`,
 * one IIFE). `AppViewController` adds it as a document-start `WKUserScript`
 * after Capacitor's own bridge scripts (ADR 0005 §3.3), so
 * `window.Capacitor` already exists when it runs. This is the only file that
 * touches Capacitor; the logic is in `web-midi-shim.ts` (Web MIDI over
 * `CoreMidi`) and `file-share.ts` (downloads over `FileShare`, §6).
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  FILE_SHARE_PLUGIN,
  installFileShare,
  shouldInstallFileShare,
  type FileSharePlugin,
} from './file-share';
import {
  PLUGIN_NAME,
  installWebMidiShim,
  shouldInstall,
  type CoreMidiPlugin,
} from './web-midi-shim';

if (
  shouldInstall({
    navigator,
    isNativePlatform: Capacitor.isNativePlatform(),
    pluginAvailable: Capacitor.isPluginAvailable(PLUGIN_NAME),
  })
) {
  installWebMidiShim(navigator, registerPlugin<CoreMidiPlugin>(PLUGIN_NAME));
}

if (
  shouldInstallFileShare({
    isNativePlatform: Capacitor.isNativePlatform(),
    pluginAvailable: Capacitor.isPluginAvailable(FILE_SHARE_PLUGIN),
  })
) {
  installFileShare(window, registerPlugin<FileSharePlugin>(FILE_SHARE_PLUGIN));
}
