<script lang="ts">
  // Home / "Practice now" (UX spec §3, re-skinned by the sci-fi visual
  // language §8). The regions and the copy are the spec's; only the treatment
  // is new. With the first exercise registered (slice 4) the hero starts a
  // drill, since slice 5a the cards' mastery pips are real, since slice 9a the
  // **scheduler** decides what is due — and since slice 9b the hero opens the
  // **mixed session** the spec always meant it to (`/session`), with the
  // length control beneath it and the Today card beside it.
  //
  // `Space` — or any MIDI key — starts the session from anywhere on this
  // screen (§3): the user's hands are already on the piano.
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { EXERCISES } from '$lib/exercises/registry';
  import { midiInput } from '$lib/midi/input.svelte';
  import { isTypingTarget } from '$lib/midi/keymap';
  import { dueNow, skillsDueToday } from '$lib/practice/copy';
  import { buildPlan } from '$lib/practice/planner';
  import {
    ACCURACY_DAYS,
    accuracyOver,
    dailyCounts,
    normalise,
    streakDays,
  } from '$lib/practice/progress';
  import { SESSION_LENGTHS_MIN } from '$lib/practice/session';
  import { practice } from '$lib/practice/store.svelte';
  import { settings } from '$lib/storage/settings.svelte';
  import Badge from '$lib/components/hud/Badge.svelte';
  import Button from '$lib/components/hud/Button.svelte';
  import Chip from '$lib/components/hud/Chip.svelte';
  import HudPanel from '$lib/components/hud/HudPanel.svelte';
  import MasteryPips from '$lib/components/hud/MasteryPips.svelte';
  import Meter from '$lib/components/hud/Meter.svelte';
  import MicroLabel from '$lib/components/hud/MicroLabel.svelte';
  import IconKeyboard from '$lib/components/icons/IconKeyboard.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';

  /** One clock for the screen, read when it opens — as `/progress` does. */
  const now = Date.now();
  const SESSION_HREF = `${base}/session/`;

  const plan = $derived(
    buildPlan(
      EXERCISES.map((exercise) => ({
        id: exercise.id,
        skillIds: exercise.skillsCovered(exercise.defaultSettings),
      })),
      practice.byId,
      now,
    ),
  );

  /**
   * The copy deck's two hero labels (UX §3): `Start your first session` until
   * there is a history, `Practice now` after — with the spec's own sub-label
   * once the schedule has something to say.
   */
  const started = $derived(practice.attempts.length > 0);
  const heroLabel = $derived(
    started ? 'Practice now' : 'Start your first session',
  );
  const heroSub = $derived(
    plan.dueCount > 0 ? skillsDueToday(plan.dueCount) : 'Ten minutes is enough',
  );

  /** The Today card's three numbers and its 7-day sparkline (UX §3). */
  const todayCounts = $derived(
    dailyCounts(practice.attempts, now, ACCURACY_DAYS),
  );
  const todayAttempts = $derived(todayCounts[todayCounts.length - 1] ?? 0);
  const todayAccuracy = $derived(accuracyOver(practice.attempts, now, 1));
  const dayStreak = $derived(streakDays(practice.attempts, now));
  const sparkline = $derived(normalise(todayCounts));
  const sparklineLabel = $derived(
    `Attempts over the last ${ACCURACY_DAYS} days, ending today: ${todayCounts.join(', ')}`,
  );

  /** UX §3: 5 / 10 / 20 minutes, persisted; arrow keys move the selection. */
  const sessionLength = $derived(settings.value.sessionLengthMin);

  async function startSession() {
    await goto(SESSION_HREF);
  }

  /**
   * `Space` anywhere on `/` starts the session, and so does any MIDI note-on
   * (UX §3) — hands stay on the piano. Ignored while a control is being
   * typed in, and `preventDefault` so `Space` does not also press a focused
   * button; the length radios keep their own arrow keys.
   */
  function onKeyDown(event: KeyboardEvent) {
    if (event.repeat || isTypingTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== ' ') return;
    event.preventDefault();
    void startSession();
  }

  onMount(() => {
    const unsubscribe = midiInput.subscribe((event) => {
      if (event.type === 'on') void startSession();
    });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
    };
  });
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
      href={SESSION_HREF}
      sub={heroSub}
      glyph={playGlyph}
      testId="hero"
    >
      {heroLabel}
      <span class="keycap"><Chip variant="key">Space</Chip></span>
    </Button>

    <!-- UX §3 / part 1 §5.11: the segmented length picker. Native radios, so
         the arrow keys the spec asks for are the platform's own. -->
    <fieldset class="lengths">
      <legend><MicroLabel>Session length</MicroLabel></legend>
      <div class="segments">
        {#each SESSION_LENGTHS_MIN as minutes (minutes)}
          <label class="segment" class:selected={sessionLength === minutes}>
            <input
              type="radio"
              name="session-length"
              value={minutes}
              checked={sessionLength === minutes}
              onchange={() => settings.patch({ sessionLengthMin: minutes })}
            />
            {minutes} min
          </label>
        {/each}
      </div>
    </fieldset>
  </div>

  <aside class="side">
    {#if started}
      <!-- UX §3: three numbers plus the 7-day sparkline. Every one of them is
           `$lib/practice/progress.ts`'s; nothing is computed in the markup. -->
      <HudPanel header="Today" headerAs="h2" chamfer="md" padding="md">
        <p class="today">
          <span class="today-item">
            <span class="today-value tabular">{todayAttempts}</span>
            <MicroLabel>Attempts</MicroLabel>
          </span>
          <span class="today-item">
            <span class="today-value tabular">
              {todayAccuracy === null
                ? '—'
                : `${Math.round(todayAccuracy * 100)}%`}
            </span>
            <MicroLabel>Accuracy</MicroLabel>
          </span>
          <span class="today-item">
            <span class="today-value tabular">{dayStreak}</span>
            <MicroLabel>Day streak</MicroLabel>
          </span>
        </p>
        <div class="spark">
          <Meter
            values={sparkline}
            markIndex={sparkline.length - 1}
            height={40}
            srLabel={sparklineLabel}
          />
          <MicroLabel>Last {ACCURACY_DAYS} days</MicroLabel>
        </div>
      </HudPanel>
    {:else}
      <HudPanel header="How this works" chamfer="md" well padding="md">
        <p class="how">
          Sit at your piano. Connect it, or use the on-screen keyboard. You
          answer by playing — space replays the sound.
        </p>
      </HudPanel>
    {/if}
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
              <!-- UX §3: pips plus `NN%`, `N due` or `new`. The pips carry the
                   first and the last; this is the middle one, and it says the
                   word `due` rather than relying on the amber (§2.3). -->
              {#if (plan.byExercise.get(exercise.id)?.dueCount ?? 0) > 0}
                <Badge tone="warn">
                  {dueNow(plan.byExercise.get(exercise.id)?.dueCount ?? 0)}
                </Badge>
              {/if}
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

  .keycap {
    margin-left: var(--space-2);
  }

  /* The segmented control (part 1 §5.11): one `--bg-well` group, the selected
     segment on `--grad-primary` with white ink — the one place a filled accent
     surface is legal (§9). */
  .lengths {
    margin-top: var(--space-3);
    padding: 0;
    border: none;
  }

  .segments {
    display: inline-flex;
    margin-top: var(--space-2);
    background: var(--bg-well);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .segment {
    display: inline-flex;
    align-items: center;
    min-height: var(--hit-min);
    padding: 0 var(--space-4);
    color: var(--text-2);
    font-family: var(--font-display);
    font-size: var(--fs-body);
    letter-spacing: var(--track-hud);
    cursor: pointer;
  }

  .segment.selected {
    background: var(--grad-primary);
    color: var(--on-accent);
  }

  /* The radio itself is the control — hidden visually, never removed, so the
     arrow keys and the accessible name stay the platform's. */
  .segment input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  /* The global ring, drawn *inside* the group: the segments share one border,
     so an outset ring would cover the neighbour (app.css §focus). */
  .segment:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
  }

  .today {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .today-item {
    display: flex;
    flex-direction: column;
  }

  /* §8: the three numbers are HUD readouts — display, tabular, with the text
     glow; their labels are micro-labels. */
  .today-value {
    font-family: var(--font-display);
    font-size: var(--fs-h1);
    line-height: var(--lh-tight);
    color: var(--text-1);
    text-shadow: var(--glow-text);
  }

  .spark {
    margin-top: var(--space-4);
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
