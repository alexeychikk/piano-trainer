<script lang="ts">
  /**
   * The sticky section nav UX spec §6.3 always asked for and nobody had built
   * (sci-fi-screens.md §8.1): 160 px, `position: sticky`, four micro-label
   * anchors, the active one marked with a 2 px `--accent` left bar — part 1
   * §6's nav-active rule, rotated 90°.
   *
   * The links are plain anchors, so deep links and the keyboard work with the
   * observer switched off; the observer only *decorates* them. Below 1100 px
   * the rail is not rendered and the sections stand in DOM order.
   */
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';

  interface Props {
    /** Section ids, in page order — the same ids the top-bar chips link to. */
    sections: { id: string; label: string }[];
  }

  const { sections }: Props = $props();

  let active = $state('');

  $effect(() => {
    const elements = sections
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    // Fall back to the hash the page was opened on, so a deep link is marked
    // before the observer has seen anything; otherwise the first section.
    const hash = location.hash.replace('#', '');
    active = sections.some((section) => section.id === hash)
      ? hash
      : (sections[0]?.id ?? '');

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) active = visible[0].target.id;
      },
      // Biased to the top: the section under the top bar is the one you are
      // reading, not whichever happens to be tallest.
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  });
</script>

<nav class="rail" aria-label="Settings sections">
  <!-- A panel, so glow → edge → face as everywhere else (§8.1). The face is
       padded, so a link's focus ring never reaches the chamfered corner. -->
  <span class="edge hud-cut">
    <span class="face hud-cut">
      <ul>
        {#each sections as section (section.id)}
          <li>
            <a
              href="#{section.id}"
              class:active={active === section.id}
              aria-current={active === section.id ? 'true' : undefined}
              onclick={() => (active = section.id)}
            >
              <MicroLabel>{section.label}</MicroLabel>
            </a>
          </li>
        {/each}
      </ul>
    </span>
  </span>
</nav>

<style>
  .rail {
    position: sticky;
    /* §8.1: clear of the sticky top bar, by one step of the scale. */
    top: calc(var(--topbar-h) + var(--space-5));
  }

  .edge {
    display: flex;
    background: var(--panel-border);
  }

  .face {
    flex: 1;
    /* The 1 px inset *is* the edge: clip-path would eat a real border. */
    margin: 1px;
    padding: var(--space-2);
    background: var(--grad-panel);
    background-color: var(--bg-1);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--hit-min);
    /* §8.1's 2 px active bar is reserved in the padding, so marking an item
       never shifts its label (the literal 2 px is the spec's own). */
    padding: 0 var(--space-3) 0 calc(var(--space-3) + 2px);
    color: var(--text-2);
  }

  a:hover {
    color: var(--text-1);
  }

  .active {
    color: var(--text-1);
  }

  /* The glow belongs to the bar, not to the link's rectangle. */
  .active::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: var(--accent);
    box-shadow: var(--glow-accent);
  }

  /* The label inherits the link's colour rather than the micro-label default,
     so the three states actually differ. */
  a :global(.micro) {
    color: inherit;
  }
</style>
