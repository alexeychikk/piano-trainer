/**
 * The exercise runner (ADR §5, UX spec §4): the state machine
 * `idle → presenting → awaiting → grading → feedback → next`, plus the score
 * and streak the status strip shows.
 *
 * It knows the `ExerciseDefinition` contract and nothing about any particular
 * exercise: the question text, the sound, the expected answer and the grading
 * all come from the definition, so a second exercise is a new folder and a
 * registry entry, never a change here.
 *
 * Grading is synchronous and the audio is scheduled on the audio clock, so the
 * only timers are the drill's own delays — the constants below, which UX spec
 * §4.3 asks to keep in exactly one place.
 */

import { metronome } from '$lib/audio/metronome.svelte';
import type { NoteSource } from '$lib/midi/events';
import { settings } from '$lib/storage/settings.svelte';
import type { Midi } from '$lib/theory';
import {
  feedbackAnnouncement,
  feedbackLines,
  STREAK_CALLOUT,
  type FeedbackLines,
  type Outcome,
} from './feedback';
import { NothingToAskError } from './coverage';
import { createAudioPlayback, type PlaybackApi } from './playback';
import { mulberry32, randomSeed } from './rng';
import type {
  AnyExercise,
  AttemptResult,
  ExpectedAnswer,
  KeyRange,
  PlaybackPlan,
  Question,
  SkillId,
} from './types';

// ---- drill rhythm (UX spec §4.3) ----------------------------------------

/** Correct → next question. */
export const FEEDBACK_CORRECT_MS = 650;
/** Correct at a streak of `STREAK_CALLOUT` or more — the drill speeds up. */
export const FEEDBACK_STREAK_MS = 450;
/**
 * Skip → auto-replay the answer, while the question is still in memory. A
 * miss no longer reveals (retry until correct, 2026-10-06): it re-arms the
 * same question, and the answer is heard only when the user asks for it.
 */
export const REVEAL_DELAY_MS = 250;
/** No input for this long → `paused`, audio stopped. */
export const IDLE_PAUSE_MS = 90_000;
/**
 * How long feedback ignores note-ons before one may advance the drill. Not in
 * the spec: without it the key that was just graded — or the second note of a
 * fumbled answer — would skip past the reveal before it has been heard.
 */
export const ADVANCE_LOCKOUT_MS = 500;
/**
 * `note-sequence` (ADR §3, UX §4.3): the answer closes after this much silence
 * — or as soon as it is the expected length, which is the usual way it ends.
 *
 * The default, sized for the two- and three-note answers slices 6–8 ask for. A
 * question whose answer is longer says so with `Question.answerGapMs`; the
 * number still lives here, and that one lives with the exercise that needs it.
 */
export const SEQUENCE_GAP_MS = 1200;
/**
 * Chord capture (ADR 0004 §2): how long the held set must be still — no
 * counted note-on or note-off — to be a *moment*. It covers a rolled chord and
 * two hands that do not land together (ADR 0001 §3's settling window).
 */
export const CHORD_SETTLE_MS = 90;
/**
 * Chord capture: how long every key must stay up before a chord is finished.
 * It covers a hand coming back — a left-hand root lifted just before the right
 * hand lands is still one chord.
 */
export const CHORD_RELEASE_MS = 250;

/** How many recent skills an exercise may see, to avoid immediate repeats. */
const HISTORY_LENGTH = 8;
/**
 * How many seeds a targeted run (`?due=1`) may try before it accepts whatever
 * `generate()` gave it. Rejection sampling is how the runner biases a drill
 * towards the planner's skills **without learning anything about the
 * exercise**: it only compares `Question.skillId` with the list it was handed,
 * and `generate()` stays the only thing that knows how to build a question.
 * Every registered exercise honours `GenerateContext.targetSkillId` when it
 * can build it, so the first try lands and the loop costs nothing; the loop
 * is what still biases a run when the most urgent skill cannot be built and
 * a later target could.
 */
const TARGET_SAMPLE_TRIES = 16;

/**
 * How the answer in progress is being captured (ADR 0004 §1): `null` until its
 * first note-on, `'chord'` when a `chord-released` question's first note came
 * from a MIDI port, `'sequence'` otherwise. The frame reads it for the slots.
 */
