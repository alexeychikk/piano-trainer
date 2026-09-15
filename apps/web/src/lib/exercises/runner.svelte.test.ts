import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVANCE_LOCKOUT_MS,
  ExerciseRunner,
  FEEDBACK_CORRECT_MS,
  FEEDBACK_STREAK_MS,
  IDLE_PAUSE_MS,
  REVEAL_DELAY_MS,
  SEQUENCE_GAP_MS,
} from './runner.svelte';
import type { PlaybackApi } from './playback';
import type {
  AnyExercise,
  AttemptResult,
  ExerciseDefinition,
  Question,
} from './types';

vi.mock('smplr', () => ({
  Soundfont: () => ({
    ready: Promise.resolve(),
    start: () => () => {},
    stop: () => {},
    dispose: () => {},
  }),
}));

const PLAYBACK_MS = 1000;

/**
 * A stand-in exercise: the answer is the seed. It exists to prove the runner
 * is free of any particular exercise — everything it shows comes from the
 * definition (ADR §5).
 */
const stub: ExerciseDefinition<{ midi: number }> = {
  id: 'stub',
  title: 'Stub',
  description: 'Play the note.',
  defaultSettings: {},
  requiresMidi: false,
  skillsCovered: () => ['stub:only'],
  generate: (ctx) => ({
    id: `stub:${ctx.seed}`,
    seed: ctx.seed,
    skillId: `stub:pc:${ctx.seed % 12}`,
    payload: { midi: ctx.seed },
    prompt: { title: 'Which note?', subtitle: 'Play it back' },
    playback: {
      events: [{ atMs: 0, notes: [ctx.seed], durationMs: PLAYBACK_MS }],
    },
    answerMode: 'single-note',
    expected: { kind: 'notes', notes: [ctx.seed], label: `note ${ctx.seed}` },
    range: { low: 21, high: 108 },
  }),
  grade: (question, answer) => {
    const expected = (question as Question<{ midi: number }>).payload.midi;
    const played = answer.kind === 'notes' ? answer.order[0] : -1;
    return played === expected
      ? { correct: true, score: 1 }
      : {
          correct: false,
          score: 0,
          feedback: `You played ${played}`,
          revealed: { notes: [expected] },
        };
  },
};

/**
 * A `note-sequence` stand-in (slice 6): the answer is two notes, and it is
 * graded on the distance between them — the shape the interval exercise has,
 * without the runner learning what an interval is.
 */
const sequenceStub: ExerciseDefinition<{ semitones: number }> = {
  ...stub,
  id: 'stub-sequence',
  generate: (ctx) => ({
    ...stub.generate(ctx),
    payload: { semitones: 7 },
    answerMode: 'note-sequence',
    expected: { kind: 'notes', notes: [60, 67], label: 'perfect 5th' },
  }),
  grade: (question, answer) => {
    const expected = (question as Question<{ semitones: number }>).payload
      .semitones;
    if (answer.kind !== 'notes' || answer.order.length < 2) {
      return { correct: false, score: 0, revealed: { notes: [60, 67] } };
    }
    const played = answer.order[1] - answer.order[0];
    return played === expected
      ? { correct: true, score: 1 }
      : {
          correct: false,
          score: 0,
          feedback: `You played ${played}`,
          revealed: { notes: [60, 67] },
        };
  },
};

