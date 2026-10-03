/**
 * Exercise #6 — "Rootless voicings" (slice 11): a chord symbol and a form
 * appear, the root sounds underneath as a bass reference, and the user plays
 * the **rootless A or B voicing**. The second playing drill, and the rung
 * above slice 8's shells in product pillar 2 (chords & voicings).
 *
 * **The voicing set is the rootless pair**: `A` = 3-5-7-9, `B` = 7-9-3-5, one
 * hand, no root. `$lib/theory/voicings.ts` owns the vocabulary — an exercise
 * never spells a chord itself. Guide tones are their own slice, and the
 * deferred two-hand voicing colours still are: nothing upstream tells the app
 * which hand a note came from (ADR §3: a `NoteEvent` carries a source, never a
 * hand), so this drill is one-handed by construction like slice 8's.
 *
 * **The graded quantity is the voicing in the asked key and form.** A and B
 * are the *same four pitch classes* — the form is which one is underneath — so
 * `grade()` is `spellsRootless()`: the pitch classes played must be exactly
 * the voicing's four, and the lowest note played must be the form's own bass
 * degree (the 3rd for A, the 7th for B).
 *
 * - **root** — must **not** be played. That is what rootless means: the bass
 *   player has it, and the left hand spends its four notes on colour instead.
 *   Playing it is the commonest near-miss in the drill, so it is a *named*
 *   one (`missDetail`), never a bare ✗.
 * - **octave / register / spacing** — any, for the shape and for each note in
 *   it, exactly as slice 8.
 * - **order** — any: the answer closes on four note-ons and grading is
 *   order-insensitive, so a rolled, arpeggiated or block voicing grade the
 *   same. (Which note is *lowest* is not order — it is the form.)
 * - **doubling** — fails: the answer is four notes long, so a doubled note
 *   always leaves a chord tone unplayed (slices 7, 8 and 10's rule).
 * - **enharmonics** — equal for free: integer arithmetic on MIDI numbers.
 *
 * Scoring is **binary** (ADR §10), like every other drill: three quarters of a
 * voicing is not a voicing, and partial credit would report a key as
 * half-learned to the mastery EWMA.
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, settings, range)` and both are
 * unit-tested without a browser (ADR §5).
 */

import {
  MIDDLE_C,
  ROOTLESS_FORMS,
  chordSymbolText,
  hasRootless,
  intervalsAboveBass,
  isChordQuality,
  isRootlessForm,
  pcOf,
  qualityOfIntervals,
  rootlessBassDegree,
  rootlessBassOffset,
  rootlessDegrees,
  rootlessNotesFromBass,
  rootlessOfIntervalsAboveBass,
  rootlessPitchClasses,
  rootlessSpan,
  spellsRootless,
  spellsRootlessInAnyInversion,
  spellsShellInAnyInversion,
  type ChordQuality,
  type Midi,
  type PitchClass,
  type RootlessForm,
} from '$lib/theory';
import {
  NothingToAskError,
  PITCH_CLASSES,
  buildableTarget,
  pitchClassesIn,
} from '../coverage';
import {
  choose,
  drawAvoidingRepeat,
  drawKeyed,
  lowestFrom,
  occurrences,
  pickOccurrence,
  referenceThenReveal,
  spellings,
} from '../draw';
import { pitchClassSegment, skillIdSegments } from '../skill-id';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
  KeyRange,
  Question,
  SkillId,
} from '../types';

export const ROOTLESS_VOICING_ID = 'rootless-voicing';

export interface RootlessVoicingPayload {
  /** The key asked for — the root the voicing is named from and never plays. */
  rootPc: PitchClass;
  /** Where the bass reference sounds: the root, below the voicing. */
  rootMidi: Midi;
  quality: ChordQuality;
  form: RootlessForm;
  /** The lowest note of the asked voicing — the form's bass degree. */
  bassMidi: Midi;
}

/**
 * A **type alias**, not an `interface`: the registry's erased `AnyExercise`
 * types settings as `Record<string, unknown>`, and only an alias gets the
 * implicit index signature that makes it assignable (`types.ts`).
 */
export type RootlessVoicingSettings = {
  /** The qualities in play, in no particular order. */
  qualities: readonly ChordQuality[];
};

/**
 * The starter set: slice 8's three, which are also the ii-V-I's own
 * vocabulary. `minMaj7` has a rootless voicing too (`voicings.ts` builds it),
 * but it belongs to the melodic-minor world a beginner meets much later, so it
 * is registered vocabulary and not a drilled default.
 */
