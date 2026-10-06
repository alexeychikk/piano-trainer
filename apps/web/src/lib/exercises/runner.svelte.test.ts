import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVANCE_LOCKOUT_MS,
  CHORD_RELEASE_MS,
  CHORD_SETTLE_MS,
  ExerciseRunner,
  FEEDBACK_CORRECT_MS,
  FEEDBACK_STREAK_MS,
  IDLE_PAUSE_MS,
  REVEAL_DELAY_MS,
  SEQUENCE_GAP_MS,
} from './runner.svelte';
import { NothingToAskError } from './coverage';
import type { PlaybackApi } from './playback';
import type {
  Answer,
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

describe('ExerciseRunner · misses (retry until correct)', () => {
  it('keeps the same question and takes another answer at once', async () => {
    const h = await started(harness());
    const expected = h.answer;
    const question = h.runner.question;
    h.runner.noteOn(expected + 1, 'onscreen');

    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.question).toBe(question);
    expect(h.runner.outcome).toBe('wrong');
    expect(h.runner.streak).toBe(0);
    expect(h.runner.answerNotes).toEqual([expected + 1]);
    expect(h.runner.feedback?.headline).toBe('Try again');
    expect(h.runner.feedback?.detail).toBe(
      `You played ${expected + 1} · Enter to reveal`,
    );
    expect(h.runner.announcement).toBe(
      `Incorrect. You played ${expected + 1}. Try again.`,
    );

    // No timeout of its own, and still the same question (§4.3).
    h.tick(10_000);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.question).toBe(question);

    // Right on the next try, from another source: correct, then on as today.
    h.runner.noteOn(expected, 'midi');
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('correct');
    expect(h.runner.feedback?.headline).toBe('Correct');
    h.tick(FEEDBACK_CORRECT_MS);
    expect(h.runner.phase).toBe('presenting');
  });

  it('neither reveals nor plays the answer on a miss', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer + 1, 'onscreen');
    h.tick(REVEAL_DELAY_MS * 4);

    expect(h.runner.revealNotes).toEqual([]);
    expect(h.runner.feedback?.headline).not.toContain(`${h.answer}`);
    expect(h.runner.announcement).not.toContain(`note ${h.answer}`);
    expect(h.plays).toHaveLength(1);
  });

  it('takes the miss off the screen when the next try begins', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(60, 'midi');
    h.runner.noteOn(64, 'midi');
    expect(h.runner.outcome).toBe('wrong');

    h.runner.noteOn(62, 'midi');
    expect(h.runner.outcome).toBeNull();
    expect(h.runner.feedback).toBeNull();
    expect(h.runner.answerNotes).toEqual([62]);
    h.runner.noteOn(69, 'midi');
    expect(h.runner.outcome).toBe('correct');
  });

  it('replays the question on Space while retrying', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer + 1, 'onscreen');
    h.runner.space();

    expect(h.runner.phase).toBe('presenting');
    expect(h.plays).toHaveLength(2);
    expect(h.plays[1].notes).toEqual(h.plays[0].notes);
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
  });

  it('pauses on an abandoned retry, like any open question', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer + 1, 'onscreen');
    h.tick(IDLE_PAUSE_MS);
    expect(h.runner.phase).toBe('paused');
    h.runner.space();
    h.tick(PLAYBACK_MS);
    expect(h.runner.phase).toBe('awaiting');
    h.runner.noteOn(h.answer, 'midi');
    expect(h.runner.outcome).toBe('correct');
  });

  it('skips and reveals on Enter', async () => {
    const h = await started(harness());
    const expected = h.answer;
    h.runner.skip();

    expect(h.runner.outcome).toBe('skipped');
    expect(h.runner.feedback?.headline).toBe(`note ${expected}`);
    expect(h.runner.feedback?.detail).toBe('Skipped · Space to continue');
    expect(h.runner.revealNotes).toEqual([expected]);
    expect(h.runner.answered).toBe(1);
    expect(h.runner.correctCount).toBe(0);
    expect(h.runner.accuracy).toBe(0);

    // The answer is heard after the reveal delay, and the drill waits.
    expect(h.plays).toHaveLength(1);
    h.tick(REVEAL_DELAY_MS);
    expect(h.plays).toHaveLength(2);
    h.tick(10_000);
    expect(h.runner.phase).toBe('feedback');
  });

  it('reveals on Enter after a miss, and then continues', async () => {
    const h = await started(harness());
    const expected = h.answer;
    h.runner.noteOn(expected + 1, 'onscreen');
    h.runner.skip();

    expect(h.runner.outcome).toBe('skipped');
    expect(h.runner.revealNotes).toEqual([expected]);
    h.runner.space();
    expect(h.runner.phase).toBe('presenting');
    expect(h.runner.outcome).toBeNull();
    expect(h.runner.revealNotes).toEqual([]);
  });

  it('ignores a note-on until the reveal has been heard, then continues', async () => {
    const h = await started(harness());
    h.runner.skip();

    h.tick(ADVANCE_LOCKOUT_MS - 1);
    h.runner.noteOn(h.answer, 'midi');
    expect(h.runner.phase).toBe('feedback');

    h.tick(1);
    h.runner.noteOn(h.answer, 'midi');
    expect(h.runner.phase).toBe('presenting');
    // Answering the *next* question is a fresh attempt, not a double count.
    expect(h.runner.answered).toBe(1);
  });
});