function harness(
  definition: AnyExercise = stub,
  options: { targetSkills?: () => readonly string[] } = {},
) {
  const plays: { notes: number[][]; at: number }[] = [];
  const attempts: AttemptResult[] = [];
  let clock = 0;
  let seed = 60;

  const playback: PlaybackApi = {
    play: (plan) => {
      plays.push({ notes: plan.events.map((event) => event.notes), at: clock });
      return PLAYBACK_MS;
    },
    stop: () => {},
    ensureStarted: () => Promise.resolve(),
  };

  const runner = new ExerciseRunner(definition, {
    playback,
    now: () => clock,
    seed: () => seed,
    range: () => ({ low: 21, high: 108 }),
    targetSkills: options.targetSkills,
    onAttempt: (attempt) => attempts.push(attempt),
  });

  return {
    runner,
    plays,
    attempts,
    /** Advance the fake clock and the timers together. */
    tick(ms: number) {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
    /** What `generate()` will answer with next. */
    setNextAnswer(midi: number) {
      seed = midi;
    },
    get answer() {
      return seed;
    },
  };
}

/** Start the drill and run the question's playback out. */
async function started(h: ReturnType<typeof harness>) {
  await h.runner.start();
  h.tick(PLAYBACK_MS);
  return h;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExerciseRunner · presenting', () => {
  it('starts idle and shows nothing until it is started', () => {
    const { runner } = harness();
    expect(runner.phase).toBe('idle');
    expect(runner.question).toBeNull();
    expect(runner.accuracy).toBeNull();
  });

  it('plays the question, then waits for an answer', async () => {
    const h = harness();
    await h.runner.start();
    expect(h.runner.phase).toBe('presenting');
    expect(h.runner.playing).toBe(true);
    expect(h.plays).toHaveLength(1);
    // Notes played before the plan has finished are not answers.
    h.runner.noteOn(60, 'midi');
    expect(h.runner.phase).toBe('presenting');

    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.playing).toBe(false);
    expect(h.runner.question?.prompt.title).toBe('Which note?');
  });

  it('replays on demand and counts the replays', async () => {
    const h = await started(harness());
    h.runner.replay();
    expect(h.runner.replays).toBe(1);
    expect(h.runner.phase).toBe('presenting');
    expect(h.plays).toHaveLength(2);
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
  });
});

describe('ExerciseRunner · correct answers', () => {
  it('scores, shows feedback and auto-advances after 650 ms', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer, 'midi');

    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('correct');
    expect(h.runner.feedback?.headline).toBe('Correct');
    expect(h.runner.answered).toBe(1);
    expect(h.runner.correctCount).toBe(1);
    expect(h.runner.streak).toBe(1);
    expect(h.runner.accuracy).toBe(100);

    h.tick(FEEDBACK_CORRECT_MS - 1);
    expect(h.runner.phase).toBe('feedback');
    h.tick(1);
    expect(h.runner.phase).toBe('presenting');
  });

  it('speeds up to 450 ms at a streak of five', async () => {
    const h = await started(harness());
    for (let i = 0; i < 4; i += 1) {
      h.runner.noteOn(h.answer, 'midi');
      h.tick(FEEDBACK_CORRECT_MS);
      h.tick(PLAYBACK_MS);
    }
    expect(h.runner.streak).toBe(4);

    h.runner.noteOn(h.answer, 'midi');
    expect(h.runner.feedback?.headline).toBe('Correct · 5 in a row');
    h.tick(FEEDBACK_STREAK_MS);
    expect(h.runner.phase).toBe('presenting');
    expect(h.runner.bestStreak).toBe(5);
  });
});

