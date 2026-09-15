import { describe, expect, it } from 'vitest';
import {
  chordNotes,
  pcOf,
  progressionNotes,
  progressionSpan,
  type ProgressionType,
} from '$lib/theory';
import { mulberry32 } from '../rng';
import { SEQUENCE_GAP_MS } from '../runner.svelte';
import type { Answer, GenerateContext, Question } from '../types';
import {
  PROGRESSION_RECOGNITION_ID,
  STARTER_TYPES,
  missDetail,
  progressionRecognition,
  progressionSkillLabel,
  skillIdFor,
  type ProgressionPayload,
  type ProgressionSettings,
} from './index';

const DEFAULTS = progressionRecognition.defaultSettings as ProgressionSettings;

function context(
  seed: number,
  range = { low: 36, high: 96 },
  recentSkillIds: string[] = [],
  settings: ProgressionSettings = DEFAULTS,
): GenerateContext<ProgressionSettings> {
  return {
    settings,
    rng: mulberry32(seed),
    seed,
    range,
    history: { recentSkillIds },
  };
}

function ask(
  seed: number,
  range?: { low: number; high: number },
  recent: string[] = [],
  settings?: ProgressionSettings,
): Question<ProgressionPayload> {
  return progressionRecognition.generate(
    context(seed, range, recent, settings),
  );
}

function played(notes: number[]): Answer {
  return { kind: 'notes', notes, order: notes, source: 'onscreen' };
}

/** The cadence a question asked for, as it was voiced. */
function cadenceOf(question: Question<ProgressionPayload>): number[] {
  const { tonicMidi, type } = question.payload;
  return progressionNotes(tonicMidi, type)?.flat() ?? [];
}

describe('progression-recognition generate', () => {
  it('is reproducible from the seed', () => {
    expect(ask(42)).toEqual(ask(42));
  });

  it('asks a cadence this exercise can grade, in every key', () => {
    const keys = new Set<number>();
    const types = new Set<ProgressionType>();
    for (let seed = 0; seed < 400; seed += 1) {
      const question = ask(seed);
      keys.add(question.payload.tonicPc);
      types.add(question.payload.type);
      expect(question.skillId).toBe(
        skillIdFor(question.payload.type, question.payload.tonicPc),
      );
    }
    // All 12 keys and both cadences come up — the drill is the key, not just
    // the colour (slice 8's rule, one level up).
    expect(keys.size).toBe(12);
    expect([...types].sort()).toEqual([...STARTER_TYPES].sort());
  });

  it('plays three block chords in time, not one sound', () => {
    const question = ask(7);
    expect(question.playback.events).toHaveLength(3);
    const [first, second, third] = question.playback.events;
    expect(first.atMs).toBe(0);
    expect(second.atMs).toBeGreaterThan(first.atMs);
    expect(third.atMs).toBeGreaterThan(second.atMs);
    // A cadence is movement: each chord starts after the one before it.
    expect(second.atMs - first.atMs).toBe(third.atMs - second.atMs);
    for (const event of question.playback.events)
      expect(event.notes).toHaveLength(4);
  });

  it('answers in twelve notes, with a window long enough to play them', () => {
    const question = ask(11);
    expect(question.answerMode).toBe('note-sequence');
    expect(question.expected.kind).toBe('notes');
    expect(
      question.expected.kind === 'notes' ? question.expected.notes : [],
    ).toHaveLength(12);
    // The default silence window is sized for a two-note interval.
    expect(question.answerGapMs ?? 0).toBeGreaterThan(SEQUENCE_GAP_MS);
  });

  it('labels the reveal with the chord symbols a chart would print', () => {
    const question = ask(3);
    expect(question.expected.label).toMatch(
      /^[A-G][b#]?\S* · [A-G][b#]?\S* · [A-G][b#]?\S*$/,
    );
    // The question is heard, so the reveal is the question: no `revealPlayback`.
    expect(question.revealPlayback).toBeUndefined();
  });

  it('never dims the keyboard: the cadence may be played in any register', () => {
    expect(ask(5).range).toBeUndefined();
    expect(ask(5).prompt.showKeyboard).toBe(true);
  });

  it('spells every note it asks for, in flats', () => {
    const question = ask(9);
    for (const midi of cadenceOf(question)) {
      expect(question.spellings?.get(midi)).toBeDefined();
      expect(question.spellings?.get(midi)).not.toContain('#');
    }
  });

  it('keeps the whole cadence inside the instrument range', () => {
    for (const range of [
      { low: 36, high: 96 }, // the default 61-key piano
      { low: 48, high: 84 }, // three octaves
      { low: 21, high: 108 }, // 88 keys
    ]) {
      for (let seed = 0; seed < 60; seed += 1) {
        const notes = cadenceOf(ask(seed, range));
        expect(Math.min(...notes)).toBeGreaterThanOrEqual(range.low);
        expect(Math.max(...notes)).toBeLessThanOrEqual(range.high);
      }
    }
  });

  it('still asks a playable question on a keyboard too small for one', () => {
    // A cadence reaches 17 semitones, so a two-octave range has no octave of
    // most tonics that it fits inside. Something has to poke out; the question
    // is still real, still in MIDI, and still the same for the same seed.
    const tiny = { low: 48, high: 72 };
    for (let seed = 0; seed < 40; seed += 1) {
      const notes = cadenceOf(ask(seed, tiny));
      expect(notes).toHaveLength(12);
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...notes)).toBeLessThanOrEqual(127);
      expect(ask(seed, tiny)).toEqual(ask(seed, tiny));
    }
  });

  it('places the tonic so the V sits below it and the ii above', () => {
    const question = ask(21);
    const { tonicMidi, type } = question.payload;
    const chords = progressionNotes(tonicMidi, type) ?? [];
    expect(chords[1][0]).toBeLessThan(chords[0][0]);
    expect(chords[2][0]).toBe(tonicMidi);
    const span = progressionSpan(type);
    expect(Math.min(...chords.flat())).toBe(tonicMidi + span.low);
  });

  it('avoids repeating the cadence that was just asked', () => {
    const first = ask(17);
    const again = ask(17, undefined, [first.skillId]);
    expect(again.skillId).not.toBe(first.skillId);
  });
});

