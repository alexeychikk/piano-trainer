<script lang="ts">
  import { base } from '$app/paths';

  /** Status, not a menu: clicking goes to the matching Settings section. */
  interface Props {
    href: string;
    /** Glyph carries the state too — never colour alone (UX spec §8.1). */
    glyph: string;
    label: string;
    /** Spelled-out accessible name, e.g. 'MIDI: no device found'. */
    srLabel: string;
    tone?: 'muted' | 'success' | 'warn' | 'danger';
  }

  const { href, glyph, label, srLabel, tone = 'muted' }: Props = $props();
</script>

<a
  class="chip"
  class:success={tone === 'success'}
  class:warn={tone === 'warn'}
  class:danger={tone === 'danger'}
  href={`${base}${href}`}
  aria-label={srLabel}
>
  <span class="glyph" aria-hidden="true">{glyph}</span>
  <span class="label">{label}</span>
</a>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: calc(var(--topbar-h) - var(--space-5));
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-2);
    color: var(--text-3);
    font-size: var(--fs-small);
    white-space: nowrap;
  }

  .chip:hover {
    text-decoration: none;
    border-color: var(--accent);
  }

  .success {
    color: var(--success);
  }

  .warn {
    color: var(--warn);
  }

  .danger {
    color: var(--danger);
  }

  .label {
    max-width: 22ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
