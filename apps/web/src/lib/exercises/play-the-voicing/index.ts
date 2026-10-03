/**
 * Exercise #4 — "Play the voicing" (ADR §10, slice 8): a chord symbol appears,
 * the root sounds as a pitch reference, and the user **plays its shell
 * voicing** on the piano. The first *playing* drill rather than a listening
 * one, and the first drill of product pillar 2 (chords & voicings).
 *
 * **The voicing set is the shell**: root + 3rd + 7th, one hand, the 5th thrown
 * away (`$lib/theory/voicings.ts` owns the vocabulary — an exercise never
 * spells a chord itself). Rootless A/B voicings and guide-tone pairs are their
 * own ticket; a shell is what makes this slice fit one session and is the
 * voicing everything later is built on.
 *
 * **The graded quantity is the voicing in the asked key.** Unlike slices 6 and
 * 7 — where any key would do because the interval or the colour *was* the
 * answer — the key is half the point here: `Dbmaj7` and `Cmaj7` are the same
 * colour and nothing like the same shape under the hand. So `grade()` compares
 * the pitch classes played to the shell's three and requires the asked root at
 * the bottom (`spellsShell`):
 *
 * - **root** — the asked one, and it must be the **lowest note played**. A
 *   shell has its root in the bass; take the root away and you have a rootless
 *   voicing, which is a later ticket and a different sound.
 * - **octave / register** — any, for the whole shape and for each note in it,
 *   so the A form (`1-7-3`, the 3rd an octave up) and the B form (`1-3-7`)
 *   both pass, as does the same shell two octaves down.
 * - **order** — any: grading is order-insensitive, so a rolled, arpeggiated
 *   or block shell grade the same.
 * - **answer mode** — `chord-released` (ADR 0004): from a MIDI port the shell
 *   closes when every key is up, so a left-hand root under a right-hand `3-7`
 *   is one answer; the mouse and computer keys close on three note-ons.
 * - **hands** — no concept. Nothing upstream tells the app which hand a note
 *   came from (ADR §3: a `NoteEvent` has a source, never a hand), so a shell
 *   split across two hands is the same pitch classes over the same bass.
 * - **doubling** — free (`C3 · C4 E4 B4` passes). Grading is pitch-class set plus lowest
 *   note. On the `note-sequence` path (mouse, computer keys) a doubled note
 *   still uses up one of the answer's N notes, because that path closes at
 *   the expected length (ADR 0004 §3).
 * - **enharmonics** — equal for free: integer arithmetic on MIDI numbers.
 *
 * Scoring is **binary** (ADR §10), like every other drill: half a shell is not
 * a voicing, and partial credit would report a key as half-learned to the
 * mastery EWMA.
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, settings, range)` and both are
 * unit-tested without a browser (ADR §5).
 */

