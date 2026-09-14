import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVANCE_LOCKOUT_MS,
  ExerciseRunner,
  FEEDBACK_CORRECT_MS,
  FEEDBACK_STREAK_MS,
  IDLE_PAUSE_MS,
  REVEAL_DELAY_MS,
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

function harness(definition: AnyExercise = stub) {
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

  it('a note starts the drill from idle', async () => {
    const h = harness();
    h.runner.noteOn(60, 'midi');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runner.phase).toBe('presenting');
  });
});