describe('ExerciseRunner · misses', () => {
  it('reveals, replays the answer after 250 ms and waits for the user', async () => {
    const h = await started(harness());
    const expected = h.answer;
    h.runner.noteOn(expected + 1, 'onscreen');

    expect(h.runner.outcome).toBe('wrong');
    expect(h.runner.streak).toBe(0);
    expect(h.runner.revealNotes).toEqual([expected]);
    expect(h.runner.feedback?.headline).toBe(`note ${expected}`);
    expect(h.runner.feedback?.detail).toContain('Space to continue');
    expect(h.plays).toHaveLength(1);

    h.tick(REVEAL_DELAY_MS);
    expect(h.plays).toHaveLength(2);

    // No timeout of its own: a miss is where learning happens (§4.3).
    h.tick(10_000);
    expect(h.runner.phase).toBe('feedback');

    h.runner.space();
    expect(h.runner.phase).toBe('presenting');
    expect(h.runner.outcome).toBeNull();
  });

  it('ignores a note-on until the reveal has been heard, then continues', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer + 1, 'onscreen');

    h.tick(ADVANCE_LOCKOUT_MS - 1);
    h.runner.noteOn(h.answer, 'midi');
    expect(h.runner.phase).toBe('feedback');

    h.tick(1);
    h.runner.noteOn(h.answer, 'midi');
    expect(h.runner.phase).toBe('presenting');
    // Answering the *next* question is a fresh attempt, not a double count.
    expect(h.runner.answered).toBe(1);
  });

  it('skips and reveals on Enter', async () => {
    const h = await started(harness());
    const expected = h.answer;
    h.runner.skip();

    expect(h.runner.outcome).toBe('skipped');
    expect(h.runner.feedback?.detail).toBe('Skipped · Space to continue');
    expect(h.runner.revealNotes).toEqual([expected]);
    expect(h.runner.answered).toBe(1);
    expect(h.runner.correctCount).toBe(0);
    expect(h.runner.accuracy).toBe(0);
  });
});

describe('ExerciseRunner · attempts', () => {
  it('emits one AttemptResult per answer', async () => {
    const h = await started(harness());
    h.runner.replay();
    h.tick(PLAYBACK_MS);
    h.tick(120);
    h.runner.noteOn(h.answer, 'computer-keyboard');

    expect(h.attempts).toHaveLength(1);
    expect(h.attempts[0]).toMatchObject({
      exerciseId: 'stub',
      correct: true,
      score: 1,
      replays: 1,
      answerSource: 'computer-keyboard',
      skillId: h.runner.question?.skillId,
    });
    expect(h.attempts[0].responseMs).toBe(120);
  });
});

describe('ExerciseRunner · pausing', () => {
  it('pauses after 90 s of silence and resumes on space', async () => {
    const h = await started(harness());
    h.tick(IDLE_PAUSE_MS);
    expect(h.runner.phase).toBe('paused');

    h.runner.space();
    expect(h.runner.phase).toBe('presenting');
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
  });

  it('does not pause while the drill is being used', async () => {
    const h = await started(harness());
    for (let i = 0; i < 3; i += 1) {
      h.tick(IDLE_PAUSE_MS - 1);
      // Each interaction re-arms the timer, so the drill stays live.
      h.runner.replay();
      h.tick(PLAYBACK_MS);
    }
    expect(h.runner.phase).toBe('awaiting');
  });

  it('pauses on an abandoned reveal, and comes back to it', async () => {
    // The reveal waits for the user, so it is where a drill gets abandoned —
    // and until slice 9a nothing re-armed the idle timer there.
    const h = await started(harness());
    h.setNextAnswer(61);
    h.runner.noteOn(62, 'midi');
    expect(h.runner.phase).toBe('feedback');
    h.tick(REVEAL_DELAY_MS);
    const playsBefore = h.plays.length;

    h.tick(IDLE_PAUSE_MS);
    expect(h.runner.phase).toBe('paused');

    // Resuming a reveal replays the answer instead of asking the question
    // again: it is graded and logged already.
    h.runner.space();
    expect(h.runner.phase).toBe('feedback');
    expect(h.plays.length).toBe(playsBefore + 1);
    expect(h.attempts).toHaveLength(1);
    // And it is the *same* reveal: the wrong key the user played still carries
    // its ✗ highlight, so they come back to the screen they walked away from.
    expect(h.runner.answerNotes).toEqual([62]);
    expect(h.runner.revealNotes).toEqual([60]);

    // And it can be abandoned twice.
    h.tick(IDLE_PAUSE_MS);
    expect(h.runner.phase).toBe('paused');
  });

  it('a note starts the drill from idle', async () => {
    const h = harness();
    h.runner.noteOn(60, 'midi');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runner.phase).toBe('presenting');
  });
});