import {
  MIDDLE_C,
  chordSymbolText,
  hasShell,
  intervalsAboveBass,
  isChordQuality,
  pcOf,
  qualityOfIntervals,
  qualityOfShellIntervals,
  shellIntervals,
  shellNotes,
  shellSpan,
  spellsShell,
  spellsShellInAnyInversion,
  type ChordQuality,
  type Midi,
  type PitchClass,
} from '$lib/theory';
import { NothingToAskError, pitchClassesIn } from '../coverage';
import {
  drawKey,
  lowestFrom,
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

export const PLAY_THE_VOICING_ID = 'play-the-voicing';

export interface PlayTheVoicingPayload {
  /** The key asked for — the answer's root, in any octave. */
  rootPc: PitchClass;
  /** Where the reference root sounds and the reveal is drawn. */
  rootMidi: Midi;
  quality: ChordQuality;
}

/**
 * A **type alias**, not an `interface`: the registry's erased `AnyExercise`
 * types settings as `Record<string, unknown>`, and only an alias gets the
 * implicit index signature that makes it assignable (`types.ts`).
 */
export type PlayTheVoicingSettings = {
  /** The qualities in play, in no particular order. */
  qualities: readonly ChordQuality[];
};

/**
 * The starter set: slice 7's five qualities, **minus the two that have no
 * shell of their own**.
 *
 * - `min7b5` is dropped because its shell is `min7`'s. A shell keeps the 3rd
 *   and the 7th and throws the 5th away — and the flat 5th is the only thing
 *   that tells a half-diminished chord from a minor 7th. Asking for `Cm7b5`
 *   and accepting `C-Eb-Bb` would be asking for a chord and grading another.
 * - `dim7` is dropped because it has no shell at all: its seventh is a
 *   *diminished* 7th, so `C-Eb-A` is a fragment that spells `Ebm6` just as
 *   well. A diminished chord is voiced whole, never shelled.
 *
 * What is left is the three shells every method teaches first — the ii-V-I's
 * own vocabulary (`m7`, `7`, `maj7`) — in all 12 keys.
 */
export const STARTER_QUALITIES: readonly ChordQuality[] = [
  'maj7',
  'dom7',
  'min7',
];

/**
 * Where a shell's root is drawn from when the user's range allows it: the two
 * octaves below middle C, which is where a left-hand shell lives. A narrower
 * instrument range wins over this (it is the real one).
 */
const COMFORT = { low: MIDDLE_C - 24, high: MIDDLE_C - 3 };

/**
 * The mastery unit is **the chord, not the colour**: `play-the-voicing:
 * <quality>:<rootPc>`. What is weak in a playing drill is a key — `Bmaj7` and
 * `Cmaj7` are one colour and two completely different shapes — so a mastery
 * number per quality would average the keys you own with the keys you avoid,
 * which is exactly the thing this drill exists to expose (and, from slice 9,
 * to schedule).
 */
export function skillIdFor(quality: ChordQuality, rootPc: PitchClass): SkillId {
  return `${PLAY_THE_VOICING_ID}:${quality}:${rootPc}`;
}

/**
 * What a skill id is called in the `/progress` grid — `Cmaj7`, the chord
 * symbol a chart would print. An id this exercise does not recognise comes
 * back unchanged.
 */
export function voicingSkillLabel(skillId: SkillId): string {
  const skill = parseSkillId(skillId);
  return skill === null
    ? skillId
    : chordSymbolText(skill.rootPc, skill.quality);
}

/**
 * The chord a skill id names, or `null` for anything else — an id read back
 * is untrusted input, and a quality with no shell was never a skill here.
 */
export function parseSkillId(
  skillId: SkillId,
): { quality: ChordQuality; rootPc: PitchClass } | null {
  const segments = skillIdSegments(skillId, PLAY_THE_VOICING_ID, 2);
  if (segments === null) return null;
  const [quality, root] = segments;
  const rootPc = pitchClassSegment(root);
  if (rootPc === null || !isChordQuality(quality)) return null;
  return hasShell(quality) ? { quality, rootPc } : null;
}

/**
 * The keys a `quality` shell can be asked in on `range`: those with an octave
 * of the root low enough for the 7th to fit too. All twelve on any keyboard
 * that spans the shell plus an octave; none for a quality with no shell.
 */
function buildableRoots(quality: ChordQuality, range: KeyRange): PitchClass[] {
  if (!hasShell(quality)) return [];
  return pitchClassesIn(range.low, range.high - shellSpan(quality));
}

/**
 * The qualities of this set that `generate()` can ask on `range` — a shell of
 * their own, in at least one key that fits. No fallback: an empty set means
 * nothing to ask (`coverage.ts`).
 */
export function buildableQualities(
  settings: PlayTheVoicingSettings,
  range: KeyRange,
): ChordQuality[] {
  return settings.qualities.filter(
    (quality) => buildableRoots(quality, range).length > 0,
  );
}

/**
 * Where to put the asked root: the lowest-register occurrence of the pitch
 * class that still leaves the shell's top inside the instrument, preferring
 * the left hand's octaves.
 */
function pickRoot(
  rng: () => number,
  low: Midi,
  high: Midi,
  rootPc: PitchClass,
  quality: ChordQuality,
): Midi {
  const window = { low, high: Math.max(low, high - shellSpan(quality)) };
  // A range so narrow that no octave of the root fits under the shell is not a
  // piano either; place it as low as it goes and let the top poke out.
  return (
    pickOccurrence(rng, rootPc, window, COMFORT) ?? lowestFrom(rootPc, low)
  );
}

function generate(
  ctx: GenerateContext<PlayTheVoicingSettings>,
): Question<PlayTheVoicingPayload> {
  const { low, high } = ctx.range;
  const choices = buildableQualities(ctx.settings, ctx.range);
  if (choices.length === 0) throw new NothingToAskError(PLAY_THE_VOICING_ID);

  const { quality, rootPc } = drawKey({
    rng: ctx.rng,
    targetSkillId: ctx.targetSkillId,
    recentSkillIds: ctx.history.recentSkillIds,
    choices,
    rootsOf: (quality) => buildableRoots(quality, ctx.range),
    parseSkillId,
    skillIdFor,
  });

  const rootMidi = pickRoot(ctx.rng, low, high, rootPc, quality);
  const payload: PlayTheVoicingPayload = { rootPc, rootMidi, quality };
  const notes = shellNotes(rootMidi, quality) ?? [rootMidi];
  const symbol = chordSymbolText(rootPc, quality);

  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${PLAY_THE_VOICING_ID}:${ctx.seed}:${rootMidi}:${quality}`,
    seed: ctx.seed,
    skillId: skillIdFor(quality, rootPc),
    payload,
    prompt: {
      // The chord symbol *is* the prompt — this drill is read, not heard.
      title: symbol,
      subtitle: 'Play the shell: root, 3rd and 7th',
      showKeyboard: true,
    },
    // The root alone; the shell itself only on the reveal (`draw.ts`).
    ...referenceThenReveal(rootMidi, notes),
    answerMode: 'chord-released',
    expected: {
      kind: 'notes',
      notes,
      label: `${symbol} shell`,
    },
    // No `range`: the shell may be played in any octave, so nothing dims.
    spellings: spellings(notes),
  };
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(
  rootPc: PitchClass,
  quality: ChordQuality,
  played: readonly Midi[],
): string | undefined {
  if (played.length < 2) return undefined;
  if (spellsShell(played, rootPc, quality)) return undefined;

  // The right three notes over the wrong one: the most common near-miss, and a
  // different mistake from playing the wrong notes.
  if (spellsShellInAnyInversion(played, rootPc, quality))
    return 'Right notes — the root belongs at the bottom';

  const pcs = new Set(played.map((midi) => pcOf(midi)));
  const bassPc = pcOf(Math.min(...played.map((midi) => Math.round(midi))));
  // The 7th by construction, never the highest of `shellPitchClasses()`: those
  // are sorted, so in most keys the 7th is not the last of the three.
  const seventh = shellIntervals(quality)?.[2];
  const seventhPc = seventh === undefined ? null : (rootPc + seventh) % 12;
  // Kept the 5th, dropped the 7th: the reflex of anyone who learned triads
  // first, and the one thing a shell is defined by not doing.
  if (
    bassPc === rootPc &&
    seventhPc !== null &&
    !pcs.has(seventhPc) &&
    pcs.has((rootPc + 7) % 12)
  )
    return 'A shell leaves the 5th out — keep the 3rd and the 7th';

  // The mirror mistake: kept the 7th, dropped the 3rd (root–5th–7th). It is
  // the note that makes the chord major or minor, so it is the one a shell can
  // least afford to lose — and it had no named line before.
  //
  // The precondition is **no 3rd at all**, minor or major, not "not the asked
  // quality's 3rd": an answer that carries the *other* 3rd (asked `Cm7`,
  // played `C-E-Bb`) is another quality's shell, which the naming branch below
  // explains properly — and that is the commonest mistake in this drill, so
  // telling the user the 3rd is missing would be plainly false.
  const seventhKept = seventhPc !== null && pcs.has(seventhPc);
  const noThird = !pcs.has((rootPc + 3) % 12) && !pcs.has((rootPc + 4) % 12);
  if (bassPc === rootPc && noThird && seventhKept)
    return 'The 3rd is the colour — a shell keeps the 3rd and the 7th';

  // The right shape in the wrong key, or another quality's shell: name what it
  // was, so the mistake is visible as a transposition and not as noise.
  const shell = qualityOfShellIntervals(intervalsAboveBass(played));
  if (shell !== null)
    return `You played the ${chordSymbolText(bassPc, shell)} shell`;
  const whole = qualityOfIntervals(intervalsAboveBass(played));
  return whole === null
    ? undefined
    : `You played ${chordSymbolText(bassPc, whole)} in full`;
}

function grade(
  question: Question<PlayTheVoicingPayload>,
  answer: Answer,
): Grade {
  const { rootPc, rootMidi, quality } = question.payload;
  const notes = shellNotes(rootMidi, quality) ?? [rootMidi];
  const reveal = { notes, label: `${chordSymbolText(rootPc, quality)} shell` };

  // Fewer than two notes is not a voicing — a closed-but-short sequence (the
  // silence window ran out) is a miss, like any other wrong answer.
  if (answer.kind !== 'notes' || answer.notes.length < 2) {
    return { correct: false, score: 0, revealed: reveal };
  }

  if (spellsShell(answer.notes, rootPc, quality))
    return { correct: true, score: 1 };

  return {
    // Binary, per ADR §10.
    correct: false,
    score: 0,
    feedback: missDetail(rootPc, quality, answer.notes),
    revealed: reveal,
  };
}

export const playTheVoicing: ExerciseDefinition<
  PlayTheVoicingPayload,
  PlayTheVoicingSettings
> = {
  id: PLAY_THE_VOICING_ID,
  title: 'Play the voicing',
  description:
    'A chord symbol appears. Play its shell voicing — root, 3rd and 7th.',
  defaultSettings: {
    qualities: STARTER_QUALITIES,
  },
  requiresMidi: false,
  // A quality with no shell, or a key whose shell does not fit the keyboard,
  // has nothing to ask, so it puts no unanswerable cell on `/progress`.
  skillsCovered: (settings, range) =>
    buildableQualities(settings, range).flatMap((quality) =>
      buildableRoots(quality, range).map((rootPc) =>
        skillIdFor(quality, rootPc),
      ),
    ),
  skillLabel: (skillId) => voicingSkillLabel(skillId),
  generate,
  grade,
};
