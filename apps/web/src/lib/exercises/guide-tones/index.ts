/**
 * Exercise #7 — "Guide tones" (slice 12): a chord symbol appears, the root
 * sounds underneath as a reference, and the user plays the **3rd and the 7th**
 * — two notes, no root, no 5th. The third playing drill, and the last rung of
 * product pillar 2 (chords & voicings): shells (slice 8) → rootless A/B
 * (slice 11) → guide tones.
 *
 * A guide-tone pair is the smallest thing that still says what a chord is, and
 * the thing that actually moves through a ii-V-I: the 7th of one chord falls a
 * semitone to the 3rd of the next. Drilling the pair alone is what makes that
 * motion visible under the hand, which is why it is drilled *after* the
 * voicings that contain it rather than before them.
 *
 * `$lib/theory/voicings.ts` owns the vocabulary — an exercise never spells a
 * chord itself (the `intervals.ts`/`chords.ts` rule).
 *
 * **The graded quantity is the pair in the asked key**, exactly as slice 8's
 * shell and slice 11's voicing: `Dbmaj7` and `Cmaj7` are one colour and two
 * different shapes, so the key is half the skill. `grade()` is
 * `spellsGuideTones()`: the **pitch classes played must be exactly the two**.
 *
 * - **register, octave, spacing, order** — all free.
 * - **which tone is underneath** — also free, and that is this drill's one
 *   difference from slices 8 and 11. A shell has the root at the bottom and a
 *   rootless form *is* its bass note, but `3-7` and `7-3` are both the pair
 *   every method teaches: which one a hand reaches for is voice leading, not
 *   correctness, and the drill would be teaching a rule the music does not
 *   have.
 * - **root** — must **not** be played: a root, a 3rd and a 7th is the shell,
 *   which is slice 8's answer and the habit this drill exists to break, so it
 *   is a *named* near-miss rather than a bare ✗.
 * - **the 5th** — likewise: the whole chord and the rootless voicing are named
 *   too, in this drill's own vocabulary (slice 11's rule), and so is one guide
 *   tone played beside the 5th (`E G` for `Cmaj7` — the triad player's reflex,
 *   and a pair that is nobody else's guide tones, so nothing else names it).
 * - **doubling** — free (LH `3-7` + RH `7-3` passes). Grading is pitch-class set plus lowest
 *   note. On the `note-sequence` path (mouse, computer keys) a doubled note
 *   still uses up one of the answer's N notes, because that path closes at
 *   the expected length (ADR 0004 §3).
 *   There a doubled note leaves the other guide tone unplayed, and it gets
 *   its own line because it is a *near* miss, not a wrong pair. The answer
 *   mode is `chord-released`: from a MIDI port it closes when every key is
 *   up; the mouse and computer keys close on two note-ons.
 * - **enharmonics** — equal for free: integer arithmetic on MIDI numbers.
 *
 * Scoring is **binary** (ADR §10): one of two guide tones is not a guide-tone
 * pair, and partial credit would report a key as half-learned to the mastery
 * EWMA.
 *
 * `generate()` and `grade()` are pure and take the seeded `rng`, so a question
 * is reproducible from `(exerciseId, seed, settings, range)` and both are
 * unit-tested without a browser (ADR §5).
 */

