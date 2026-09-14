<script lang="ts">
  /**
   * `/session` — the mixed practice session (UX spec §4.8, `sci-fi-screens.md`
   * §9; ADR §10 slice 9b). The **deliberate deviation from ADR §9** the
   * delivery plan records: the session has its own route rather than a fake
   * exercise id.
   *
   * It is the ordinary runner with three things supplied from outside: which
   * exercise each question comes from, which skills it should favour, and how
   * long the whole thing lasts. All three are the planner's
   * (`$lib/practice/planner.ts`, slice 9a) dealt out by the pure
   * `$lib/practice/session.ts`; the frame, the grading and the attempt log are
   * unchanged, so no exercise is special-cased anywhere.
   *
   * The plan is built **when the session opens**, after the practice store has
   * hydrated: a session composed from an empty log would be four `new` skills
   * in registry order and would ignore the schedule entirely.
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import ExerciseRunner from '$lib/components/exercise/ExerciseRunner.svelte';
  import SessionSummary from '$lib/components/session/SessionSummary.svelte';
  import Placeholder from '$lib/components/shell/Placeholder.svelte';
  import { EXERCISES } from '$lib/exercises/registry';
  import { buildPlan } from '$lib/practice/planner';
  import { fallbackSkillLabel } from '$lib/practice/progress';
  import {
    DEFAULT_SESSION_LENGTH_MIN,
    isSessionLength,
    summariseSession,
    type SessionLabels,
  } from '$lib/practice/session';
  import { SessionRun } from '$lib/practice/session.svelte';
  import { practice } from '$lib/practice/store.svelte';
  import { settings } from '$lib/storage/settings.svelte';

  /** The runner is remounted per session, so `Practice again` is a new run. */
  let runId = $state(0);
  let run = $state<SessionRun | null>(null);

  /**
   * The length the user chose on home (UX §3) — a setting, read when the
   * session opens, so the control on home is the only place it is decided.
   */
  function chosenLength(): number {
    const stored = settings.value.sessionLengthMin;
    return isSessionLength(stored) ? stored : DEFAULT_SESSION_LENGTH_MIN;
  }

  function openSession() {
    const plan = buildPlan(
      EXERCISES.map((exercise) => ({
        id: exercise.id,
        skillIds: exercise.skillsCovered(exercise.defaultSettings),
      })),
      practice.byId,
      Date.now(),
    );
    run = new SessionRun({
      exercises: EXERCISES,
      plan,
      lengthMin: chosenLength(),
    });
    runId += 1;
  }

  /** The screen never decodes a skill id — the exercise names its own. */
  const labels: SessionLabels = {
    skillLabel(skillId, exerciseId) {
      const exercise = EXERCISES.find((item) => item.id === exerciseId);
      return (
        exercise?.skillLabel?.(skillId, exercise.defaultSettings) ??
        fallbackSkillLabel(skillId)
      );
    },
    exerciseTitle(exerciseId) {
      return (
        EXERCISES.find((item) => item.id === exerciseId)?.title ?? exerciseId
      );
    },
  };

  const summary = $derived(
    run && run.ended ? summariseSession(run.tally(), labels) : null,
  );

  /**
   * A session nobody answered has nothing to summarise — three zeros and an
   * empty panel would be an odd thing to show someone who pressed `Esc` on
   * the way out. So that one case leaves instead, which is what `Esc` does
   * everywhere else in the app (UX §4.5).
   */
  $effect(() => {
    if (run?.ended && run.answers === 0) void done();
  });
  /** The exercise the session opens on — the runner's initial definition. */
  const firstExercise = $derived(run?.first ?? null);

  onMount(() => {
    // The store is hydrated by the root layout; awaiting it here is the same
    // one-shot call, so the plan is built from the real log and not from an
    // empty one.
    void practice.hydrate().then(openSession);
    // The rail's clock. Half a second is finer than the `mm:ss` it draws, so
    // the readout never looks stuck, and it is idle until the drill starts.
    const timer = setInterval(() => run?.tick(), 500);
    return () => clearInterval(timer);
  });

  async function done() {
    await goto(`${base}/`);
  }
</script>

<svelte:head>
  <title>Session · piano-trainer</title>
</svelte:head>

{#if summary && run}
  <SessionSummary {summary} onAgain={openSession} onDone={() => void done()} />
{:else if run && firstExercise}
  {#key runId}
    <ExerciseRunner definition={firstExercise} session={run} />
  {/key}
{:else if run}
  <!-- No exercise to draw from at all (an empty registry): an honest screen,
       never a broken drill. -->
  <Placeholder
    title="Session"
    note="There is no exercise to practise yet."
    slice={9}
  />
{/if}