describe('ExerciseRunner · only the first try is the attempt', () => {
  it('records a miss, and neither the retries nor the right answer', async () => {
    const h = await started(harness());
    h.tick(300);
    h.runner.noteOn(h.answer + 1, 'onscreen');
    h.runner.noteOn(h.answer + 2, 'onscreen');
    h.runner.noteOn(h.answer, 'midi');

    expect(h.attempts).toHaveLength(1);
    expect(h.attempts[0]).toMatchObject({
      correct: false,
      score: 0,
      answerSource: 'onscreen',
      responseMs: 300,
    });
    // The score and the streak read the first try too.
    expect(h.runner.answered).toBe(1);
    expect(h.runner.correctCount).toBe(0);
    expect(h.runner.streak).toBe(0);
    expect(h.runner.bestStreak).toBe(0);
    expect(h.runner.accuracy).toBe(0);
  });

  it('records nothing more for a skip after a miss', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer + 1, 'onscreen');
    h.runner.skip();
    expect(h.attempts).toHaveLength(1);
    expect(h.runner.answered).toBe(1);
  });

  it('starts counting afresh on the next question', async () => {
    const h = await started(harness());
    h.runner.noteOn(h.answer + 1, 'onscreen');
    h.runner.noteOn(h.answer, 'midi');
    h.tick(FEEDBACK_CORRECT_MS);
    h.tick(PLAYBACK_MS);

    h.runner.noteOn(h.answer, 'midi');
    expect(h.attempts.map((attempt) => attempt.correct)).toEqual([false, true]);
    expect(h.runner.answered).toBe(2);
    expect(h.runner.correctCount).toBe(1);
    expect(h.runner.streak).toBe(1);
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
    h.runner.skip();
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
    // And it is the *same* reveal the user walked away from.
    expect(h.runner.outcome).toBe('skipped');
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
    expect(h.runner.outcome).toBe('wrong');
    // A miss like any other: the question stays open for another try.
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.revealNotes).toEqual([]);
  });

  it('backspace takes back the last note and keeps the answer open', async () => {
    const h = await started(harness(sequenceStub));
    h.runner.noteOn(62, 'midi');
    h.runner.noteOn(63, 'midi');
    // Two notes already closed a two-note answer, so take one back *before*
    // the second: a fumbled first key must be recoverable.
    expect(h.runner.outcome).toBe('wrong');

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
    expect(h.runner.outcome).toBe('wrong');
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

  it('plays the answer, not the question, when it is revealed', async () => {
    const h = await started(harness(readStub));
    const expected = h.answer;
    h.runner.skip();
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

  it('hands every target to `generate()` in turn, not only the first', async () => {
    const { runner, seen } = targeted(['stub:pc:nothing', 'stub:pc:nope']);
    await runner.start();
    expect(seen.slice(0, 4)).toEqual([
      'stub:pc:nothing',
      'stub:pc:nope',
      'stub:pc:nothing',
      'stub:pc:nope',
    ]);
  });

  it('is an ordinary drill with no targets', async () => {
    const h = harness();
    await h.runner.start();
    expect(h.runner.question?.skillId).toBe('stub:pc:0');
    expect(h.plays).toHaveLength(1);
  });
});

describe('ExerciseRunner · nothing to ask', () => {
  it('ends the run instead of asking when the exercise can build nothing', async () => {
    const empty: ExerciseDefinition<{ midi: number }> = {
      ...stub,
      skillsCovered: () => [],
      generate: () => {
        throw new NothingToAskError('stub');
      },
    };
    const h = harness(empty as AnyExercise);
    await h.runner.start();
    expect(h.runner.phase).toBe('summary');
    expect(h.runner.question).toBeNull();
    expect(h.plays).toHaveLength(0);
    // …and says why, so the frame can explain instead of ending silently.
    expect(h.runner.nothingToAsk).toBe(true);
  });

  it('does not flag an ordinary run, nor one that is ended', async () => {
    const h = harness();
    await h.runner.start();
    expect(h.runner.nothingToAsk).toBe(false);
    h.runner.end();
    expect(h.runner.phase).toBe('summary');
    expect(h.runner.nothingToAsk).toBe(false);
  });

  it('still lets any other error through', async () => {
    const broken: ExerciseDefinition<{ midi: number }> = {
      ...stub,
      generate: () => {
        throw new Error('bug');
      },
    };
    await expect(harness(broken as AnyExercise).runner.start()).rejects.toThrow(
      'bug',
    );
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
    runner.skip();
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
    runner.skip();
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

// ---- chord capture (ADR 0004) ---------------------------------------------

/** Every answer a chord stub was graded on, newest last. */
const graded: Answer[] = [];

/**
 * A `chord-released` stand-in: Cmaj7, graded the way every chord drill grades
 * — pitch-class set plus lowest note — so doublings and two hands are free and
 * the runner still learns nothing about chords.
 */
const chordStub: ExerciseDefinition<{ answerChords?: number }> = {
  ...stub,
  id: 'stub-chord',
  generate: (ctx) => ({
    ...stub.generate(ctx),
    payload: {},
    answerMode: 'chord-released',
    expected: { kind: 'notes', notes: [60, 64, 67, 71], label: 'Cmaj7' },
  }),
  grade: (_question, answer) => {
    graded.push(answer);
    if (answer.kind !== 'notes' || answer.notes.length === 0)
      return { correct: false, score: 0 };
    const pcs = [...new Set(answer.notes.map((midi) => midi % 12))].sort(
      (a, b) => a - b,
    );
    const bass = Math.min(...answer.notes) % 12;
    return pcs.join(',') === '0,4,7,11' && bass === 0
      ? { correct: true, score: 1 }
      : { correct: false, score: 0, feedback: 'Not Cmaj7' };
  },
};

/** Three chords to an answer — the shape of the ii-V-I, graded on the count. */
const multiChordStub: AnyExercise = {
  ...(chordStub as AnyExercise),
  id: 'stub-multi-chord',
  generate: (ctx) => ({
    ...chordStub.generate(ctx as never),
    answerChords: 3,
  }),
  grade: (_question, answer) => {
    graded.push(answer);
    const ok = answer.kind === 'notes' && answer.chords?.length === 3;
    return { correct: ok, score: ok ? 1 : 0 };
  },
};

function press(
  h: ReturnType<typeof harness>,
  notes: number[],
  source = 'midi',
) {
  for (const midi of notes) h.runner.noteOn(midi, source as 'midi');
}

function lift(h: ReturnType<typeof harness>, notes: number[], source = 'midi') {
  for (const midi of notes) h.runner.noteOff(midi, source as 'midi');
}

function lastAnswer(): Extract<Answer, { kind: 'notes' }> {
  const answer = graded[graded.length - 1];
  if (answer?.kind !== 'notes') throw new Error('no notes answer');
  return answer;
}

describe('ExerciseRunner · chord capture (ADR 0004)', () => {
  beforeEach(() => {
    graded.length = 0;
  });

  it('re-arms chord capture after a missed chord, and records only the miss', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 63, 67, 70]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 63, 67, 70]);
    h.tick(CHORD_RELEASE_MS);
    expect(h.runner.outcome).toBe('wrong');
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.capture).toBeNull();
    expect(h.runner.capturedChords).toEqual([]);

    // The next try is a fresh capture of the same question.
    press(h, [60, 64, 67, 71]);
    expect(h.runner.outcome).toBeNull();
    expect(h.runner.capture).toBe('chord');
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(h.runner.outcome).toBe('correct');
    expect(lastAnswer().chords).toEqual([[60, 64, 67, 71]]);
    expect(h.attempts.map((attempt) => attempt.correct)).toEqual([false]);
  });

  it('restarts a multi-chord answer from its first chord after a miss', async () => {
    const h = await started(harness(multiChordStub));
    for (let i = 0; i < 2; i += 1) {
      press(h, [60, 64, 67, 71]);
      h.tick(CHORD_SETTLE_MS);
      lift(h, [60, 64, 67, 71]);
      h.tick(CHORD_RELEASE_MS);
    }
    h.tick(SEQUENCE_GAP_MS);
    expect(h.runner.outcome).toBe('wrong');
    expect(lastAnswer().chords).toHaveLength(2);

    for (let i = 0; i < 3; i += 1) {
      press(h, [60, 64, 67, 71]);
      h.tick(CHORD_SETTLE_MS);
      lift(h, [60, 64, 67, 71]);
      h.tick(CHORD_RELEASE_MS);
    }
    expect(h.runner.outcome).toBe('correct');
    expect(lastAnswer().chords).toHaveLength(3);
  });

  it('closes a two-hand chord with a doubling on release, and grades it right', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    // LH root + RH Cmaj7 with the root doubled — four note-ons would have
    // closed a sequence answer on the doubled C.
    press(h, [48, 60, 64, 67, 71]);
    expect(h.runner.capture).toBe('chord');
    h.tick(CHORD_SETTLE_MS);
    expect(h.runner.phase).toBe('awaiting');
    expect(h.runner.capturedChords).toEqual([[48, 60, 64, 67, 71]]);

    lift(h, [48, 60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS - 1);
    expect(h.runner.phase).toBe('awaiting');
    h.tick(1);
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('correct');
    expect(lastAnswer()).toEqual({
      kind: 'notes',
      notes: [48, 60, 64, 67, 71],
      order: [48, 60, 64, 67, 71],
      source: 'midi',
      chords: [[48, 60, 64, 67, 71]],
    });
    expect(h.attempts[0].answerSource).toBe('midi');
  });

  it('reads a rolled chord as one chord', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    for (const midi of [60, 64, 67, 71]) {
      press(h, [midi]);
      h.tick(CHORD_SETTLE_MS + 30);
    }
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().chords).toEqual([[60, 64, 67, 71]]);
    expect(h.runner.outcome).toBe('correct');
  });

  it('merges a left-hand root lifted 150 ms before the right hand lands', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [48]);
    h.tick(CHORD_SETTLE_MS + 10);
    lift(h, [48]);
    h.tick(150);
    press(h, [64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().chords).toEqual([[48, 64, 67, 71]]);
    expect(h.runner.outcome).toBe('correct');
  });

  it('drops a key grazed while the chord is held', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    press(h, [62]);
    h.tick(40);
    lift(h, [62]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().notes).toEqual([60, 64, 67, 71]);
    expect(h.runner.outcome).toBe('correct');
  });

  it('drops a lone graze before the chord', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [59]);
    h.tick(30);
    lift(h, [59]);
    // Nothing captured: the release does not close an answer.
    h.tick(CHORD_RELEASE_MS + 2000);
    expect(h.runner.phase).toBe('awaiting');
    expect(graded).toHaveLength(0);

    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().notes).toEqual([60, 64, 67, 71]);
    expect(lastAnswer().order).toEqual([60, 64, 67, 71]);
  });

  it('counts a wrong key that is held through a settle', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64, 67, 71, 62]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 64, 67, 71, 62]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().notes).toEqual([60, 62, 64, 67, 71]);
    expect(h.runner.outcome).toBe('wrong');
  });

  it('counts a stab shorter than the settle window', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS - 40);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().chords).toEqual([[60, 64, 67, 71]]);
    expect(h.runner.outcome).toBe('correct');
  });

  it('counts a single note held through a settle', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [64]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [64]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().notes).toEqual([64]);
  });

  it('never closes while a key is held, and the silence window waits for the release', async () => {
    const h = await started(harness(multiChordStub));
    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    h.tick(10_000);
    expect(h.runner.phase).toBe('awaiting');

    lift(h, [60, 64, 67, 71]);
    // One chord of three: the release arms the silence window instead.
    h.tick(CHORD_RELEASE_MS);
    expect(h.runner.phase).toBe('awaiting');
    h.tick(SEQUENCE_GAP_MS - 1);
    expect(h.runner.phase).toBe('awaiting');
    h.tick(1);
    expect(h.runner.outcome).toBe('wrong');
    expect(lastAnswer().chords).toHaveLength(1);
  });

  it('reads three chords from full lifts', async () => {
    const h = await started(harness(multiChordStub));
    for (const chord of [
      [50, 53, 57, 60],
      [43, 59, 62, 65],
      [48, 64, 67, 71],
    ]) {
      press(h, chord);
      h.tick(CHORD_SETTLE_MS);
      lift(h, chord);
      h.tick(CHORD_RELEASE_MS + 100);
    }
    expect(lastAnswer().chords).toEqual([
      [50, 53, 57, 60],
      [43, 59, 62, 65],
      [48, 64, 67, 71],
    ]);
    expect(h.runner.outcome).toBe('correct');
  });

  it('reads three chords voice-led with common tones held', async () => {
    const h = await started(harness(multiChordStub));
    // Dm7 → G7 → Cmaj7, holding D/F then F/B across the changes.
    press(h, [50, 53, 57, 60]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [57, 60]);
    press(h, [55, 59]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [50, 53, 55]);
    press(h, [52, 48]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [59, 52, 48]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().chords).toEqual([
      [50, 53, 57, 60],
      [50, 53, 55, 59],
      [48, 52, 59],
    ]);
  });

  it('reads chords run together (keys only added) as one chord', async () => {
    const h = await started(harness(multiChordStub));
    press(h, [50, 53]);
    h.tick(CHORD_SETTLE_MS);
    press(h, [55, 59]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [50, 53, 55, 59]);
    h.tick(CHORD_RELEASE_MS + SEQUENCE_GAP_MS);
    expect(lastAnswer().chords).toEqual([[50, 53, 55, 59]]);
    expect(h.runner.outcome).toBe('wrong');
  });

  it('keeps a mouse answer on note-sequence, byte for byte', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64, 67], 'onscreen');
    expect(h.runner.capture).toBe('sequence');
    expect(h.runner.phase).toBe('awaiting');
    // A MIDI note joins the sequence, as it always has.
    press(h, [71], 'midi');
    expect(h.runner.phase).toBe('feedback');
    expect(lastAnswer()).toEqual({
      kind: 'notes',
      notes: [60, 64, 67, 71],
      order: [60, 64, 67, 71],
      source: 'midi',
    });
  });

  it('ignores other sources once chord capture has started', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64]);
    press(h, [62], 'computer-keyboard');
    h.runner.noteOff(62, 'computer-keyboard');
    press(h, [67, 71]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().notes).toEqual([60, 64, 67, 71]);
    expect(h.attempts[0].answerSource).toBe('midi');
  });

  it('ignores a key that was already down when the answer began', async () => {
    const h = harness(chordStub as AnyExercise);
    await h.runner.start();
    // Held from before `awaiting` (here: during the question's playback).
    press(h, [62]);
    h.tick(PLAYBACK_MS);
    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [62]);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(lastAnswer().notes).toEqual([60, 64, 67, 71]);
  });

  it('keeps the captured chord through a replay and closes after it', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    h.runner.replay();
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS);
    expect(h.runner.phase).toBe('presenting');
    h.tick(PLAYBACK_MS - CHORD_RELEASE_MS);
    expect(h.runner.phase).toBe('awaiting');
    h.tick(CHORD_RELEASE_MS);
    expect(h.runner.phase).toBe('feedback');
    expect(h.runner.outcome).toBe('correct');
  });

  it('drops the chord in progress on pause, and Backspace does nothing', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64]);
    h.tick(CHORD_SETTLE_MS);
    h.runner.backspace();
    expect(h.runner.capturedChords).toEqual([[60, 64]]);
    h.runner.pause();
    expect(h.runner.capture).toBeNull();
    expect(h.runner.capturedChords).toEqual([]);
    expect(h.runner.answerNotes).toEqual([]);
  });

  it('starts the next question with no capture', async () => {
    const h = await started(harness(chordStub as AnyExercise));
    press(h, [60, 64, 67, 71]);
    h.tick(CHORD_SETTLE_MS);
    lift(h, [60, 64, 67, 71]);
    h.tick(CHORD_RELEASE_MS + FEEDBACK_CORRECT_MS);
    expect(h.runner.capture).toBeNull();
    expect(h.runner.capturedChords).toEqual([]);
    // The next answer may take either path.
    h.tick(PLAYBACK_MS);
    press(h, [60], 'onscreen');
    expect(h.runner.capture).toBe('sequence');
  });
});