export type CaptureMode = 'sequence' | 'chord';

export type RunnerPhase =
  | 'idle'
  | 'presenting'
  | 'awaiting'
  | 'feedback'
  | 'paused'
  /** The run is over: a mixed session out of time, or `Esc` (UX §4.2). */
  | 'summary';

export interface RunnerOptions {
  playback?: PlaybackApi;
  /** Milliseconds, for response times. */
  now?: () => number;
  /** Seed source for the next question. */
  seed?: () => number;
  /** The instrument range; defaults to the user's configured keyboard. */
  range?: () => KeyRange;
  /**
   * The skills this run should favour, most urgent first — the planner's
   * (slice 9a, `$lib/practice/planner.ts`). Empty or absent means "anything",
   * which is what a plain `/practice/<id>` run passes.
   */
  targetSkills?: () => readonly SkillId[];
  /**
   * Which exercise the next question comes from — a **mixed session**
   * (slice 9b) hands one per question, a plain drill hands none and the
   * definition never changes. The runner asks before it generates and grades
   * with whatever came back, so it still knows nothing about any exercise.
   */
  pickExercise?: () => AnyExercise | null;
  /**
   * Whether there is another question at all. Checked between questions only,
   * so a session that runs out of time never cuts an answer in half; `false`
   * ends the run in `summary` (UX §4.2).
   */
  shouldContinue?: () => boolean;
  /** The run ended — the screen shows the summary (UX §4.8). */
  onEnd?: () => void;
  onAttempt?: (attempt: AttemptResult) => void;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export class ExerciseRunner {
  phase = $state<RunnerPhase>('idle');
  question = $state<Question | null>(null);
  /** What the user played for the current question. */
  answerNotes = $state<Midi[]>([]);
  /** How the answer in progress is captured; `null` before its first note. */
  capture = $state<CaptureMode | null>(null);
  /**
   * The chords chord capture has captured so far (each ascending, deduped) —
   * the frame fills one slot per chord from these. Empty on every other path.
   */
  capturedChords = $state<Midi[][]>([]);
  /** The expected notes, once revealed. */
  revealNotes = $state<Midi[]>([]);
  outcome = $state<Outcome | null>(null);
  feedback = $state<FeedbackLines | null>(null);
  /** Polite live-region text; one announcement per question and per answer. */
  announcement = $state('');
  /** True while the question's playback is still sounding. */
  playing = $state(false);
  /**
   * The run ended because the exercise had nothing it could build under its
   * settings on this keyboard (`NothingToAskError`, `coverage.ts`) — not
   * because it was over. The frame says so instead of ending silently.
   */
  nothingToAsk = $state(false);

  answered = $state(0);
  correctCount = $state(0);
  streak = $state(0);
  bestStreak = $state(0);
  replays = $state(0);

  accuracy: number | null = $derived(
    this.answered === 0
      ? null
      : Math.round((this.correctCount / this.answered) * 100),
  );

  /**
   * The exercise the current question came from. Reactive because a mixed
   * session changes it per question (the rail shows *this* exercise's title,
   * §9) — for a plain drill it is the definition it was constructed with and
   * never moves.
   */
  definition: AnyExercise = $state<AnyExercise>()!;

  #playback: PlaybackApi;
  #now: () => number;
  #seed: () => number;
  #range: () => KeyRange;
  #targetSkills: () => readonly SkillId[];
  #pickExercise: () => AnyExercise | null;
  #shouldContinue: () => boolean;
  #onEnd: (() => void) | null;
  #onAttempt: ((attempt: AttemptResult) => void) | null;

  #timer: ReturnType<typeof setTimeout> | null = null;
  #idleTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Its own timer, not `#timer`: a replay during `awaiting` schedules on
   * `#timer`, and an answer in progress must survive hearing the question
   * again.
   */
  #sequenceTimer: ReturnType<typeof setTimeout> | null = null;
  /** The `note-sequence` answer as it is being played, in played order. */
  #sequence: { midi: Midi; source: NoteSource }[] = [];
  // ---- chord capture (ADR 0004 §2) ----
  /** Keys down now that were pressed during this answer. */
  #held = new Set<Midi>();
  /** Keys pressed since the last moment. */
  #pending = new Set<Midi>();
  /** Whether a counted key went up since the last moment. */
  #offSinceMoment = false;
  /** Every counted pitch, in first-note-on order (the answer's `order`). */
  #firstOn: Midi[] = [];
  #settleTimer: ReturnType<typeof setTimeout> | null = null;
  #releaseTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Whether the pause happened on a reveal. A drill abandoned during feedback
   * must still reach `paused` (§4.3), and coming back to it should put the
   * reveal back — not silently skip to the next question.
   */
  #pausedInFeedback = false;
  /**
   * Whether this question's attempt has been emitted. Retry until correct: a
   * wrong answer re-arms the same question, and only the **first** answer to
   * it — right, wrong or skipped — is the attempt (score, streak, the log).
   */
  #attempted = false;
  #recent: SkillId[] = [];
  #askedAt = 0;
  #feedbackAt = 0;

  constructor(definition: AnyExercise, options: RunnerOptions = {}) {
    this.definition = definition;
    this.#playback = options.playback ?? createAudioPlayback();
    this.#now = options.now ?? defaultNow;
    this.#seed = options.seed ?? randomSeed;
    this.#range =
      options.range ??
      (() => ({
        low: settings.value.keyboardLow,
        high: settings.value.keyboardHigh,
      }));
    this.#targetSkills = options.targetSkills ?? (() => []);
    this.#pickExercise = options.pickExercise ?? (() => null);
    this.#shouldContinue = options.shouldContinue ?? (() => true);
    this.#onEnd = options.onEnd ?? null;
    this.#onAttempt = options.onAttempt ?? null;
  }

  // ---- input -------------------------------------------------------------

  /**
   * `Space` (UX spec §4.5): start, replay, continue or resume, depending on
   * where the drill is. One entry point, so the shortcut cannot drift from the
   * button next to it.
   */
  space(): void {
    switch (this.phase) {
      case 'idle':
        void this.start();
        return;
      case 'paused':
        this.resume();
        return;
      case 'awaiting':
        this.replay();
        return;
      case 'feedback':
        this.advance();
        return;
      default:
        // `presenting`: the question is still playing; let it finish.
        return;
    }
  }

  /** Start the drill (from a user gesture: it makes a sound). */
  async start(): Promise<void> {
    if (this.phase !== 'idle') return;
    await this.#playback.ensureStarted();
    this.#next();
  }

  /** Replay the question. Counts towards `AttemptResult.replays`. */
  replay(): void {
    if (!this.question) return;
    if (this.phase === 'awaiting') {
      this.replays += 1;
      this.#present();
      return;
    }
    if (this.phase === 'feedback') {
      // The reveal, on demand — the state machine stays where it is.
      this.#replayReveal();
    }
  }

  /** `Enter` — skip and reveal (UX spec §4.3). */
  skip(): void {
    if (this.phase !== 'awaiting' || !this.question) return;
    this.#finish('skipped', { correct: false, score: 0 }, [], 'onscreen');
  }

  /** A note from any source (UX spec §4.4 `single-note`: first note commits). */
  noteOn(midi: Midi, source: NoteSource): void {
    switch (this.phase) {
      case 'idle':
        void this.start();
        return;
      case 'paused':
        this.resume();
        return;
      case 'feedback':
        // Any note-on continues, once the reveal has had time to be heard.
        if (this.#now() - this.#feedbackAt >= ADVANCE_LOCKOUT_MS)
          this.advance();
        return;
      case 'awaiting':
        break;
      default:
        return;
    }

    const question = this.question;
    if (!question) return;
    // The first note of another try takes the miss off the screen: its ✗
    // keys and its line give way to the new answer's slots.
    if (this.outcome === 'wrong') this.#clearMiss();
    if (question.answerMode === 'chord-released') {
      // The path is chosen per answer, from its first note's source (ADR 0004
      // §1): a MIDI port is captured as a chord, everything else as today's
      // sequence. Once a chord capture has started, other sources still sound
      // but are not graded — one answer, one path.
      if (this.capture === null)
        this.capture = source === 'midi' ? 'chord' : 'sequence';
      if (this.capture === 'chord') {
        if (source !== 'midi') return;
        this.#armIdleTimer();
        this.#chordNoteOn(midi);
        return;
      }
    }
    this.#armIdleTimer();
    if (
      question.answerMode === 'note-sequence' ||
      question.answerMode === 'chord-released'
    ) {
      this.capture = 'sequence';
      this.#appendToSequence(question, midi, source);
      return;
    }
    // Slice 4 ships `single-note`, slice 6 `note-sequence`; the chord and
    // choice modes arrive with the exercises that need them (UX §4.4), and
    // until then a note is not an answer.
    if (question.answerMode !== 'single-note') return;

    const grade = this.definition.grade(question, {
      kind: 'notes',
      notes: [midi],
      order: [midi],
      source,
    });
    this.#finish(
      grade.correct ? 'correct' : 'wrong',
      grade,
      [midi],
      source,
      grade.feedback,
    );
  }

  /**
   * A key went up. Only chord capture listens (ADR 0004 §2): a sequence answer
   * is made of note-ons, and a key that was already down when the answer began
   * — held from the reveal, or the note that advanced the drill — was never
   * counted, so its release is ignored too. Heard during a replay as well, so
   * a chord released while the question replays does not stay "held".
   */
  noteOff(midi: Midi, source: NoteSource): void {
    if (this.phase !== 'awaiting' && this.phase !== 'presenting') return;
    if (this.capture !== 'chord' || source !== 'midi') return;
    if (!this.#held.delete(midi)) return;
    this.#offSinceMoment = true;
    if (this.phase === 'awaiting') this.#armIdleTimer();
    if (this.#held.size > 0) {
      this.#armSettleTimer();
      return;
    }
    this.#clearSettleTimer();
    // A stab (rule 4): released before it settled, still a chord if it was
    // more than one key. A single unsettled key is a graze and is dropped.
    if (this.#pending.size >= 2) this.#commitMoment([...this.#pending]);
    this.#pending.clear();
    this.#armReleaseTimer();
  }

  /**
   * `Backspace` — take back the last note of a `note-sequence` answer
   * (UX §4.4, §4.5). Nothing is graded yet, so this is the only way to undo a
   * fumbled key, and it restarts the silence window rather than closing it.
   */
  backspace(): void {
    if (this.phase !== 'awaiting' || this.#sequence.length === 0) return;
    this.#sequence.pop();
    this.answerNotes = this.#sequence.map((note) => note.midi);
    this.#clearSequenceTimer();
    if (this.#sequence.length > 0) this.#armSequenceTimer();
    // An answer taken all the way back has no first note any more, so the
    // next one picks the capture path again (ADR 0004 §1).
    else this.capture = null;
  }

  /** Continue after feedback. */
  advance(): void {
    if (this.phase !== 'feedback') return;
    this.#next();
  }

  /**
   * End the run now — `Esc` in a session (UX §4.5), which goes to the summary
   * rather than back to the exercise list. Idempotent, and a no-op for a run
   * that has already ended.
   */
  end(): void {
    if (this.phase === 'summary') return;
    this.#end();
  }

  #end(): void {
    this.#clearTimer();
    this.#clearIdleTimer();
    this.#resetSequence();
    this.#pausedInFeedback = false;
    this.#playback.stop();
    this.playing = false;
    this.phase = 'summary';
    this.#onEnd?.();
  }

  pause(): void {
    if (
      this.phase === 'idle' ||
      this.phase === 'paused' ||
      this.phase === 'summary'
    ) {
      return;
    }
    this.#pausedInFeedback = this.phase === 'feedback';
    this.#clearTimer();
    this.#clearIdleTimer();
    // 90 s of silence ends an answer *in progress*: whatever half of a
    // sequence was played is not something to come back to. A graded answer is
    // a different thing — `#finish` already emptied the sequence and left
    // `answerNotes` as the ✓/✗ highlights of the reveal, so pausing on it must
    // keep them: `resume()` returns to that reveal, and it has to be the
    // screen the user walked away from.
    if (!this.#pausedInFeedback) this.#resetSequence();
    else this.#clearSequenceTimer();
    this.#playback.stop();
    this.playing = false;
    this.phase = 'paused';
    this.announcement = 'Paused';
  }

  resume(): void {
    if (this.phase !== 'paused' || !this.question) return;
    if (this.#pausedInFeedback) {
      // Back onto the reveal the user walked away from: the answer is graded
      // and logged already, so re-presenting the question would ask it twice.
      this.#pausedInFeedback = false;
      this.phase = 'feedback';
      this.#feedbackAt = this.#now();
      this.#armIdleTimer();
      this.#replayReveal();
      return;
    }
    this.#present();
  }

  /** Leave the drill: stop the sound and drop every timer. */
  destroy(): void {
    this.#pausedInFeedback = false;
    this.#clearTimer();
    this.#clearIdleTimer();
    this.#resetSequence();
    this.#playback.stop();
    this.playing = false;
  }

  // ---- note-sequence answers (UX §4.4) -----------------------------------

  /**
   * Append a note to the answer in progress and decide whether it closes it:
   * at the expected length immediately (the usual way a two-note interval or a
   * short dictation ends), otherwise after `SEQUENCE_GAP_MS` of silence, so a
   * short answer is never stuck waiting for a note that is not coming.
   */
  #appendToSequence(question: Question, midi: Midi, source: NoteSource): void {
    this.#sequence.push({ midi, source });
    this.answerNotes = this.#sequence.map((note) => note.midi);
    const expected = expectedLength(question.expected);
    if (expected > 0 && this.#sequence.length >= expected) {
      this.#closeSequence();
      return;
    }
    this.#armSequenceTimer();
  }

  /** Grade whatever has been played. Called at length or after the silence. */
  #closeSequence(): void {
    const question = this.question;
    if (!question || this.phase !== 'awaiting') return;
    this.#clearSequenceTimer();
    const order = this.#sequence.map((note) => note.midi);
    // The answer's source is the source of its last note: mixing a MIDI piano
    // and the computer keys mid-answer is legal (nothing downstream may ask
    // where a note came from), and the log stores one source.
    const source =
      this.#sequence[this.#sequence.length - 1]?.source ?? 'onscreen';
    const grade = this.definition.grade(question, {
      kind: 'notes',
      notes: [...order],
      order,
      source,
    });
    this.#finish(
      grade.correct ? 'correct' : 'wrong',
      grade,
      order,
      source,
      grade.feedback,
    );
  }

  /**
   * The silence window of the answer in progress: the question's own
   * (`Question.answerGapMs` — a long answer needs longer, slice 10) or the
   * drill's default. A question that asks for a shorter window than none at
   * all would close every answer instantly, so anything below zero is the
   * default too.
   */
  #gapMs(): number {
    const asked = this.question?.answerGapMs;
    return asked !== undefined && Number.isFinite(asked) && asked >= 0
      ? asked
      : SEQUENCE_GAP_MS;
  }

  /**
   * The silence window. Chord capture reuses it with its own close (ADR 0004
   * §2 rule 5) — the two paths never run in one answer.
   */
  #armSequenceTimer(close: () => void = () => this.#closeSequence()): void {
    this.#clearSequenceTimer();
    this.#sequenceTimer = setTimeout(() => {
      this.#sequenceTimer = null;
      close();
    }, this.#gapMs());
  }

  #clearSequenceTimer(): void {
    if (this.#sequenceTimer === null) return;
    clearTimeout(this.#sequenceTimer);
    this.#sequenceTimer = null;
  }

  #resetSequence(): void {
    this.#clearSequenceTimer();
    this.#resetChordCapture();
    this.capture = null;
    this.#sequence = [];
    // The slots render from `answerNotes`, so dropping the sequence has to drop
    // what is drawn with it: a paused question that came back showing a note it
    // no longer counts would only self-correct on the next note-on. The two
    // callers that keep an answer (`#finish`, `#next`) assign straight after.
    this.answerNotes = [];
  }

  // ---- chord capture (ADR 0004 §2) ---------------------------------------

  #chordNoteOn(midi: Midi): void {
    this.#held.add(midi);
    this.#pending.add(midi);
    if (!this.#firstOn.includes(midi)) this.#firstOn.push(midi);
    // A key going down continues the gesture: neither the chord nor the
    // answer is finished while the hands are still playing.
    this.#clearReleaseTimer();
    this.#clearSequenceTimer();
    this.#armSettleTimer();
  }

  /**
   * The held set has been still for `CHORD_SETTLE_MS`. It is a moment when a
   * key pressed since the last one is still down (rule 1) — so a key grazed
   * while a chord is held, down and up inside the window, never makes or joins
   * one (rule 2). Either way the pending keys are spent.
   */
  #onSettle(): void {
    if (this.#held.size === 0) return;
    const fresh = [...this.#pending].some((midi) => this.#held.has(midi));
    if (fresh) this.#commitMoment([...this.#held]);
    this.#pending.clear();
  }

  /**
   * Where a moment goes (rule 3): a single-chord question merges every moment
   * into its one chord; a multi-chord question starts the next chord when a
   * key went up since the last moment, and merges otherwise.
   */
  #commitMoment(notes: readonly Midi[]): void {
    const chords = this.capturedChords.map((chord) => [...chord]);
    const startsNew =
      this.#answerChords() > 1 && this.#offSinceMoment && chords.length > 0;
    if (startsNew || chords.length === 0) chords.push([]);
    const last = chords.length - 1;
    chords[last] = ascendingUnique([...chords[last], ...notes]);
    this.#offSinceMoment = false;
    this.capturedChords = chords;
    this.answerNotes = ascendingUnique(chords.flat());
  }

  /**
   * Every key has been up for `CHORD_RELEASE_MS` (rule 5): close the answer
   * if enough chords are in, otherwise wait out the silence window. Nothing
   * captured at all (only grazes) is not an answer: the capture starts over,
   * and the next first note picks the path again.
   */
  #onRelease(): void {
    if (this.#held.size > 0 || this.phase !== 'awaiting') return;
    if (this.capturedChords.length === 0) {
      this.#resetChordCapture();
      this.capture = null;
      return;
    }
    if (this.capturedChords.length >= this.#answerChords()) {
      this.#closeChord();
      return;
    }
    this.#armSequenceTimer(() => this.#closeChord());
  }

  /** Grade the captured chords (ADR 0004 §2, "the `Answer` the drill receives"). */
  #closeChord(): void {
    const question = this.question;
    if (!question || this.phase !== 'awaiting') return;
    if (this.#held.size > 0 || this.capturedChords.length === 0) return;
    const chords = this.capturedChords.map((chord) => [...chord]);
    const notes = ascendingUnique(chords.flat());
    const order = this.#firstOn.filter((midi) => notes.includes(midi));
    const grade = this.definition.grade(question, {
      kind: 'notes',
      notes,
      order,
      source: 'midi',
      chords,
    });
    this.#finish(
      grade.correct ? 'correct' : 'wrong',
      grade,
      notes,
      'midi',
      grade.feedback,
    );
  }

  /** `Question.answerChords`, validated: a whole number of at least one. */
  #answerChords(): number {
    const asked = this.question?.answerChords;
    return asked !== undefined && Number.isInteger(asked) && asked >= 1
      ? asked
      : 1;
  }

  #armSettleTimer(): void {
    this.#clearSettleTimer();
    this.#settleTimer = setTimeout(() => {
      this.#settleTimer = null;
      this.#onSettle();
    }, CHORD_SETTLE_MS);
  }

  #clearSettleTimer(): void {
    if (this.#settleTimer === null) return;
    clearTimeout(this.#settleTimer);
    this.#settleTimer = null;
  }

  #armReleaseTimer(): void {
    this.#clearReleaseTimer();
    this.#releaseTimer = setTimeout(() => {
      this.#releaseTimer = null;
      this.#onRelease();
    }, CHORD_RELEASE_MS);
  }

  #clearReleaseTimer(): void {
    if (this.#releaseTimer === null) return;
    clearTimeout(this.#releaseTimer);
    this.#releaseTimer = null;
  }

  #resetChordCapture(): void {
    this.#clearSettleTimer();
    this.#clearReleaseTimer();
    this.#held.clear();
    this.#pending.clear();
    this.#offSinceMoment = false;
    this.#firstOn = [];
    this.capturedChords = [];
  }

  // ---- machine -----------------------------------------------------------

  #next(): void {
    // Between questions is the only place a run can end: an answer in
    // progress is never cut off, and a reveal is never taken off the screen
    // before it has been read (UX §4.3).
    if (!this.#shouldContinue()) {
      this.#end();
      return;
    }
    // A mixed session picks the exercise first; everything below — the
    // question, the grading, the attempt it emits — is that exercise's.
    this.definition = this.#pickExercise() ?? this.definition;
    let question: Question;
    try {
      question = this.#generate();
    } catch (error) {
      // Nothing this exercise can build on this keyboard (`coverage.ts`): end
      // the run rather than ask a question from outside its settings. A
      // session never gets here — it only mixes exercises that can ask.
      if (!(error instanceof NothingToAskError)) throw error;
      this.nothingToAsk = true;
      this.#end();
      return;
    }
    this.#recent = [question.skillId, ...this.#recent].slice(0, HISTORY_LENGTH);
    this.question = question;
    this.outcome = null;
    this.feedback = null;
    this.#attempted = false;
    this.#resetSequence();
    this.answerNotes = [];
    this.revealNotes = [];
    this.replays = 0;
    this.announcement = [question.prompt.title, question.prompt.subtitle]
      .filter(Boolean)
      .join('. ');
    this.#present();
  }

  /**
   * Ask for a question — and, on a targeted run, keep asking until one of the
   * planner's skills comes up (`TARGET_SAMPLE_TRIES` seeds at most, so a
   * target the exercise cannot currently generate degrades to a normal
   * question instead of hanging the drill). Each try hands the exercise the
   * next target in turn, so a most-urgent skill it cannot build does not stop
   * it asking the second one exactly.
   */
  #generate(): Question {
    const targets = this.#targetSkills();
    let question = this.#generateOnce(targets[0]);
    if (targets.length === 0) return question;
    const wanted = new Set(targets);
    for (
      let i = 1;
      !wanted.has(question.skillId) && i < TARGET_SAMPLE_TRIES;
      i += 1
    ) {
      question = this.#generateOnce(targets[i % targets.length]);
    }
    return question;
  }

  #generateOnce(targetSkillId: SkillId | undefined): Question {
    const seed = this.#seed();
    return this.definition.generate({
      settings: this.definition.defaultSettings,
      rng: mulberry32(seed),
      seed,
      range: this.#range(),
      targetSkillId,
      history: { recentSkillIds: [...this.#recent] },
    });
  }

  /** Play the question and hold the answer back until it has finished. */
  #present(): void {
    const question = this.question;
    if (!question) return;
    this.#clearIdleTimer();
    this.phase = 'presenting';
    const durationMs = this.#play(question.playback);
    this.#setTimer(() => {
      this.playing = false;
      this.phase = 'awaiting';
      this.#askedAt = this.#now();
      this.#armIdleTimer();
      // A replay during `awaiting` keeps the half-played answer, so it must
      // keep the answer's silence window too: `#closeSequence()` refuses to
      // grade while `presenting`, so a gap that elapsed during the replay was
      // swallowed and nothing re-armed it — the answer stayed open with no way
      // of closing itself. Restart it from the end of the playback, which is
      // when the silence the user is being timed on actually begins.
      if (this.#sequence.length > 0) this.#armSequenceTimer();
      // The same for a chord answer whose keys all went up during the replay:
      // its release was swallowed by `presenting`, so restart it here.
      if (this.capture === 'chord' && this.#held.size === 0)
        this.#armReleaseTimer();
    }, durationMs);
  }

  /** Schedule a plan on the audio clock. Returns how long it lasts, in ms. */
  #play(plan: PlaybackPlan): number {
    this.playing = true;
    this.#playback.stop();
    return this.#playback.play(plan, {
      countIn: settings.value.countIn,
      bpm: metronome.bpm,
      beatsPerBar: metronome.beatsPerBar,
    });
  }

  /**
   * Play the answer during feedback. Nothing advances the machine here, so
   * this is also what clears `playing` again — otherwise the replay control
   * would stay disabled for the rest of the question.
   *
   * The reveal is `revealPlayback` when the question has one (a question that
   * is read rather than heard: its playback is a reference, and only the
   * answer is worth hearing afterwards), otherwise the question itself.
   */
  #replayReveal(): void {
    const question = this.question;
    if (!question) return;
    const durationMs = this.#play(question.revealPlayback ?? question.playback);
    this.#setTimer(() => {
      this.playing = false;
    }, durationMs);
  }

  #finish(
    outcome: Outcome,
    grade: { correct: boolean; score: number },
    notes: Midi[],
    source: NoteSource,
    detail?: string,
  ): void {
    const question = this.question;
    if (!question) return;
    this.#clearTimer();
    this.#clearIdleTimer();
    // A graded answer is closed: a late note belongs to the feedback phase
    // (where it advances the drill), never to the sequence just played.
    this.#resetSequence();

    this.answerNotes = notes;
    this.outcome = outcome;
    // Only the first answer to a question counts (retry until correct): a
    // right answer after a miss is not a correct one, and a skip after a miss
    // is not a second wrong one.
    const first = !this.#attempted;
    if (first) {
      this.#attempted = true;
      this.answered += 1;
      if (grade.correct) {
        this.correctCount += 1;
        this.streak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
      } else {
        this.streak = 0;
      }
    }
    // Only a skip reveals; a miss keeps the question (and its answer) open.
    if (outcome === 'skipped')
      this.revealNotes = expectedNotes(question.expected);

    const expectedLabel = question.expected.label;
    this.feedback = feedbackLines({
      outcome,
      expectedLabel,
      detail,
      streak: this.streak,
    });
    this.announcement = feedbackAnnouncement({
      outcome,
      expectedLabel,
      detail,
    });

    if (first) this.#emit(question, grade, source);

    if (outcome === 'wrong') {
      // Retry until correct: the same question stays up and takes another
      // answer at once. Nothing is revealed or replayed — that would hand over
      // the answer; `Enter` (skip & reveal) is how the user asks for it.
      this.phase = 'awaiting';
      this.#armIdleTimer();
      return;
    }

    this.phase = 'feedback';
    this.#feedbackAt = this.#now();
    // A reveal waits for the user, so it is exactly where a drill gets
    // abandoned — and until slice 9a nothing re-armed the idle timer here, so
    // an abandoned reveal never reached `paused` and kept the audio context
    // and the question on screen for good (pre-existing since slice 4).
    this.#armIdleTimer();

    if (outcome === 'correct') {
      // The drill speeds up as you get sharper (§4.3).
      const delay =
        this.streak >= STREAK_CALLOUT
          ? FEEDBACK_STREAK_MS
          : FEEDBACK_CORRECT_MS;
      this.#setTimer(() => this.advance(), delay);
      return;
    }
    // A skip waits for the user — but hears the right answer first.
    this.#setTimer(() => this.#replayReveal(), REVEAL_DELAY_MS);
  }

  /** Another try has begun: the miss leaves the screen, the question stays. */
  #clearMiss(): void {
    this.outcome = null;
    this.feedback = null;
    this.answerNotes = [];
  }

  #emit(
    question: Question,
    grade: { correct: boolean; score: number },
    source: NoteSource,
  ): void {
    this.#onAttempt?.({
      questionId: question.id,
      ts: Date.now(),
      exerciseId: this.definition.id,
      skillId: question.skillId,
      seed: question.seed,
      correct: grade.correct,
      score: grade.score,
      responseMs: Math.max(0, Math.round(this.#now() - this.#askedAt)),
      replays: this.replays,
      answerSource: source,
    });
  }

  // ---- timers ------------------------------------------------------------

  #setTimer(run: () => void, ms: number): void {
    this.#clearTimer();
    this.#timer = setTimeout(
      () => {
        this.#timer = null;
        run();
      },
      Math.max(0, ms),
    );
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  /** Session auto-pause after 90 s with no input (§4.3). */
  #armIdleTimer(): void {
    this.#clearIdleTimer();
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = null;
      this.pause();
    }, IDLE_PAUSE_MS);
  }

  #clearIdleTimer(): void {
    if (this.#idleTimer === null) return;
    clearTimeout(this.#idleTimer);
    this.#idleTimer = null;
  }
}

function ascendingUnique(notes: readonly Midi[]): Midi[] {
  return [...new Set(notes)].sort((a, b) => a - b);
}

function expectedNotes(expected: ExpectedAnswer): Midi[] {
  return expected.kind === 'notes' ? [...expected.notes] : [];
}

/**
 * How many notes a `note-sequence` answer is expected to have — the length of
 * the expected notes, and `0` when the exercise does not answer in notes at
 * all (then only the silence window can close it).
 */
export function expectedLength(expected: ExpectedAnswer): number {
  return expected.kind === 'notes' ? expected.notes.length : 0;
}
