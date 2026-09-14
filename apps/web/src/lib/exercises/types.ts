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
 */
export type AnyExercise = ExerciseDefinition;

export interface AttemptResult {
  id: string;
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