describe('ExerciseRunner · note-sequence answers', () => {
  it('collects notes and grades at the expected length', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    // One note is not an answer yet: the drill is still waiting.
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.answerNotes).toEqual([62]);

    h.runner.noteOn(69, 'midi');
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('correct');
    expect(h.attempts).toHaveLength(1);
    expect(h.attempts[0].answerSource).toBe('midi');
  });

  it('closes a short answer after the silence window', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'onscreen');
    h.tick(SEQUENCE_GAP_MS - 1);
    expect(h.runner.phase).toBe('awaiting');

    h.tick(1);
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('wrong');
    // The miss is revealed, seen and heard, like any other (§4.3).
    expect(h.runner.revealNotes).toEqual([60, 67]);
  });

  it('backspace takes back the last note and keeps the answer open', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    h.runner.noteOn(63, 'midi');
    // Two notes already closed a two-note answer, so take one back *before*
    // the second: a fumbled first key must be recoverable.
    expect(h.runner.phase).toBe('feedback');

    h.runner.advance();
    h.tick(PLAYBACK_MS);
    h.runner.noteOn(63, 'midi');
    h.runner.backspace();
    expect(h.runner.answerNotes).toEqual([]);
    expect(h.runner.phase).toBe('awaiting');

    // The window restarts from empty: nothing closes on its own any more.
    h.tick(SEQUENCE_GAP_MS * 2);
    expect(h.runner.phase).toBe('awaiting');

    h.runner.noteOn(62, 'midi');
    h.runner.noteOn(69, 'midi');
    expect(h.runner.outcome).toBe('correct');
  });

  it('an answer in progress survives a replay', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    h.runner.replay();
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.answerNotes).toEqual([62]);

    h.runner.noteOn(69, 'midi');
    expect(h.runner.outcome).toBe('correct');
  });

  it('re-arms the silence window when the gap elapses during a replay', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    h.tick(SEQUENCE_GAP_MS - 500);
    // The replay lasts longer than the 500 ms left on the window, so the gap
    // elapses while the question is presenting — when nothing may be graded.
    h.runner.replay();
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.answerNotes).toEqual([62]);

    // The window runs again from the end of the replay: the answer is still
    // open, and it still closes on its own (§4.3).
    h.tick(SEQUENCE_GAP_MS - 1);
    expect(h.runner.phase).toBe('awaiting');

    h.tick(1);
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('wrong');
  });

  it('starts the next question with an empty answer', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    h.runner.noteOn(69, 'midi');
    h.tick(FEEDBACK_CORRECT_MS);
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.answerNotes).toEqual([]);

    // The first note of the new question is the first note of a new answer,
    // not the second of the old one.
    h.runner.noteOn(60, 'midi');
    expect(h.runner.phase).toBe('awaiting');
  });

  it('honours a question that asks for a longer silence window', async () => {
    // `Question.answerGapMs` (slice 10): a twelve-note cadence may not have
    // the answer taken away while the user hunts for the next chord. The
    // runner reads the number off the question and knows nothing else about
    // it — the default still applies to every question that asks for nothing.
    const longAnswer: ExerciseDefinition<{ semitones: number }> = {
      ...sequenceStub,
      generate: (ctx) => ({
        ...sequenceStub.generate(ctx),
        answerGapMs: SEQUENCE_GAP_MS * 3,
      }),
    };
    const h = await started(harness(longAnswer as AnyExercise));
    h.runner.noteOn(62, 'midi');

    h.tick(SEQUENCE_GAP_MS * 3 - 1);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.answerNotes).toEqual([62]);

    h.tick(1);
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('wrong');
  });

  it('falls back to the default window for a nonsense one', async () => {
    const broken: ExerciseDefinition<{ semitones: number }> = {
      ...sequenceStub,
      generate: (ctx) => ({
        ...sequenceStub.generate(ctx),
        answerGapMs: Number.NaN,
      }),
    };
    const h = await started(harness(broken as AnyExercise));
    h.runner.noteOn(62, 'midi');
    h.tick(SEQUENCE_GAP_MS);
    expect(h.runner.phase).toBe('feedback');
  });

  it('drops a half-played answer when the drill pauses', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    // An explicit pause, because the silence window (1.2 s) always closes an
    // answer long before the 90 s idle pause could reach it.
    h.runner.pause();
    expect(h.runner.phase).toBe('paused');
    // The slots render from `answerNotes`, so the discarded note must leave the
    // screen with the answer — not linger until the next note-on.
    expect(h.runner.answerNotes).toEqual([]);

    h.runner.space();
    h.tick(PLAYBACK_MS);
    expect(h.runner.answerNotes).toEqual([]);
    h.runner.noteOn(60, 'midi');
    h.runner.noteOn(67, 'midi');
    expect(h.runner.outcome).toBe('correct');
  });
});