import {
  GUIDE_TONE_DEGREES,
  MIDDLE_C,
  chordFifth,
  chordSymbolText,
  guideToneDegree,
  guideToneNotes,
  guideTonePitchClasses,
  guideToneReadings,
  guideToneSpan,
  hasGuideTones,
  intervalsAboveBass,
  isChordQuality,
  pcOf,
  qualityOfIntervals,
  qualityOfShellIntervals,
  spellsGuideTones,
  spellsRootlessInAnyInversion,
  spellsShellInAnyInversion,
  type ChordQuality,
  type GuideToneDegree,
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

export const GUIDE_TONES_ID = 'guide-tones';

export interface GuideTonesPayload {
  /** The key asked for — the root the pair is named from and never plays. */
  rootPc: PitchClass;
  /** Where the reference root sounds, below the pair. */
  rootMidi: Midi;
  quality: ChordQuality;
}

/**
 * A **type alias**, not an `interface`: the registry's erased `AnyExercise`
 * types settings as `Record<string, unknown>`, and only an alias gets the
 * implicit index signature that makes it assignable (`types.ts`).
 */
export type GuideTonesSettings = {
  /** The qualities in play, in no particular order. */
  qualities: readonly ChordQuality[];
};

/**
 * The starter set: slices 8 and 11's three, which are also the ii-V-I's own
 * vocabulary — the cadence these pairs are learned for.
 *
 * Out, for slice 8's reasons: `dim7`'s "7th" is a diminished 7th, so it has no
 * 3rd-and-7th pair at all, and `min7b5`'s pair *is* `min7`'s (the flat 5th is
 * not a guide tone), so drilling it would be drilling the same two notes under
 * a second name. `minMaj7` has a pair of its own (`voicings.ts` builds it), but
 * it belongs to the melodic-minor world a beginner meets much later, so it is
 * registered vocabulary and not a drilled default.
 */
export const STARTER_QUALITIES: readonly ChordQuality[] = [
  'maj7',
  'dom7',
  'min7',
];

/**
 * How long the answer may go silent before it closes (`Question.answerGapMs`,
 * the runner's per-question override). The runner's 1200 ms default is sized
 * for *echoing* something you just heard (slice 6's interval, slice 7's
 * chord). This is a **construction** drill like slices 8 and 11: the pair has
 * to be worked out from a symbol in a key you may not own yet, and two notes
 * is not two quick notes — the gap between them is where the thinking happens.
 * 2.5 s is slice 11's window, for slice 11's reason; the idle pause still ends
 * an abandoned drill.
 */
const ANSWER_GAP_MS = 2500;

/**
 * Where the reference root is drawn from when the range allows: the octave
 * below middle C up to the D above it, as slices 8 and 11. The pair itself
 * then lands in the octave above it, which is where a right hand comps guide
 * tones over a bass note.
 */
const COMFORT = { low: MIDDLE_C - 12, high: MIDDLE_C + 2 };

/**
 * The mastery unit is **the chord**: `guide-tones:<quality>:<rootPc>`, 36
 * cells for the starter set — slice 8's shape exactly, and for slice 8's
 * reason: what is weak in a playing drill is a *key*, and a per-quality
 * average would hide the keys the drill exists to expose. There is no second
 * dimension to split on here (slice 11 had the form; a pair has no forms),
 * so the grid costs one `/progress` group of 36 cells — the same size as the
 * shell drill's, and half of the rootless drill's 72.
 */
export function skillIdFor(quality: ChordQuality, rootPc: PitchClass): SkillId {
  return `${GUIDE_TONES_ID}:${quality}:${rootPc}`;
}

/**
 * What a skill id is called in the `/progress` grid — `Cmaj7`, the chord
 * symbol a chart would print. (The same label as the shell drill's cells, one
 * group up: `/progress` groups cells per exercise, so the group's title is
 * what tells the two apart.) An id this exercise does not recognise comes back
 * unchanged (`skill-id.ts`: a skill id read back is untrusted input).
 */
export function guideTonesSkillLabel(skillId: SkillId): string {
  const skill = parseSkillId(skillId);
  return skill === null
    ? skillId
    : chordSymbolText(skill.rootPc, skill.quality);
}

/**
 * The chord a skill id names, or `null` for anything else — an id read back
 * is untrusted input, and a quality with no guide-tone pair was never a skill
 * here.
 */
export function parseSkillId(
  skillId: SkillId,
): { quality: ChordQuality; rootPc: PitchClass } | null {
  const segments = skillIdSegments(skillId, GUIDE_TONES_ID, 2);
  if (segments === null) return null;
  const [quality, root] = segments;
  const rootPc = pitchClassSegment(root);
  if (rootPc === null || !isChordQuality(quality)) return null;
  return hasGuideTones(quality) ? { quality, rootPc } : null;
}

/**
 * The keys a `quality` pair can be asked in on `range`: those with an octave
 * of the reference root low enough for the 7th to fit above it. All twelve on
 * any keyboard that spans the pair plus an octave; none for a quality with no
 * 3rd-and-7th pair.
 */
function buildableRoots(quality: ChordQuality, range: KeyRange): PitchClass[] {
  if (!hasGuideTones(quality)) return [];
  return pitchClassesIn(range.low, range.high - guideToneSpan(quality));
}

/**
 * The qualities of this set that `generate()` can ask on `range` — a pair of
 * their own, in at least one key that fits. No fallback: an empty set means
 * nothing to ask (`coverage.ts`).
 */
export function buildableQualities(
  settings: GuideTonesSettings,
  range: KeyRange,
): ChordQuality[] {
  return settings.qualities.filter(
    (quality) => buildableRoots(quality, range).length > 0,
  );
}

/**
 * Where the reference root sounds: an occurrence of the asked pitch class that
 * still leaves the 7th inside the instrument, preferring the register a left
 * hand would put a bass note in.
 *
 * Anchoring on the root is right here and wrong in slice 11: there the root is
 * *not* played and the voicing sits up to 19 semitones above it, so the
 * anchor was the bass note. A guide-tone pair sits inside one octave of its
 * root, so the root anchors both itself and the pair.
 */
function pickRoot(
  rng: () => number,
  low: Midi,
  high: Midi,
  rootPc: PitchClass,
  quality: ChordQuality,
): Midi {
  const window = { low, high: Math.max(low, high - guideToneSpan(quality)) };
  // A range so narrow that no octave of the root fits under the 7th is not a
  // piano either; place it as low as it goes and let the top poke out.
  return (
    pickOccurrence(rng, rootPc, window, COMFORT) ?? lowestFrom(rootPc, low)
  );
}

function generate(
  ctx: GenerateContext<GuideTonesSettings>,
): Question<GuideTonesPayload> {
  const { low, high } = ctx.range;
  const choices = buildableQualities(ctx.settings, ctx.range);
  if (choices.length === 0) throw new NothingToAskError(GUIDE_TONES_ID);

  // The planner's target, asked exactly when this drill can build it.
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
  const notes = guideToneNotes(rootMidi, quality) ?? [rootMidi];
  const symbol = chordSymbolText(rootPc, quality);
  const payload: GuideTonesPayload = { rootPc, rootMidi, quality };

  return {
    // Derived from the seed, not `crypto.randomUUID()`: `generate()` is pure,
    // and the seed is what makes a logged attempt reproducible.
    id: `${GUIDE_TONES_ID}:${ctx.seed}:${rootMidi}:${quality}`,
    seed: ctx.seed,
    skillId: skillIdFor(quality, rootPc),
    payload,
    prompt: {
      // The chord symbol *is* the question — this drill is read, not heard.
      title: symbol,
      subtitle: `Play the guide tones: ${GUIDE_TONE_DEGREES} — no root`,
      showKeyboard: true,
    },
    // The root alone, low: the bass player's note. It cannot give the answer
    // away — it is one of the notes the answer must *not* contain (slice 11's
    // reference, one voicing smaller). The reveal plays the two guide tones
    // and only them — never the shell or the whole chord, which are shapes
    // this drill did not ask for (slice 11's reveal rule).
    ...referenceThenReveal(rootMidi, notes),
    answerMode: 'chord-released',
    answerGapMs: ANSWER_GAP_MS,
    expected: {
      kind: 'notes',
      notes,
      label: `${symbol} guide tones`,
    },
    // No `range`: the pair may be played in any octave, so nothing dims.
    spellings: spellings(notes),
  };
}

/**
 * The other half of the pair, named. Typed as the union `guideToneDegree()`
 * returns, so neither side of this can drift into a string the drill does not
 * use — a typo here or there stops compiling instead of waiting for a test.
 */
function otherDegree(degree: GuideToneDegree): GuideToneDegree {
  return degree === '3rd' ? '7th' : '3rd';
}

/**
 * Which chord these two pitch classes are the guide tones of, named the way
 * this drill would ask for it — or `null`.
 *
 * A pair reads as two chords (`guideToneReadings()`: the music's ambiguity,
 * not a defect), so the reading nearest the question wins: the **asked key**
 * first — that is the "you played the other quality's 3rd" mistake, and saying
 * `C7` when `Cm7` was asked is the most useful sentence there is — then the
 * **asked quality**, which names a transposition as a transposition.
 */
function nameOfPair(
  pcs: readonly PitchClass[],
  rootPc: PitchClass,
  quality: ChordQuality,
): string | null {
  const readings = guideToneReadings(pcs);
  if (readings.length === 0) return null;
  const chosen =
    readings.find((reading) => reading.rootPc === rootPc) ??
    readings.find((reading) => reading.quality === quality) ??
    readings[0];
  return `${chordSymbolText(chosen.rootPc, chosen.quality)} guide tones`;
}

/** How a miss is explained — one short line, a teacher's tone (UX §9). */
export function missDetail(
  rootPc: PitchClass,
  quality: ChordQuality,
  played: readonly Midi[],
): string | undefined {
  // One note is a *named* near-miss here, not too little to talk about: the
  // answer is only two long, so half of it is the commonest miss in the drill
  // (slices 8 and 11 start at two because their answers are three and four).
  if (played.length === 0) return undefined;
  if (spellsGuideTones(played, rootPc, quality)) return undefined;

  const pcs = [...new Set(played.map((midi) => pcOf(midi)))];
  const bassPc = pcOf(Math.min(...played.map((midi) => Math.round(midi))));

  // Half the pair — either the 3rd or the 7th on its own, or the same one
  // twice (on the note-sequence path a doubling costs the other, since that
  // answer closes at two notes).
  if (pcs.length === 1) {
    const degree = guideToneDegree(rootPc, quality, pcs[0]);
    if (degree !== null) {
      const other = otherDegree(degree);
      return played.length === 1
        ? `That is the ${degree} — the ${other} is the other guide tone`
        : `You played the ${degree} twice — the ${other} is missing`;
    }
  }

  // **The right pair with the root on top of it** — the mistake this drill
  // exists to break, so it is named before anything else that is also true.
  // The precondition is the asked pair *plus* the root, not merely "the root
  // is in there somewhere": a pair belonging to another chord often contains
  // the asked root by coincidence (`Dbmaj7`'s pair contains C), and telling
  // that user they added a root would be plainly false. The shell is the shape
  // slice 8 taught and the one a hand reaches for out of habit, so it is named
  // first within this branch.
  const wanted = guideTonePitchClasses(rootPc, quality) ?? [];
  const playedThePair = wanted.every((pc) => pcs.includes(pc));
  if (pcs.includes(rootPc) && playedThePair) {
    if (spellsShellInAnyInversion(played, rootPc, quality))
      return `That is the shell — guide tones are the ${GUIDE_TONE_DEGREES} alone`;
    return 'You played the root — the bass has it, the guide tones do not';
  }

  // Rootless, but not down to the pair: the 5th and the 9th are colour, not
  // guide tones (slice 11's answer, named in its own vocabulary).
  if (spellsRootlessInAnyInversion(played, rootPc, quality))
    return `That is the rootless voicing — the guide tones are the ${GUIDE_TONE_DEGREES}`;

  // **A guide tone plus the 5th** — one right note and the note a hand that
  // learned triads first reaches for instead of the other one (`Cmaj7` played
  // as `E G`). It is two chord tones *of the asked chord*, so it is named in
  // the asked key and in this drill's own vocabulary, exactly as slice 8 names
  // "a shell leaves the 5th out".
  //
  // It is narrow on purpose (slice 8's precedent): **exactly two pitch
  // classes**, one of them the asked chord's own guide tone and the other its
  // own 5th. So it cannot reach the shell, the rootless voicing, the whole
  // chord or another key — those have more notes or no guide tone of this
  // chord in them, and all of them keep the lines they already had. It sits
  // ahead of `nameOfPair()` because the only readings that pair can have are
  // `minMaj7` ones in a distant key (a guide tone and a 5th are 3 or 4
  // semitones apart, and only `minMaj7`'s pair spans that) — a chord this
  // drill never asks for, while both notes belong to the chord on screen.
  // `nameOfPair()`'s *asked-key* reading can never be lost here: a chord's own
  // pair is the 3rd and the 7th, never its 5th.
  const fifth = chordFifth(quality);
  const fifthPc = fifth === null ? null : pcOf(rootPc + fifth);
  const besideTheFifth = pcs.filter((pc) => pc !== fifthPc);
  if (pcs.length === 2 && fifthPc !== null && besideTheFifth.length === 1) {
    const degree = guideToneDegree(rootPc, quality, besideTheFifth[0]);
    if (degree !== null)
      return `That is the ${degree} and the 5th — the ${otherDegree(degree)} is the other guide tone`;
  }

  // Another chord's pair: the neighbouring key, or the other quality's 3rd
  // played over the right 7th. Naming it makes the mistake visible as a chord
  // instead of as noise.
  const pair = nameOfPair(pcs, rootPc, quality);
  if (pair !== null) return `You played the ${pair}`;

  // Something larger in some other key: fall back on the shell and the whole
  // chord, as slices 8 and 11 do.
  const shell = qualityOfShellIntervals(intervalsAboveBass(played));
  if (shell !== null)
    return `You played the ${chordSymbolText(bassPc, shell)} shell`;
  const whole = qualityOfIntervals(intervalsAboveBass(played));
  if (whole !== null)
    return `You played ${chordSymbolText(bassPc, whole)} in full`;

  // Nothing nameable — but if the root is in there, say so: it is the one
  // note this drill is about leaving out, and a bare ✗ would waste the miss.
  return pcs.includes(rootPc)
    ? 'You played the root — the bass has it, the guide tones do not'
    : undefined;
}

function grade(question: Question<GuideTonesPayload>, answer: Answer): Grade {
  const { rootPc, rootMidi, quality } = question.payload;
  const notes = guideToneNotes(rootMidi, quality) ?? [rootMidi];
  const reveal = {
    notes,
    label: `${chordSymbolText(rootPc, quality)} guide tones`,
  };

  // An empty sequence is not an answer; one note is, and it is graded (and
  // named) like any other wrong pair.
  if (answer.kind !== 'notes' || answer.notes.length === 0)
    return { correct: false, score: 0, revealed: reveal };

  if (spellsGuideTones(answer.notes, rootPc, quality))
    return { correct: true, score: 1 };

  return {
    // Binary, per ADR §10.
    correct: false,
    score: 0,
    feedback: missDetail(rootPc, quality, answer.notes),
    revealed: reveal,
  };
}

export const guideTones: ExerciseDefinition<
  GuideTonesPayload,
  GuideTonesSettings
> = {
  id: GUIDE_TONES_ID,
  title: 'Guide tones',
  description:
    'A chord symbol appears. Play its guide tones — the 3rd and the 7th, no root.',
  defaultSettings: {
    qualities: STARTER_QUALITIES,
  },
  requiresMidi: false,
  // A quality with no 3rd-and-7th pair, or a key whose pair does not fit the
  // keyboard, has nothing to ask, so it puts no unanswerable cell on
  // `/progress`.
  skillsCovered: (settings, range) =>
    buildableQualities(settings, range).flatMap((quality) =>
      buildableRoots(quality, range).map((rootPc) =>
        skillIdFor(quality, rootPc),
      ),
    ),
  skillLabel: (skillId) => guideTonesSkillLabel(skillId),
  generate,
  grade,
};
