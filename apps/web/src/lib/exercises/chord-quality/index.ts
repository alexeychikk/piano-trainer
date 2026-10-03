/**
 * Exercise #3 — "Chord quality" (ADR §10, slice 7): a four-note jazz chord
 * sounds as a block; the user plays it back. The second ear-training drill and
 * the step from product pillar 1 into pillar 2 — a voicing you cannot hear is
 * a shape you can only read.
 *
 * **The graded quantity is the quality, not the pitches.** A question is asked
 * from a random root, but the answer is the *structure* of what was played:
 * the semitones above the lowest note you played, folded into one octave and
 * deduped (`intervalsAboveBass`). So:
 *
 * - **root** — any. The chord may be played back from any key, like slice 6's
 *   interval: what is being trained is the sound of the quality, and absolute
 *   pitch is what "Find the note" drills.
 * - **octave / voicing** — any. Register, spacing and doubling are thrown
 *   away, so C3-E4-G4-B4 is the same answer as C4-E4-G4-B4, and a left-hand
 *   root under a right-hand chord (`C2 · C4 E4 G4 B4`) passes. Doublings are free: grading is pitch-class set plus lowest
 *   note. On the `note-sequence` path (mouse, computer keys) a doubled note
 *   still uses up one of the answer's N notes, because that path closes at
 *   the expected length (ADR 0004 §3).
 * - **inversion** — root position. The lowest note played is read as the root,
 *   because a pitch-class set alone does not name one quality: Cm7 and Eb6 are
 *   the same four notes, and slice 8's 6th chords would make that ambiguity
 *   real. A right chord over the wrong bass is a named miss, not a silent one.
 * - **enharmonics** — equal for free: the comparison is integer arithmetic on
 *   MIDI numbers (ADR §4), never on spellings.
 *
 * The answer mode is **`chord-released`** (ADR 0004), which the runner
 * captures as a chord from a MIDI port — closed when every key is up, two
 * hands and doublings included — and as a `note-sequence` from every other
 * source, where a mouse can only press one key at a time and "hold the chord"
 * cannot be played at all. Grading is order-insensitive either way, so a
 * rolled, arpeggiated or block chord grade identically.
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, settings, range)` and both are
 * unit-tested without a browser (ADR §5).
 */

import {
  MIDDLE_C,
  chordIntervals,
  chordNotes,
  chordQualityName,
  chordQualityShortName,
  intervalsAboveBass,
  isChordQuality,
  qualityOfIntervals,
  spellsQuality,
  spellsQualityInAnyInversion,
  spokenChordQuality,
  type ChordQuality,
  type Midi,
} from '$lib/theory';
import { NothingToAskError, buildableTarget } from '../coverage';
import { choose, drawAvoidingRepeat, pickInWindow, spellings } from '../draw';
import { skillIdSegments } from '../skill-id';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
  KeyRange,
  Question,
  SkillId,
} from '../types';

export const CHORD_QUALITY_ID = 'chord-quality';

export interface ChordQualityPayload {
  /** The note the chord was built from. Not part of the answer. */
  rootMidi: Midi;
  quality: ChordQuality;
}

/**
 * A **type alias**, not an `interface`: the registry's erased `AnyExercise`
 * types settings as `Record<string, unknown>`, and only an alias gets the
 * implicit index signature that makes it assignable (see `types.ts`).
 */
export type ChordQualitySettings = {
  /** The qualities in play, in no particular order. */
  qualities: readonly ChordQuality[];
};

/**
 * The starter set: the four seventh chords every jazz tune is built from, plus
 * the diminished 7th that a beginner most often confuses with the
 * half-diminished. All four-note, all one family, so the drill is about
 * *colour* and not about counting notes — a triad next to a seventh chord is
 * told apart by its size long before its quality is heard. Triads and the
 * 6th chords join when the runner can render `settingsFields`.
 */
export const STARTER_QUALITIES: readonly ChordQuality[] = [
  'maj7',
  'dom7',
  'min7',
  'min7b5',
  'dim7',
];

/** How long the chord rings, in milliseconds. */
const CHORD_MS = 1600;
const CHORD_VELOCITY = 88;

/**
 * Where a root is drawn from when the user's range allows it: the octave below
 * middle C and a little above, where a four-note close voicing sits under one
 * hand and is easiest to hear. A narrower instrument range wins over this (it
 * is the real one).
 */
const COMFORT = { low: MIDDLE_C - 12, high: MIDDLE_C + 4 };

/** The mastery unit is the quality itself (ADR §10): one skill per colour. */
export function skillIdFor(quality: ChordQuality): SkillId {
  return `${CHORD_QUALITY_ID}:${quality}`;
}

/**
 * What a skill id is called in the `/progress` grid — `m7b5`: the copy deck
 * abbreviates musical terms in dense grids (the chord-symbol suffix a chart
 * would print) and spells them out in feedback. An id this exercise does not
 * recognise comes back unchanged.
 */
export function chordSkillLabel(skillId: SkillId): string {
  const quality = parseSkillId(skillId);
  return quality === null ? skillId : chordQualityShortName(quality);
}

/**
 * The quality a skill id names, or `null` for anything else — an id read back
 * is untrusted input, so it is validated, never assumed.
 */
