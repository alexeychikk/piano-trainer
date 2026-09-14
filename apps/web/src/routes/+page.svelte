<script lang="ts">
  // Home / "Practice now" (UX spec §3, re-skinned by the sci-fi visual
  // language §8). The regions and the copy are the spec's; only the treatment
  // is new. With the first exercise registered (slice 4) the hero starts a
  // drill, and since slice 5a the cards' mastery pips are real. The length
  // control, the Today card, the due counts and the hero's "with data" copy
  // all need the session planner (slice 9), so until then the hero keeps the
  // copy deck's empty-state wording and the Today card is the "How this works"
  // well the spec prescribes for the empty state.
  import { base } from '$app/paths';
  import { DEFAULT_EXERCISE_ID, EXERCISES } from '$lib/exercises/registry';
  import { midiInput } from '$lib/midi/input.svelte';
  import { practice } from '$lib/practice/store.svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MasteryPips from '$lib/components/hud/MasteryPips.svelte';
  import IconKeyboard from '$lib/components/icons/IconKeyboard.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';
</script>

<svelte:head>
  <title>Practice · piano-trainer</title>
</svelte:head>

{#snippet playGlyph()}
  <IconPlay size="1.1em" />
{/snippet}

<h1>Ready to practise</h1>

<div class="hero-row">
  <div class="hero-col">
    <Button
      variant="primary"
      size="hero"
      block
      href={`${base}/practice/${DEFAULT_EXERCISE_ID}/`}
      sub="Ten minutes is enough"
      glyph={playGlyph}
    >
      Start your first session
    </Button>
  </div>

  <aside class="side">
    <HudPanel header="How this works" chamfer="md" well padding="md">
      <p class="how">
        Sit at your piano. Connect it, or use the on-screen keyboard. You answer
        by playing — space replays the sound.
      </p>
    </HudPanel>
  </aside>
</div>

<section class="drill">
  <h2>Or drill one thing</h2>
  <ul class="cards">
    {#each EXERCISES as exercise (exercise.id)}
      <li>
        <HudPanel
          href={`${base}/practice/${exercise.id}/`}
          chamfer="md"
          padding="md"
        >
          <span class="card">
            <span class="title">{exercise.title}</span>
            <span class="desc">{exercise.description}</span>
            <span class="foot">
              <!-- Real mastery from the practice log (slice 5a); an exercise
                   nothing has been practised in is honestly `new`. -->
              <MasteryPips
                mastery={practice.masteryFor(
                  exercise.skillsCovered(exercise.defaultSettings),
                )}
                skill={exercise.title}
              />
              {#if exercise.requiresMidi && !midiInput.connected}
                <span class="needs">
                  <IconKeyboard /> Needs a MIDI keyboard
                </span>
              {/if}
            </span>
          </span>
        </HudPanel>
      </li>
    {/each}
  </ul>
</section>

<style>
  .hero-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    margin-top: var(--space-6);
  }

  .hero-col {
    flex: 1 1 420px;
    max-width: 640px; /* UX spec §3: the hero never grows past 640 px. */
  }

  .side {
    flex: 0 1 320px;
  }

  .how {
    font-size: var(--fs-body);
    color: var(--text-2);
  }

  .drill {
    margin-top: var(--space-7);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
  }

  .cards li {
    /* UX spec §3: exercise cards are 320 × 140. */
    width: 320px;
    min-height: 140px;
  }

  .cards li :global(.panel) {
    height: 100%;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
  }

  /* Card titles stay sentence case — uppercase stops at 20 px (§4.2). */
  .title {
    font-family: var(--font-display);
    font-size: var(--fs-h2);
    font-weight: var(--fw-semibold);
    line-height: var(--lh-snug);
    color: var(--text-1);
  }

  .desc {
    font-size: var(--fs-small);
    color: var(--text-2);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-top: auto;
  }

  .needs {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-small);
    color: var(--text-3);
  }
</style>