export const STARTER_QUALITIES: readonly ChordQuality[] = [
  'maj7',
  'dom7',
  'min7',
];

/**
 * How long the answer may go silent before it closes (`Question.answerGapMs`,
 * the runner's per-question override). The runner's default 1200 ms is sized
 * for *echoing* something you just heard (slice 6's interval, slice 7's
 * chord). This drill is a **construction** drill: the shape has to be worked
 * out from a symbol in a key you may not own yet, and a window that closes
 * mid-voicing grades an answer the user was still playing. 2.5 s is the same
 * kind of override slice 10 took for its twelve-note cadence; the idle pause
 * still ends an abandoned drill.
 */
const ANSWER_GAP_MS = 2500;

/**
 * Where a rootless voicing's **bass note** is drawn from when the range
 * allows: the octave below middle C up to the D above it. That is where the
 * left hand comps — low enough to sound like an accompaniment, high enough to
 * stay off the bass player's register (which the reference root occupies).
 */
const COMFORT = { low: MIDDLE_C - 12, high: MIDDLE_C + 2 };

/**
 * The mastery unit is **the chord *and* the form**:
 * `rootless-voicing:<quality>:<rootPc>:<form>`, 72 cells for the starter set.
 *
 * Slice 8 made the key half of the skill because `Bmaj7` and `Cmaj7` are one
 * colour and two different shapes under the hand. The form splits it once
 * more for exactly the same reason: A and B share their four notes but not
 * their shape, their fingering or their register, and knowing one has never
 * meant knowing the other. Averaging them would report the form you reach for
 * and the form you avoid as one half-learned number — which is the thing this
 * drill exists to expose, and from slice 9a to schedule.
 */
export function skillIdFor(
  quality: ChordQuality,
  rootPc: PitchClass,
  form: RootlessForm,
): SkillId {
  return `${ROOTLESS_VOICING_ID}:${quality}:${rootPc}:${form}`;
}

/**
 * What a skill id is called in the `/progress` grid — `Cmaj7 A`: the chord
 * symbol a chart would print plus the form. An id this exercise does not
 * recognise comes back unchanged (`skill-id.ts`: a skill id read back is
 * untrusted input).
 */
export function rootlessSkillLabel(skillId: SkillId): string {
  const skill = parseSkillId(skillId);
  if (skill === null) return skillId;
  return `${chordSymbolText(skill.rootPc, skill.quality)} ${skill.form}`;
}

/**
 * The chord and form a skill id names, or `null` for anything else — an id
 * read back is untrusted input, and a quality with no rootless voicing was
 * never a skill here.
 */
export function parseSkillId(
  skillId: SkillId,
): { quality: ChordQuality; rootPc: PitchClass; form: RootlessForm } | null {
  const segments = skillIdSegments(skillId, ROOTLESS_VOICING_ID, 3);
  if (segments === null) return null;
  const [quality, root, form] = segments;
  const rootPc = pitchClassSegment(root);
  if (rootPc === null || !isChordQuality(quality) || !isRootlessForm(form))
    return null;
  return hasRootless(quality) ? { quality, rootPc, form } : null;
}

/**
 * Whether the `form` voicing of `quality` in `rootPc` fits `range`: some
 * octave of its **bass note** (placement is anchored there, not on the root —
 * `pickBass`) leaves the whole shape inside the keyboard.
 */
function fits(
  quality: ChordQuality,
  rootPc: PitchClass,
  form: RootlessForm,
  range: KeyRange,
): boolean {
  const offset = rootlessBassOffset(quality, form);
  if (offset === null) return false;
  return pitchClassesIn(
    range.low,
    range.high - rootlessSpan(quality, form),
  ).includes((rootPc + offset) % 12);
}

/** The keys `quality` can be asked in on `range`, in at least one form. */
function buildableRoots(quality: ChordQuality, range: KeyRange): PitchClass[] {
  if (!hasRootless(quality)) return [];
  return PITCH_CLASSES.filter((rootPc) =>
    ROOTLESS_FORMS.some((form) => fits(quality, rootPc, form, range)),
  );
}

/**
 * The qualities of this set that `generate()` can ask on `range` — a rootless
 * voicing of their own, in at least one key and form that fits. No fallback:
 * an empty set means nothing to ask (`coverage.ts`).
 */
export function buildableQualities(
  settings: RootlessVoicingSettings,
  range: KeyRange,
): ChordQuality[] {
  return settings.qualities.filter(
    (quality) => buildableRoots(quality, range).length > 0,
  );
}