/**
 * A question that is **read**, not heard (slice 8): its playback is a
 * reference pitch and the answer has a sound of its own, which the reveal
 * plays. The runner still learns nothing about the exercise — it only asks
 * whether the question brought a `revealPlayback` with it.
 */
const readStub: ExerciseDefinition<{ midi: number }> = {
  ...stub,
  id: 'stub-read',
  generate: (ctx) => ({
    ...stub.generate(ctx),
    playback: {
      events: [{ atMs: 0, notes: [ctx.seed], durationMs: PLAYBACK_MS }],
    },
    revealPlayback: {
      events: [
        {
          atMs: 0,
          notes: [ctx.seed, ctx.seed + 4, ctx.seed + 10],
          durationMs: PLAYBACK_MS,
        },
      ],
    },
  }),
};

describe('ExerciseRunner · a question that is read, not heard', () => {
  it('plays the question at ask time and on a replay', async () => {
    const h = await started(harness(readStub));
    expect(h.plays[0].notes).toEqual([[h.answer]]);
    h.runner.replay();
    expect(h.plays[1].notes).toEqual([[h.answer]]);
  });

  it('plays the answer, not the question, when the miss is revealed', async () => {
    const h = await started(harness(readStub));
    const expected = h.answer;
    h.runner.noteOn(expected + 1, 'onscreen');
    h.tick(REVEAL_DELAY_MS);
    expect(h.plays[1].notes).toEqual([[expected, expected + 4, expected + 10]]);

    // And again on demand, while the feedback is up.
    h.runner.replay();
    expect(h.plays[2].notes).toEqual([[expected, expected + 4, expected + 10]]);
  });
});

describe('ExerciseRunner · a targeted run (slice 9a)', () => {
  /** A runner whose seeds climb, so `stub:pc:<seed % 12>` varies per question. */
  function targeted(targets: readonly string[]) {
    let seed = 60;
    const seen: (string | undefined)[] = [];
    // A spy on the stub, typed as the stub is, so `generate` keeps its own
    // settings type and the registry's erasure happens in one place.
    const spy: ExerciseDefinition<{ midi: number }> = {
      ...stub,
      generate: (ctx) => {
        seen.push(ctx.targetSkillId);
        return stub.generate(ctx);
      },
    };
    const runner = new ExerciseRunner(spy as AnyExercise, {
      playback: {
        play: () => 0,
        stop: () => {},
        ensureStarted: () => Promise.resolve(),
      },
      now: () => 0,
      seed: () => (seed += 1),
      range: () => ({ low: 21, high: 108 }),
      targetSkills: () => targets,
    });
    return { runner, seen };
  }

  it('keeps asking until the question is one of the planner’s skills', async () => {
    const { runner, seen } = targeted(['stub:pc:5']);
    await runner.start();
    expect(runner.question?.skillId).toBe('stub:pc:5');
    // The target is handed to `generate()` as well, for an exercise that
    // learns to honour it — the runner still only compares skill ids.
    expect(seen.every((target) => target === 'stub:pc:5')).toBe(true);
  });

  it('accepts whatever it gets when the target never comes up', async () => {
    const { runner, seen } = targeted(['stub:pc:nothing']);
    await runner.start();
    // A target the exercise cannot generate degrades to a normal question
    // rather than hanging the drill — bounded by TARGET_SAMPLE_TRIES.
    expect(runner.question).not.toBeNull();
    expect(seen.length).toBe(16);
  });

  it('is an ordinary drill with no targets', async () => {
    const h = harness();
    await h.runner.start();
    expect(h.runner.question?.skillId).toBe('stub:pc:0');
    expect(h.plays).toHaveLength(1);
  });
});