describe('progression-recognition grade', () => {
  const question = ask(1);
  const { tonicMidi, type } = question.payload;
  const chords = progressionNotes(tonicMidi, type) ?? [];

  it('accepts the cadence as it was played', () => {
    const grade = progressionRecognition.grade(question, played(chords.flat()));
    expect(grade).toEqual({ correct: true, score: 1 });
  });

  it('accepts another register, spacing and note order inside a chord', () => {
    const moved = chords
      .map((chord) => [chord[0] - 12, chord[3] + 12, chord[1] - 12, chord[2]])
      .flat();
    expect(progressionRecognition.grade(question, played(moved)).correct).toBe(
      true,
    );
  });

  it('rejects the cadence in another key, and names what was played', () => {
    const wrongKey = (progressionNotes(tonicMidi + 1, type) ?? []).flat();
    const grade = progressionRecognition.grade(question, played(wrongKey));
    expect(grade.correct).toBe(false);
    // Binary, per ADR §10.
    expect(grade.score).toBe(0);
    expect(grade.revealed?.notes).toEqual(chords.flat());
    expect(grade.feedback).toMatch(/you played/);
  });

  it('rejects the right chords in the wrong order, and says so', () => {
    const shuffled = [chords[2], chords[0], chords[1]].flat();
    const grade = progressionRecognition.grade(question, played(shuffled));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      `Right chords — the order is ${question.expected.label}`,
    );
  });

  it('rejects an answer that is too short to be a cadence', () => {
    const short = chords.flat().slice(0, 4);
    const grade = progressionRecognition.grade(question, played(short));
    expect(grade.correct).toBe(false);
    expect(grade.revealed?.label).toBe(question.expected.label);
  });

  it('rejects a single note without pretending to explain it', () => {
    const grade = progressionRecognition.grade(question, played([60]));
    expect(grade).toEqual({
      correct: false,
      score: 0,
      revealed: { notes: chords.flat(), label: question.expected.label },
    });
  });

  it('rejects a choice answer — this drill is played, never clicked', () => {
    const grade = progressionRecognition.grade(question, {
      kind: 'choice',
      choiceId: 'x',
    });
    expect(grade.correct).toBe(false);
  });
});

