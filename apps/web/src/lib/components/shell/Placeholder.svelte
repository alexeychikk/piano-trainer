<script lang="ts">
  /**
   * Skeleton screen body: a real title plus one honest line about when the
   * screen gets its content. Nothing here pretends to be a working feature.
   */
  interface Props {
    title: string;
    note: string;
    /** Which implementation slice fills this screen in (ADR 0001 §10). */
    slice: number;
  }

  const { title, note, slice }: Props = $props();
</script>

<h1>{title}</h1>
<p class="note">{note}</p>
<p class="slice">Arrives in slice {slice}.</p>

<style>
  .note {
    margin-top: var(--space-4);
    max-width: 60ch;
    font-size: var(--fs-body-lg);
    color: var(--text-2);
  }

  .slice {
    margin-top: var(--space-2);
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
