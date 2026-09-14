import { describe, expect, it } from 'vitest';
import type { SkillState } from '$lib/storage/db';
import { initialSkill } from './mastery';
import { buildPlan, targetSkillsFor, type PlannerExercise } from './planner';
import { DAY_MS } from './scheduler';

const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

const EXERCISES: PlannerExercise[] = [
  {
    id: 'find-the-note',
    skillIds: ['find-the-note:pc:0', 'find-the-note:pc:1'],
  },
  { id: 'intervals', skillIds: ['intervals:7:asc', 'intervals:3:asc'] },
];

function skill(over: Partial<SkillState> & { skillId: string }): SkillState {
  return {
    ...initialSkill(over.skillId, over.exerciseId ?? 'find-the-note'),
    reps: 3,
    mastery: 0.8,
    ...over,
  };
}

function map(...skills: SkillState[]): Map<string, SkillState> {
  return new Map(skills.map((item) => [item.skillId, item]));
}

describe('buildPlan — the empty case', () => {
  it('plans every skill as `new`, in registry order, and picks the first', () => {
    const plan = buildPlan(EXERCISES, new Map(), NOW);
    expect(plan.items.map((item) => item.skillId)).toEqual([
      'find-the-note:pc:0',
      'find-the-note:pc:1',
      'intervals:7:asc',
      'intervals:3:asc',
    ]);
    expect(plan.items.every((item) => item.reason === 'new')).toBe(true);
    // Nothing is *owed* on a fresh install, so nothing is "due".
    expect(plan.dueCount).toBe(0);
    expect(plan.pick?.exerciseId).toBe('find-the-note');
    expect(plan.byExercise.get('intervals')?.unseenCount).toBe(2);
  });

  it('has no pick at all when the registry is empty', () => {
    const plan = buildPlan([], new Map(), NOW);
    expect(plan.pick).toBeNull();
    expect(plan.items).toEqual([]);
    expect(plan.dueCount).toBe(0);
  });
});

describe('buildPlan — the order', () => {
  it('puts overdue first (longest wait), then weak, then new', () => {
    const plan = buildPlan(
      EXERCISES,
      map(
        skill({ skillId: 'find-the-note:pc:0', dueAt: NOW - 60_000 }),
        skill({
          skillId: 'find-the-note:pc:1',
          mastery: 0.1,
          dueAt: NOW + DAY_MS,
        }),
        skill({
          skillId: 'intervals:7:asc',
          exerciseId: 'intervals',
          dueAt: NOW - DAY_MS,
        }),
      ),
      NOW,
    );
    expect(plan.items.map((item) => [item.skillId, item.reason])).toEqual([
      ['intervals:7:asc', 'overdue'],
      ['find-the-note:pc:0', 'overdue'],
      ['find-the-note:pc:1', 'weak'],
      ['intervals:3:asc', 'new'],
    ]);
    // `N due` = overdue + weak; the unseen skill is `new`, not due.
    expect(plan.dueCount).toBe(3);
    expect(plan.pick?.exerciseId).toBe('intervals');
  });

  it('breaks an overdue tie on the id, and orders weak by mastery', () => {
    const plan = buildPlan(
      EXERCISES,
      map(
        skill({ skillId: 'find-the-note:pc:1', dueAt: NOW - 1000 }),
        skill({ skillId: 'find-the-note:pc:0', dueAt: NOW - 1000 }),
        skill({
          skillId: 'intervals:7:asc',
          exerciseId: 'intervals',
          mastery: 0.2,
          dueAt: NOW + DAY_MS,
        }),
        skill({
          skillId: 'intervals:3:asc',
          exerciseId: 'intervals',
          mastery: 0.05,
          dueAt: NOW + DAY_MS,
        }),
      ),
      NOW,
    );
    expect(plan.items.map((item) => item.skillId)).toEqual([
      'find-the-note:pc:0',
      'find-the-note:pc:1',
      'intervals:3:asc',
      'intervals:7:asc',
    ]);
  });

  it('leaves out a skill that is solid and not yet due', () => {
    const plan = buildPlan(
      [EXERCISES[0]],
      map(
        skill({ skillId: 'find-the-note:pc:0', dueAt: NOW + 3 * DAY_MS }),
        skill({ skillId: 'find-the-note:pc:1', dueAt: NOW + DAY_MS }),
      ),
      NOW,
    );
    expect(plan.items).toEqual([]);
    expect(plan.pick).toBeNull();
    expect(plan.byExercise.get('find-the-note')?.dueCount).toBe(0);
  });

  it('a low mastery with too little evidence is not weak yet', () => {
    const plan = buildPlan(
      [EXERCISES[0]],
      map(
        skill({
          skillId: 'find-the-note:pc:0',
          reps: 2,
          mastery: 0.1,
          dueAt: NOW + DAY_MS,
        }),
      ),
      NOW,
    );
    expect(plan.items.map((item) => item.skillId)).toEqual([
      'find-the-note:pc:1',
    ]);
    expect(plan.dueCount).toBe(0);
  });

  it('still plans a stored skill the exercise no longer lists', () => {
    const plan = buildPlan(
      [EXERCISES[0]],
      map(
        skill({ skillId: 'find-the-note:pc:99', dueAt: NOW - 10 }),
        skill({ skillId: 'find-the-note:pc:0', dueAt: NOW + DAY_MS }),
      ),
      NOW,
    );
    expect(plan.items[0]?.skillId).toBe('find-the-note:pc:99');
    expect(plan.byExercise.get('find-the-note')?.dueCount).toBe(1);
  });
});

describe('per-exercise counts and targets', () => {
  it('counts due and unseen separately, per exercise', () => {
    const plan = buildPlan(
      EXERCISES,
      map(
        skill({ skillId: 'find-the-note:pc:0', dueAt: NOW - 10 }),
        skill({ skillId: 'find-the-note:pc:1', dueAt: NOW - 20 }),
      ),
      NOW,
    );
    expect(plan.byExercise.get('find-the-note')).toMatchObject({
      dueCount: 2,
      unseenCount: 0,
    });
    expect(plan.byExercise.get('intervals')).toMatchObject({
      dueCount: 0,
      unseenCount: 2,
    });
  });

  it('exposes one exercise’s targets in plan order, and nothing for a stranger', () => {
    const plan = buildPlan(
      EXERCISES,
      map(skill({ skillId: 'find-the-note:pc:1', dueAt: NOW - 10 })),
      NOW,
    );
    expect(targetSkillsFor(plan, 'find-the-note')).toEqual([
      'find-the-note:pc:1',
      'find-the-note:pc:0',
    ]);
    expect(targetSkillsFor(plan, 'nope')).toEqual([]);
  });
});
