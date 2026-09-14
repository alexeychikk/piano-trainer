import { describe, expect, it } from 'vitest';
import { phaseLabel } from './phases';
import type { RunnerPhase } from './runner.svelte';

const PHASES: RunnerPhase[] = [
  'idle',
  'presenting',
  'awaiting',
  'feedback',
  'paused',
];

describe('phaseLabel', () => {
  it('names every phase of the state machine', () => {
    expect(PHASES.map((phase) => phaseLabel(phase).label)).toEqual([
      'Ready',
      'Listen',
      'Answer',
      'Result',
      'Paused',
    ]);
  });

  it('is hot only while something is live (§5.3)', () => {
    const hot = PHASES.filter((phase) => phaseLabel(phase).hot);
    expect(hot).toEqual(['presenting', 'awaiting']);
  });
});