/**
 * Where to put the voicing: an occurrence of the form's bass degree that
 * leaves the whole shape inside the instrument, preferring the left hand's
 * comping register.
 *
 * Placement is anchored on the **bass note, not the root**, because the root
 * is not played: anchoring on it would push a B form (whose top sits 19
 * semitones above the root) out of the hand on a small keyboard, for a note
 * nobody plays.
 */
function pickBass(
  rng: () => number,
  low: Midi,
  high: Midi,
  bassPc: PitchClass,
  quality: ChordQuality,
  form: RootlessForm,
): Midi {
  const ceiling = Math.max(low, high - rootlessSpan(quality, form));
  // A range too narrow to hold the shape is not a piano either; place it as
  // low as it goes and let the top poke out.
  return (
    pickOccurrence(rng, bassPc, { low, high: ceiling }, COMFORT) ??
    lowestFrom(bassPc, low)
  );
}

/**
 * Where the bass reference sounds: the highest root below the voicing, which
 * is where a bass player would be. Falling back upwards only happens on a
 * range too narrow to hold both.
 */
function pickReferenceRoot(
  low: Midi,
  high: Midi,
  rootPc: PitchClass,
  bassMidi: Midi,
): Midi {
  const below = occurrences(rootPc, low, Math.min(high, bassMidi - 1));
  if (below.length > 0) return below[below.length - 1];
  const anywhere = occurrences(rootPc, low, high);
  return anywhere.length > 0 ? anywhere[0] : lowestFrom(rootPc, low);
}