describe('ExerciseRunner · a mixed session (slice 9b)', () => {
  /** Two stand-in exercises, and a `pickExercise` that alternates them. */
  const other: ExerciseDefinition<{ midi: number }> = {
    ...stub,
    id: 'stub-two',
    title: 'Stub two',
  };

  function mixed(options: { questions?: number } = {}) {
    let asked = 0;
    let seed = 60;
    const picked: string[] = [];
    const ended: number[] = [];
    const attempts: AttemptResult[] = [];
    const runner = new ExerciseRunner(stub, {
      playback: {
        play: () => 0,
        stop: () => {},
        ensureStarted: () => Promise.resolve(),
      },
      now: () => 0,
      seed: () => (seed += 1),
      range: () => ({ low: 21, high: 108 }),
      pickExercise: () => {
        const definition = asked % 2 === 0 ? stub : other;
        asked += 1;
        picked.push(definition.id);
        return definition as AnyExercise;
      },
      shouldContinue: () => asked < (options.questions ?? 99),
      onEnd: () => ended.push(asked),
      onAttempt: (attempt) => attempts.push(attempt),
    });
    return { runner, picked, ended, attempts };
  }

  /** Start and let the (zero-length) playback finish. */
  async function open(runner: ExerciseRunner) {
    await runner.start();
    vi.advanceTimersByTime(0);
  }

  it('asks a different exercise per question, and grades with that one', async () => {
    const { runner, picked, attempts } = mixed();
    await open(runner);
    expect(runner.definition.id).toBe('stub');
    // Answer it: the attempt is logged against the exercise that asked.
    runner.noteOn(0, 'onscreen');
    runner.advance();
    expect(runner.definition.id).toBe('stub-two');
    expect(picked).toEqual(['stub', 'stub-two']);
    expect(attempts[0]?.exerciseId).toBe('stub');
  });

  it('ends between questions — never mid-answer — and says so once', async () => {
    const { runner, ended } = mixed({ questions: 1 });
    await open(runner);
    expect(runner.phase).toBe('awaiting');
    // The time ran out while this question was on screen: it is still
    // answerable, and only the *next* question is refused.
    runner.noteOn(0, 'onscreen');
    expect(runner.phase).toBe('feedback');
    runner.advance();
    expect(runner.phase).toBe('summary');
    expect(ended).toHaveLength(1);
    // A run that has ended stays ended: no timer, no shortcut re-opens it.
    runner.space();
    runner.noteOn(60, 'onscreen');
    expect(runner.phase).toBe('summary');
  });

  it('ends now on `Esc`, whatever it was doing', async () => {
    const { runner, ended } = mixed();
    await open(runner);
    runner.end();
    expect(runner.phase).toBe('summary');
    runner.end();
    expect(ended).toHaveLength(1);
  });

  it('keeps one definition for a plain drill', async () => {
    const h = harness();
    await h.runner.start();
    expect(h.runner.definition.id).toBe('stub');
    h.runner.noteOn(h.answer, 'onscreen');
    h.tick(FEEDBACK_CORRECT_MS);
    expect(h.runner.definition.id).toBe('stub');
    expect(h.runner.phase).toBe('presenting');
  });
});
