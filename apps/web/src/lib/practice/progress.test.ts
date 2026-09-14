import { describe, expect, it } from 'vitest';
import type { StoredAttempt } from '$lib/storage/db';
import { deriveSkills, initialSkill } from './mastery';
import {
  accuracyOver,
  buildGroups,
  DAY_MS,
  dailyCounts,
  fallbackSkillLabel,
  normalise,
  streakDays,
  STRIP_DAYS,
  summarise,
  tallyBySkill,
} from './progress';

/** Midday, so a ±hours test never crosses a local midnight by accident. */
const NOW = new Date('2026-09-14T12:00:00').getTime();

function attempt(overrides: Partial<StoredAttempt> = {}): StoredAttempt {
  return {
    attemptId: `a${Math.random()}`,
    questionId: `q${Math.random()}`,
    ts: NOW,
    exerciseId: 'find-the-note',
    skillId: 'find-the-note:pc:0',
    seed: 1,
    correct: true,
    score: 1,
    responseMs: 700,
    replays: 0,
    answerSource: 'onscreen',
    ...overrides,
  };
}

/** `days` local days before `NOW`, still at midday. */
function daysBack(days: number): number {
  return NOW - days * DAY_MS;
}

describe('streakDays', () => {
  it('is zero without any attempts', () => {
    expect(streakDays([], NOW)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const attempts = [0, 1, 2, 4].map((d) => attempt({ ts: daysBack(d) }));
    expect(streakDays(attempts, NOW)).toBe(3);
  });

  it('survives a day that is not over yet — yesterday still counts', () => {
    const attempts = [1, 2].map((d) => attempt({ ts: daysBack(d) }));
    expect(streakDays(attempts, NOW)).toBe(2);
  });

  it('is broken once a whole day has been missed', () => {
    const attempts = [2, 3].map((d) => attempt({ ts: daysBack(d) }));
    expect(streakDays(attempts, NOW)).toBe(0);
  });
});

describe('dailyCounts', () => {
  it('buckets by local day, today last', () => {
    const counts = dailyCounts(
      [
        attempt(),
        attempt(),
        attempt({ ts: daysBack(1) }),
        attempt({ ts: daysBack(40) }),
      ],
      NOW,
    );
    expect(counts).toHaveLength(STRIP_DAYS);
    expect(counts[STRIP_DAYS - 1]).toBe(2);
    expect(counts[STRIP_DAYS - 2]).toBe(1);
    // Older than the strip: dropped, never folded into the oldest bar.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('normalise', () => {
  it('scales against the busiest day, and an empty strip stays flat', () => {
    expect(normalise([0, 2, 4])).toEqual([0, 0.5, 1]);
    expect(normalise([0, 0])).toEqual([0, 0]);
  });
});

describe('accuracyOver', () => {
  it('is null when the window is empty', () => {
    expect(accuracyOver([], NOW)).toBeNull();
    expect(accuracyOver([attempt({ ts: daysBack(30) })], NOW)).toBeNull();
  });

  it('counts only the window', () => {
    const attempts = [
      attempt(),
      attempt({ correct: false }),
      attempt({ ts: daysBack(20), correct: false }),
    ];
    expect(accuracyOver(attempts, NOW)).toBeCloseTo(0.5);
  });
});

describe('summarise', () => {
  it('answers the three questions of UX §6.1 in one object', () => {
    const totals = summarise(
      [attempt(), attempt({ correct: false }), attempt({ ts: daysBack(1) })],
      NOW,
    );
    expect(totals.attempts).toBe(3);
    expect(totals.streakDays).toBe(2);
    expect(totals.accuracy7d).toBeCloseTo(2 / 3);
    expect(totals.strip).toHaveLength(STRIP_DAYS);
    expect(totals.strip[STRIP_DAYS - 1]).toBe(1);
  });
});

describe('tallyBySkill', () => {
  it('counts attempts and hits per skill', () => {
    const tallies = tallyBySkill([
      attempt(),
      attempt({ correct: false }),
      attempt({ skillId: 'find-the-note:pc:7' }),
    ]);
    expect(tallies.get('find-the-note:pc:0')).toEqual({
      attempts: 2,
      correct: 1,
    });
    expect(tallies.get('find-the-note:pc:7')?.correct).toBe(1);
  });
});

describe('fallbackSkillLabel', () => {
  it('never shows a raw id', () => {
    expect(fallbackSkillLabel('interval:P5:asc')).toBe('asc');
    expect(fallbackSkillLabel('plain')).toBe('plain');
  });
});

describe('buildGroups', () => {
  const exercises = [
    {
      id: 'find-the-note',
      title: 'Find the note',
      skillIds: ['find-the-note:pc:0', 'find-the-note:pc:1'],
      label: (skillId: string) => (skillId.endsWith('0') ? 'C' : 'Db'),
    },
  ];

  it('shows an unpractised skill as `new`, with no invented numbers', () => {
    const [group] = buildGroups(exercises, new Map(), [], NOW);
    expect(group.mastery).toBeNull();
    expect(group.attempts).toBe(0);
    expect(group.cells.map((cell) => cell.label)).toEqual(['C', 'Db']);
    expect(group.cells[0]).toMatchObject({
      mastery: null,
      attempts: 0,
      weak: false,
      // No invented sentence: the pips say `new`, so there is no detail line.
      detail: '',
    });
  });

  it('builds a cell with the mastery, the tally and the detail line', () => {
    const attempts = [
      attempt({ ts: NOW - 4 * 60 * 60_000 }),
      attempt({ correct: false, score: 0, ts: NOW - 3 * 60 * 60_000 }),
      attempt({ ts: NOW - 2 * 60 * 60_000 }),
    ];
    const [group] = buildGroups(
      exercises,
      deriveSkills(attempts),
      attempts,
      NOW,
    );
    expect(group.attempts).toBe(3);
    expect(group.cells[0].mastery).toBeGreaterThan(0);
    expect(group.cells[0].detail).toBe('3 attempts · 67% · last seen 2 h ago');
    expect(group.cells[1].mastery).toBeNull();
  });

  it('marks a weak skill, so the `!` has something to render', () => {
    const attempts = [0, 1, 2].map((i) =>
      attempt({ attemptId: `m${i}`, correct: false, score: 0 }),
    );
    const [group] = buildGroups(
      exercises,
      deriveSkills(attempts),
      attempts,
      NOW,
    );
    expect(group.cells[0].weak).toBe(true);
  });

  it('keeps a stored skill the exercise no longer lists', () => {
    const skills = new Map([
      [
        'find-the-note:pc:11',
        {
          ...initialSkill('find-the-note:pc:11', 'find-the-note'),
          reps: 2,
          mastery: 0.5,
        },
      ],
    ]);
    const [group] = buildGroups(exercises, skills, [], NOW);
    expect(group.cells.map((cell) => cell.skillId)).toContain(
      'find-the-note:pc:11',
    );
  });
});
