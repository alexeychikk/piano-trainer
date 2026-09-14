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

<nav class="rail hud-cut" aria-label="Settings sections">
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
</nav>

<style>
  .rail {
    position: sticky;
    /* §8.1: clear of the sticky top bar, by one step of the scale. */
    top: calc(var(--topbar-h) + var(--space-5));
    padding: var(--space-2);
    background: var(--bg-1);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a {
    display: flex;
    align-items: center;
    /* A 2 px bar that only appears when active would shift the label, so the
       resting state reserves it as transparent. */
    min-height: var(--hit-min);
    padding: 0 var(--space-3);
    border-left: 2px solid transparent;
    color: var(--text-2);
  }

  a:hover {
    color: var(--text-1);
  }

  .active {
    border-left-color: var(--accent);
    box-shadow: var(--glow-accent);
    color: var(--text-1);
  }

  /* The label inherits the link's colour rather than the micro-label default,
     so the three states actually differ. */
  a :global(.micro) {
    color: inherit;
  }
</style>
