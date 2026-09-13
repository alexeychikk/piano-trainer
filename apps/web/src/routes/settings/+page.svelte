<script lang="ts">
  /**
   * Settings (UX spec §6.3). Section ids are fixed now because the status
   * chips in the top bar deep-link to them; each section is filled by the
   * slice that owns it.
   */
  const SECTIONS = [
    {
      id: 'midi',
      title: 'MIDI',
      note: 'Device picker, permission state and the keyboard range wizard.',
      slice: 2,
    },
    {
      id: 'sound',
      title: 'Sound',
      note: 'Instrument, volume and the metronome tempo.',
      slice: 3,
    },
    {
      id: 'practice',
      title: 'Practice',
      note: 'Session length, chord settling window and per-exercise settings.',
      slice: 4,
    },
    {
      id: 'data',
      title: 'Data',
      note: 'Export and import your practice data as a JSON file.',
      slice: 5,
    },
  ];
</script>

<svelte:head>
  <title>Settings · piano-trainer</title>
</svelte:head>

<h1>Settings</h1>

{#each SECTIONS as section (section.id)}
  <section id={section.id}>
    <h2>{section.title}</h2>
    <p class="note">{section.note}</p>
    <p class="slice">Arrives in slice {section.slice}.</p>
  </section>
{/each}

<style>
  section {
    margin-top: var(--space-6);
    padding: var(--space-5);
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    max-width: 60ch;
  }

  .note {
    margin-top: var(--space-2);
    color: var(--text-2);
  }

  .slice {
    margin-top: var(--space-2);
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