export function parseSkillId(skillId: SkillId): ChordQuality | null {
  const segments = skillIdSegments(skillId, CHORD_QUALITY_ID, 1);
  if (segments === null) return null;
  const [quality] = segments;
  // A quality the app cannot build (`dom7alt`) has no colour to drill and no
  // grid cell to name; one it does not know at all never was a skill.
  if (!isChordQuality(quality) || chordIntervals(quality) === null) return null;
  return quality;
}

/** The notes of a question, low to high. */
function notesOf(payload: ChordQualityPayload): Midi[] {
  return chordNotes(payload.rootMidi, payload.quality) ?? [payload.rootMidi];
}

/** How far the highest chord tone sits above the root. */
function spanOf(quality: ChordQuality): number {
  const intervals = chordIntervals(quality);
  return intervals === null ? 0 : Math.max(...intervals);
}

/**
 * The qualities of this set that `generate()` can build on `range`: the theory
 * module has an interval set for them and the whole chord fits the keyboard.
 * No fallback — an empty set means nothing to ask (`coverage.ts`).
 */
export function buildableQualities(
  settings: ChordQualitySettings,
  range: KeyRange,
): ChordQuality[] {
  return settings.qualities.filter(
    (quality) =>
      chordIntervals(quality) !== null &&
      spanOf(quality) <= range.high - range.low,
  );
}

function pickRoot(
  rng: () => number,
  low: Midi,
  high: Midi,
  quality: ChordQuality,
): Midi {
  // The whole chord has to fit: the root may go no higher than the top of the
  // instrument minus the chord's span. Prefer the comfortable middle, but
  // never leave the real range to get it.
  const window = { low, high: Math.max(low, high - spanOf(quality)) };
  return pickInWindow(rng, window, COMFORT);
}

function generate(
  ctx: GenerateContext<ChordQualitySettings>,
): Question<ChordQualityPayload> {
  const { low, high } = ctx.range;
  const choices = buildableQualities(ctx.settings, ctx.range);
  if (choices.length === 0) throw new NothingToAskError(CHORD_QUALITY_ID);
  const recent = ctx.history.recentSkillIds;

  // The planner's target, asked exactly when this drill can build it.
  const target = buildableTarget(ctx.targetSkillId, parseSkillId, (quality) =>
    choices.includes(quality),
  );
  const quality =
    target ??
    drawAvoidingRepeat(
      () => choose(ctx.rng, choices),
      skillIdFor,
      recent,
      choices.length > 1,
    );

  const rootMidi = pickRoot(ctx.rng, low, high, quality);
  const payload: ChordQualityPayload = { rootMidi, quality };
  const notes = notesOf(payload);

  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${CHORD_QUALITY_ID}:${ctx.seed}:${rootMidi}:${quality}`,
    seed: ctx.seed,
    skillId: skillIdFor(quality),
    payload,
    prompt: {
      title: 'Which chord did you hear?',
      subtitle: 'Play it back in root position, from any key',
      showKeyboard: true,
    },
    playback: {
      // One block chord: the quality is a colour, and a colour is heard all at
      // once. Replay is the runner's, and costs nothing.
      events: [
        {
          atMs: 0,
          notes,
          durationMs: CHORD_MS,
          velocity: CHORD_VELOCITY,
        },
      ],
    },
    answerMode: 'chord-released',
    expected: {
      kind: 'notes',
      notes,
      label: chordQualityName(quality),
    },
    // No `range`: the answer may be played from any key, so nothing dims.
    spellings: spellings(notes),
  };
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(
  expected: ChordQuality,
  played: readonly Midi[],
): string | undefined {
  if (played.length < 2) return undefined;
  if (spellsQuality(played, expected)) return undefined;
  // The right notes over the wrong bass is a different mistake from the wrong
  // chord, and the most useful thing we can say about it.
  if (spellsQualityInAnyInversion(played, expected))
    return 'Right chord — but the root belongs at the bottom';
  const quality = qualityOfIntervals(intervalsAboveBass(played));
  return quality === null
    ? undefined
    : `You played ${spokenChordQuality(quality)}`;
}

function grade(question: Question<ChordQualityPayload>, answer: Answer): Grade {
  const { quality } = question.payload;
  const notes = notesOf(question.payload);
  const reveal = { notes, label: chordQualityName(quality) };

  // Fewer than two notes is not a chord — a closed-but-empty sequence (the
  // answer window ran out) is a miss, like any other wrong answer.
  if (answer.kind !== 'notes' || answer.notes.length < 2) {
    return { correct: false, score: 0, revealed: reveal };
  }

  if (spellsQuality(answer.notes, quality)) return { correct: true, score: 1 };
  return {
    // Binary, per ADR §10: a chord is either the quality you heard or it is
    // not. Mastery (slice 5a) reads this score, so half credit here would
    // quietly report a skill as half-learned.
    correct: false,
    score: 0,
    feedback: missDetail(quality, answer.notes),
    revealed: reveal,
  };
}

export const chordQuality: ExerciseDefinition<
  ChordQualityPayload,
  ChordQualitySettings
> = {
  id: CHORD_QUALITY_ID,
  title: 'Chord quality',
  description:
    'A four-note chord sounds. Play it back in root position, from any key.',
  defaultSettings: {
    qualities: STARTER_QUALITIES,
  },
  requiresMidi: false,
  skillsCovered: (settings, range) =>
    buildableQualities(settings, range).map(skillIdFor),
  skillLabel: (skillId) => chordSkillLabel(skillId),
  generate,
  grade,
};