describe('the major and the minor cadence are different answers', () => {
  /** A question of a known type, whatever the seed drew. */
  function askType(type: ProgressionType): Question<ProgressionPayload> {
    for (let seed = 0; seed < 200; seed += 1) {
      const question = ask(seed, undefined, [], { types: [type] });
      if (question.payload.type === type) return question;
    }
    throw new Error(`no ${type} question`);
  }

  it('will not take a m7 ii for the minor cadence', () => {
    const question = askType('minor-ii-V-i');
    const { tonicMidi } = question.payload;
    const chords = progressionNotes(tonicMidi, 'minor-ii-V-i') ?? [];
    const majorIi = chordNotes(chords[0][0], 'min7') ?? [];
    const answer = [majorIi, chords[1], chords[2]].flat();
    const grade = progressionRecognition.grade(question, played(answer));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toContain('The ii is');
  });

  it('will not take a m7 tonic for the major cadence', () => {
    const question = askType('major-ii-V-I');
    const { tonicMidi } = question.payload;
    const chords = progressionNotes(tonicMidi, 'major-ii-V-I') ?? [];
    const minorTonic = chordNotes(chords[2][0], 'min7') ?? [];
    const answer = [chords[0], chords[1], minorTonic].flat();
    const grade = progressionRecognition.grade(question, played(answer));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toContain('The I is');
  });
});

describe('missDetail', () => {
  const tonicMidi = 48; // C3
  const tonicPc = pcOf(tonicMidi);
  const chords = progressionNotes(tonicMidi, 'major-ii-V-I') ?? [];

  it('says nothing about a right answer', () => {
    expect(missDetail(tonicPc, 'major-ii-V-I', chords.flat())).toBeUndefined();
  });

  it('names the first wrong chord by its numeral and its symbol', () => {
    const wrongV = chordNotes(chords[1][0], 'min7') ?? [];
    expect(
      missDetail(
        tonicPc,
        'major-ii-V-I',
        [chords[0], wrongV, chords[2]].flat(),
      ),
    ).toBe('The V is G7 — you played Gm7');
  });

  it('tells an inversion from a wrong chord', () => {
    const inverted = [
      chords[0][1],
      chords[0][2],
      chords[0][3],
      chords[0][0] + 12,
    ];
    expect(
      missDetail(
        tonicPc,
        'major-ii-V-I',
        [inverted, chords[1], chords[2]].flat(),
      ),
    ).toBe('The ii is Dm7 — the root belongs at the bottom');
  });

  it('names the chord it cannot name at all by the chord that was asked', () => {
    const noise = [60, 61, 62, 63];
    expect(
      missDetail(tonicPc, 'major-ii-V-I', [noise, chords[1], chords[2]].flat()),
    ).toBe('The ii is Dm7');
  });

  it('calls a reordered cadence what it is', () => {
    const shuffled = [chords[1], chords[2], chords[0]].flat();
    expect(missDetail(tonicPc, 'major-ii-V-I', shuffled)).toBe(
      'Right chords — the order is Dm7 · G7 · Cmaj7',
    );
  });

  it('reminds a short answer what the shape of the answer is', () => {
    expect(missDetail(tonicPc, 'major-ii-V-I', chords[0])).toBe(
      'Major ii-V-I — three chords of four notes',
    );
  });

  it('spells feedback in the asked key, not in C', () => {
    const db = progressionNotes(49, 'major-ii-V-I') ?? [];
    const wrongV = chordNotes(db[1][0], 'min7') ?? [];
    expect(missDetail(1, 'major-ii-V-I', [db[0], wrongV, db[2]].flat())).toBe(
      'The V is Ab7 — you played Abm7',
    );
  });
});

describe('skills and labels', () => {
  it('is one skill per cadence per key — 24 in all', () => {
    const skills = progressionRecognition.skillsCovered(DEFAULTS);
    expect(skills).toHaveLength(24);
    expect(new Set(skills).size).toBe(24);
    expect(skills).toContain(`${PROGRESSION_RECOGNITION_ID}:major-ii-V-I:0`);
  });

  it('labels a skill with its key and the abbreviated cadence', () => {
    expect(progressionSkillLabel(skillIdFor('major-ii-V-I', 0))).toBe(
      'C ii-V-I',
    );
    expect(progressionSkillLabel(skillIdFor('minor-ii-V-i', 1))).toBe(
      'Db ii-V-i',
    );
    expect(
      progressionRecognition.skillLabel?.(
        skillIdFor('major-ii-V-I', 10),
        DEFAULTS,
      ),
    ).toBe('Bb ii-V-I');
  });

  it('hands back an id it does not recognise unchanged', () => {
    for (const id of [
      'chord-quality:maj7',
      `${PROGRESSION_RECOGNITION_ID}:I-VI-ii-V:0`,
      `${PROGRESSION_RECOGNITION_ID}:major-ii-V-I:99`,
      `${PROGRESSION_RECOGNITION_ID}:nonsense`,
    ])
      expect(progressionSkillLabel(id)).toBe(id);
  });

  it('is playable with no MIDI device, like every other drill', () => {
    expect(progressionRecognition.requiresMidi).toBe(false);
  });
});