function generate(
  ctx: GenerateContext<RootlessVoicingSettings>,
): Question<RootlessVoicingPayload> {
  const { low, high } = ctx.range;
  const choices = buildableQualities(ctx.settings, ctx.range);
  if (choices.length === 0) throw new NothingToAskError(ROOTLESS_VOICING_ID);

  // The planner's target, asked exactly when this drill can build it; else a
  // quality, a key it fits in and a form that fits there, not the last chord
  // asked (`draw.ts`).
  const target = buildableTarget(
    ctx.targetSkillId,
    parseSkillId,
    (skill) =>
      choices.includes(skill.quality) &&
      fits(skill.quality, skill.rootPc, skill.form, ctx.range),
  );
  const { quality, rootPc, form } =
    target ??
    drawAvoidingRepeat(
      () => {
        const key = drawKeyed(ctx.rng, choices, (quality) =>
          buildableRoots(quality, ctx.range),
        );
        const forms = ROOTLESS_FORMS.filter((form) =>
          fits(key.quality, key.rootPc, form, ctx.range),
        );
        return { ...key, form: choose(ctx.rng, forms) };
      },
      (drawn) => skillIdFor(drawn.quality, drawn.rootPc, drawn.form),
      ctx.history.recentSkillIds,
    );

  const offset = rootlessBassOffset(quality, form) ?? 0;
  const bassMidi = pickBass(
    ctx.rng,
    low,
    high,
    ((rootPc + offset) % 12) as PitchClass,
    quality,
    form,
  );
  const rootMidi = pickReferenceRoot(low, high, rootPc, bassMidi);
  const notes = rootlessNotesFromBass(bassMidi, quality, form) ?? [bassMidi];
  const symbol = chordSymbolText(rootPc, quality);
  const payload: RootlessVoicingPayload = {
    rootPc,
    rootMidi,
    quality,
    form,
    bassMidi,
  };

  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${ROOTLESS_VOICING_ID}:${ctx.seed}:${bassMidi}:${quality}:${form}`,
    seed: ctx.seed,
    skillId: skillIdFor(quality, rootPc, form),
    payload,
    prompt: {
      // The chord symbol and the form together *are* the question — this
      // drill is read, not heard.
      title: `${symbol} · ${form}`,
      subtitle: `Play the ${form} form: ${rootlessDegrees(form)} — no root`,
      showKeyboard: true,
    },
    // The root alone, low — the bass player's note, so `Replay` is worth
    // pressing; it cannot give the answer away, being the one note the answer
    // must *not* contain. A miss hears the voicing itself (`draw.ts`).
    ...referenceThenReveal(rootMidi, notes),
    answerMode: 'note-sequence',
    answerGapMs: ANSWER_GAP_MS,
    expected: {
      kind: 'notes',
      notes,
      label: `${symbol} ${form} form`,
    },
    // No `range`: the voicing may be played in any octave, so nothing dims.
    spellings: spellings(notes),
  };
}

/** The other of the two forms. */
function otherForm(form: RootlessForm): RootlessForm {
  return form === 'A' ? 'B' : 'A';
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(
  rootPc: PitchClass,
  quality: ChordQuality,
  form: RootlessForm,
  played: readonly Midi[],
): string | undefined {
  if (played.length < 2) return undefined;
  if (spellsRootless(played, rootPc, quality, form)) return undefined;

  const pcs = new Set(played.map((midi) => pcOf(midi)));
  const bassPc = pcOf(Math.min(...played.map((midi) => Math.round(midi))));

  // The whole point of the drill, so it is the first thing checked and the
  // only near-miss with the word "rootless" in it. The shell is the shape
  // slice 8 taught and the one a hand reaches for out of habit, so it gets its
  // own name before the general case.
  if (pcs.has(rootPc)) {
    if (spellsShellInAnyInversion(played, rootPc, quality))
      return 'That is the shell — a rootless voicing leaves the root to the bass';
    return 'You played the root — a rootless voicing leaves it to the bass';
  }

  // The right four notes over the wrong one. Since A and B share their tones,
  // this is where the *other* form lands, and telling the two apart is what
  // the drill is for.
  if (spellsRootlessInAnyInversion(played, rootPc, quality)) {
    const other = otherForm(form);
    const otherOffset = rootlessBassOffset(quality, other);
    if (
      otherOffset !== null &&
      bassPc === (((rootPc + otherOffset) % 12) as PitchClass)
    )
      return `That is the ${other} form — ${form} starts on the ${rootlessBassDegree(form)}`;
    return `Right notes — the ${form} form starts on the ${rootlessBassDegree(form)}`;
  }

  // The 9th is the note that replaces the root, and leaving it out is the
  // other half of the rooted-playing habit: a 3-5-7 fragment is not a voicing.
  const ninthPc = ((rootPc + 2) % 12) as PitchClass;
  const wanted = rootlessPitchClasses(rootPc, quality) ?? [];
  if (!pcs.has(ninthPc) && [...pcs].every((pc) => wanted.includes(pc)))
    return 'Both forms need the 9th — it is the note that replaces the root';

  // The right shape in the wrong key, or another quality's voicing: name what
  // it was, so the mistake is visible as a transposition and not as noise.
  const shape = rootlessOfIntervalsAboveBass(intervalsAboveBass(played));
  if (shape !== null) {
    const offset = rootlessBassOffset(shape.quality, shape.form) ?? 0;
    const playedRoot = (((bassPc - offset) % 12) + 12) % 12;
    return `You played the ${chordSymbolText(playedRoot, shape.quality)} ${shape.form} form`;
  }
  const whole = qualityOfIntervals(intervalsAboveBass(played));
  return whole === null
    ? undefined
    : `You played ${chordSymbolText(bassPc, whole)} in full`;
}

function grade(
  question: Question<RootlessVoicingPayload>,
  answer: Answer,
): Grade {
  const { rootPc, quality, form, bassMidi } = question.payload;
  const notes = rootlessNotesFromBass(bassMidi, quality, form) ?? [bassMidi];
  const reveal = {
    notes,
    label: `${chordSymbolText(rootPc, quality)} ${form} form`,
  };

  // Fewer than two notes is not a voicing — a closed-but-short sequence (the
  // silence window ran out) is a miss, like any other wrong answer.
  if (answer.kind !== 'notes' || answer.notes.length < 2)
    return { correct: false, score: 0, revealed: reveal };

  if (spellsRootless(answer.notes, rootPc, quality, form))
    return { correct: true, score: 1 };

  return {
    // Binary, per ADR §10.
    correct: false,
    score: 0,
    feedback: missDetail(rootPc, quality, form, answer.notes),
    revealed: reveal,
  };
}

export const rootlessVoicing: ExerciseDefinition<
  RootlessVoicingPayload,
  RootlessVoicingSettings
> = {
  id: ROOTLESS_VOICING_ID,
  title: 'Rootless voicings',
  description:
    'A chord symbol and a form. Play the rootless A or B voicing — no root.',
  defaultSettings: {
    qualities: STARTER_QUALITIES,
  },
  requiresMidi: false,
  // A quality with no rootless voicing, or a key and form that does not fit
  // the keyboard, has nothing to ask, so it puts no unanswerable cell on
  // `/progress`.
  skillsCovered: (settings, range) =>
    buildableQualities(settings, range).flatMap((quality) =>
      PITCH_CLASSES.flatMap((rootPc) =>
        ROOTLESS_FORMS.filter((form) => fits(quality, rootPc, form, range)).map(
          (form) => skillIdFor(quality, rootPc, form),
        ),
      ),
    ),
  skillLabel: (skillId) => rootlessSkillLabel(skillId),
  generate,
  grade,
};
