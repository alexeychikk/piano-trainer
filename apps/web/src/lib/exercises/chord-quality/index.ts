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
 *   away, so C3-E4-G4-B4 is the same answer as C4-E4-G4-B4. (The runner closes
 *   a `note-sequence` answer at the expected length, so in practice a doubling
 *   means one chord tone never gets played.)
 * - **inversion** — root position. The lowest note played is read as the root,
 *   because a pitch-class set alone does not name one quality: Cm7 and Eb6 are
 *   the same four notes, and slice 8's 6th chords would make that ambiguity
 *   real. A right chord over the wrong bass is a named miss, not a silent one.
 * - **enharmonics** — equal for free: the comparison is integer arithmetic on
 *   MIDI numbers (ADR §4), never on spellings.
 *
 * The answer mode is **`note-sequence`**, not `chord-sustained`: it is the one
 * mode that behaves the same on a MIDI piano (a held chord arrives as four
 * note-ons), on the computer keys and on the on-screen keyboard — where a
 * mouse can only press one key at a time and "hold the chord" cannot be played
 * at all. Grading is order-insensitive, so QA's slice-6 observation (notes
 * struck together are read in note-on arrival order) cannot affect it: a
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
  midiToName,
  qualityOfIntervals,
  spellsQuality,
  spellsQualityInAnyInversion,
  spokenChordQuality,
  type ChordQuality,
  type Midi,
  type NoteName,
} from '$lib/theory';
import { randomInt } from '../rng';
import type {
  Answer,
  ExerciseDefinition,
  GenerateContext,
  Grade,
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

/** How hard we try to avoid asking the same quality twice in a row. */
const MAX_REDRAWS = 4;

/** How long the chord rings, in milliseconds. */
const CHORD_MS = 1600;
const CHORD_VELOCITY = 88;

/**
 * Where a root is drawn from when the user's range allows it: the octave below
 * middle C and a little above, where a four-note close voicing sits under one
 * hand and is easiest to hear. A narrower instrument range wins over this (it
 * is the real one).
 */
const COMFORT_LOW: Midi = MIDDLE_C - 12;
const COMFORT_HIGH: Midi = MIDDLE_C + 4;

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
  const prefix = `${CHORD_QUALITY_ID}:`;
  if (!skillId.startsWith(prefix)) return skillId;
  const quality = skillId.slice(prefix.length) as ChordQuality;
  return chordIntervals(quality) === null
    ? skillId
    : chordQualityShortName(quality);
}

/** Flats, like every other spelling in the app (find-the-note's rule). */
function spell(midi: Midi): NoteName {
  return midiToName(midi, 'flat');
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

/** The qualities this set can actually fit inside `range`. */
function playableQualities(
  settings: ChordQualitySettings,
  span: number,
): readonly ChordQuality[] {
  const playable = settings.qualities.filter(
    (quality) => chordIntervals(quality) !== null && spanOf(quality) <= span,
  );
  // A range under an octave is not a piano (the settings store guards that),
  // so this only ever falls back on a hand-built test range.
  return playable.length > 0 ? playable : ['maj'];
}

function pickRoot(
  rng: () => number,
  low: Midi,
  high: Midi,
  quality: ChordQuality,
): Midi {
  // The whole chord has to fit: the root may go no higher than the top of the
  // instrument minus the chord's span.
  const ceiling = Math.max(low, high - spanOf(quality));
  // Prefer the comfortable middle, but never leave the real range to get it.
  const comfortLow = Math.max(low, COMFORT_LOW);
  const comfortHigh = Math.min(ceiling, COMFORT_HIGH);
  return comfortHigh >= comfortLow
    ? randomInt(rng, comfortLow, comfortHigh)
    : randomInt(rng, low, ceiling);
}

function generate(
  ctx: GenerateContext<ChordQualitySettings>,
): Question<ChordQualityPayload> {
  const { low, high } = ctx.range;
  const choices = playableQualities(ctx.settings, high - low);
  const recent = ctx.history.recentSkillIds;

  let quality = choices[randomInt(ctx.rng, 0, choices.length - 1)];
  // Redraw a few times rather than looping until different: asking the same
  // quality twice in a row is dull, but forcing a change would bias the draw
  // (and could not terminate at all on a one-quality set).
  for (
    let redraw = 0;
    redraw < MAX_REDRAWS &&
    choices.length > 1 &&
    recent[0] === skillIdFor(quality);
    redraw += 1
  ) {
    quality = choices[randomInt(ctx.rng, 0, choices.length - 1)];
  }

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
    answerMode: 'note-sequence',
    expected: {
      kind: 'notes',
      notes,
      label: chordQualityName(quality),
    },
    // No `range`: the answer may be played from any key, so nothing dims.
    spellings: new Map(notes.map((midi) => [midi, spell(midi)])),
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
  skillsCovered: (settings) => settings.qualities.map(skillIdFor),
  skillLabel: (skillId) => chordSkillLabel(skillId),
  generate,
  grade,
};
