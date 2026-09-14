/**
 * The exercise engine contract (ADR 0001 §5). One interface; the runner, and
 * later the progress and spaced-repetition systems, know nothing else. Adding
 * an exercise is a folder under `$lib/exercises/<id>/` plus an entry in
 * `registry.ts` — never a change to the runner.
 *
 * Pure types only: no DOM, no Svelte, no audio. `generate()` and `grade()` are
 * pure functions of their inputs (with a seeded `rng`), which is what makes
 * every exercise unit-testable without a browser.
 *
 * **Extensions to ADR §5**, all display concerns the runner needs and no
 * exercise-specific knowledge:
 * - `Question.range` — the keys this question is answered on, so the runner can
 *   dim the rest (UX spec §5.2) without knowing what the exercise is.
 * - `Question.spellings` — how this question spells its notes, feeding the
 *   keyboard's `labelStyle: 'context'` (UX spec §5.1).
 * - `GenerateContext.range` — the user's instrument range (the range wizard),
 *   which every note-based exercise needs and none should read from storage
 *   itself, so `generate()` stays pure.
 * - `ExpectedAnswer` carries a `label`: the reveal names the answer in text as
 *   well as on the keyboard (UX spec §8.6).
 * - `ExerciseDefinition.skillLabel` — how an exercise names one of its own
 *   skill ids, so `/progress` can label a cell without decoding the id (slice
 *   5a).
 */

import type { Midi, NoteName } from '$lib/theory';
import type { NoteSource } from '$lib/midi/events';

export type ExerciseId = string;
/** The spaced-repetition / mastery unit, e.g. `find-the-note:pc:3`. */
export type SkillId = string;

export interface KeyRange {
  low: Midi;
  high: Midi;
}

export type AnswerMode =
  | 'single-note'
  | 'note-sequence'
  | 'chord-sustained'
  | 'chord-released'
  | 'choice';

export interface PlaybackEvent {
  /** Offset from the start of the plan, in milliseconds. */
  atMs: number;
  notes: Midi[];
  durationMs: number;
  velocity?: number;
}

export interface PlaybackPlan {
  events: PlaybackEvent[];
  tempoBpm?: number;
  /** Force a count-in for this question; otherwise the user's setting wins. */
  countIn?: boolean;
}

export interface Prompt {
  title: string;
  subtitle?: string;
  showKeyboard?: boolean;
}

export interface Choice {
  id: string;
  label: string;
}

export type ExpectedAnswer =
  | { kind: 'notes'; notes: Midi[]; label: string }
  | { kind: 'choice'; choiceId: string; label: string };

export interface Question<P = unknown> {
  /** Unique per asked question — the id of the attempt it produces. */
  id: string;
  /** Reproducible from (exerciseId, seed, settings). */
  seed: number;
  skillId: SkillId;
  payload: P;
  prompt: Prompt;
  playback: PlaybackPlan;
  answerMode: AnswerMode;
  choices?: Choice[];
  expected: ExpectedAnswer;
  /**
   * What the *answer* sounds like, when that is not what the question sounded
   * like — a sixth display extension to ADR §5, and as generic as the other
   * five. A drill that is **read** rather than heard (slice 8: a chord symbol
   * you play) still owes the user the sound of the right answer after a miss,
   * but its question's playback is a reference, not the answer. The runner
   * plays this in the reveal, and `playback` everywhere else; without it the
   * reveal replays the question, as it always has.
   */
  revealPlayback?: PlaybackPlan;
  /**
   * How long a `note-sequence` answer may go silent before it closes itself,
   * overriding the runner's `SEQUENCE_GAP_MS` — a seventh display extension to
   * ADR §5, and as generic as the others: it says how long *this* answer may
   * take, never what it contains.
   *
   * The default window is sized for a two-note interval (slice 6). A twelve-
   * note answer played in three chords (slice 10) needs longer, or the answer
   * is taken away from a beginner mid-cadence — and a per-question override is
   * how `PlaybackPlan` already handles `tempoBpm` and `countIn`: the constant
   * stays in the runner module, the question only says when it does not fit.
   * The idle pause (`IDLE_PAUSE_MS`) still ends an abandoned drill.
   */
  answerGapMs?: number;
  /** Keys this question is answered on; outside them the keyboard dims. */
  range?: KeyRange;
  /** Spelling of the notes in play, for `labelStyle: 'context'`. */
  spellings?: ReadonlyMap<Midi, NoteName>;
}

export type Answer =
  | { kind: 'notes'; notes: Midi[]; order: Midi[]; source: NoteSource }
  | { kind: 'choice'; choiceId: string };

export interface Grade {
  correct: boolean;
  /** 0..1 — partial credit drives mastery (slice 5), not just pass/fail. */
  score: number;
  /** One short line, e.g. `You played a perfect 5th`. */
  feedback?: string;
  /** What to show on the keyboard after a miss. */
  revealed?: { notes?: Midi[]; label?: string };
}

export interface GenerateContext<S> {
  settings: S;
  /** Seeded; an exercise never calls `Math.random()`. */
  rng: () => number;
  seed: number;
  /** The user's instrument range. */
  range: KeyRange;
  /** SR-selected target, once the planner exists (slice 9). */
  targetSkillId?: SkillId;
  history: { recentSkillIds: SkillId[] };
}

export interface SettingsField {
  key: string;
  label: string;
  kind: 'toggle' | 'number' | 'select';
  options?: Choice[];
  min?: number;
  max?: number;
}

export interface ExerciseDefinition<P = unknown, S = Record<string, never>> {
  id: ExerciseId;
  title: string;
  description: string;
  /** Enumerable, for the progress screen (slice 5). */
  skillsCovered(settings: S): SkillId[];
  /**
   * How this exercise names one of its skills — a fifth display extension to
   * ADR §5, as generic as the other four. `/progress` shows a cell per skill
   * and a raw id (`find-the-note:pc:3`) is not a name, but only the exercise
   * knows what `pc:3` means. Optional: without it the screen falls back to the
   * id's last segment, and still learns nothing about the exercise.
   */
  skillLabel?(skillId: SkillId, settings: S): string;
  defaultSettings: S;
  /** Declarative; the runner renders the settings UI (slice 5+). */
  settingsFields?: SettingsField[];
  /** `false` => fully playable with the mouse and the computer keys. */
  requiresMidi: boolean;
  generate(ctx: GenerateContext<S>): Question<P>;
  grade(question: Question<P>, answer: Answer): Grade;
}

/**
 * What the registry holds. Methods (not properties) on purpose: TypeScript
 * checks method parameters bivariantly, so a concretely typed exercise is
 * assignable to the erased type the registry and the runner work with.
 *
 * The erased settings type is `Record<string, unknown>`, not the default
 * `Record<string, never>`: `defaultSettings` is a *property*, so it is checked
 * normally, and slice 4's no-settings exercise was the only one that fitted
 * "every value is `never`". An exercise's settings must therefore be declared
 * as a **type alias**, not an `interface` — only an alias gets the implicit
 * index signature that makes it assignable here.
 */
export type AnyExercise = ExerciseDefinition<unknown, Record<string, unknown>>;

export interface AttemptResult {
  /**
   * The question that was asked. Not unique — storage keys an attempt by
   * `${ts}:${questionId}` (`$lib/storage/db`), because the same question can
   * be asked twice.
   */
  questionId: string;
  ts: number;
  exerciseId: ExerciseId;
  skillId: SkillId;
  seed: number;
  correct: boolean;
  score: number;
  responseMs: number;
  replays: number;
  answerSource: NoteSource | 'choice';
}
