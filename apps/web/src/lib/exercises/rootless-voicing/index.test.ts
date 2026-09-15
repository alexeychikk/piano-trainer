import { describe, expect, it } from 'vitest';
import {
  ROOTLESS_FORMS,
  chordNotes,
  pcOf,
  rootlessBassOffset,
  rootlessNotesFromBass,
  rootlessPitchClasses,
  shellNotes,
  type ChordQuality,
  type RootlessForm,
} from '$lib/theory';
import { mulberry32 } from '../rng';
import type { Answer, GenerateContext, Question } from '../types';
import {
  ROOTLESS_VOICING_ID,
  STARTER_QUALITIES,
  missDetail,
  rootlessSkillLabel,
  rootlessVoicing,
  skillIdFor,
  type RootlessVoicingPayload,
  type RootlessVoicingSettings,
} from './index';

const DEFAULTS = rootlessVoicing.defaultSettings as RootlessVoicingSettings;

function context(
  seed: number,
  range = { low: 36, high: 84 },
  recentSkillIds: string[] = [],
  settings: RootlessVoicingSettings = DEFAULTS,
): GenerateContext<RootlessVoicingSettings> {
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
  settings?: RootlessVoicingSettings,
): Question<RootlessVoicingPayload> {
  return rootlessVoicing.generate(context(seed, range, recent, settings));
}

/** The voicing of a question — what the reveal plays and the answer must be. */
function voicingOf(question: Question<RootlessVoicingPayload>): number[] {
  return question.revealPlayback?.events[0].notes ?? [];
}

function played(notes: number[]): Answer {
  return { kind: 'notes', notes, order: notes, source: 'onscreen' };
}

describe('rootless-voicing generate', () => {
  it('is reproducible from the seed', () => {
    expect(ask(42)).toEqual(ask(42));
  });

  it('only asks qualities that have a rootless voicing', () => {
    for (let seed = 0; seed < 80; seed += 1)
      expect(STARTER_QUALITIES).toContain(ask(seed).payload.quality);
  });

  it('asks all 12 keys and both forms over enough questions', () => {
    const keys = new Set<number>();
    const forms = new Set<RootlessForm>();
    const qualities = new Set<ChordQuality>();
    for (let seed = 0; seed < 300; seed += 1) {
      const { rootPc, form, quality } = ask(seed).payload;
      keys.add(rootPc);
      forms.add(form);
      qualities.add(quality);
    }
    expect(keys.size).toBe(12);
    expect([...forms].sort()).toEqual([...ROOTLESS_FORMS]);
    expect(qualities.size).toBe(STARTER_QUALITIES.length);
  });

  it('prompts with the chord symbol and the form that is asked for', () => {
    const question = ask(11);
    const { form } = question.payload;
    expect(question.prompt.title).toMatch(/^[A-G][b#]?(maj7|m7|7) · [AB]$/);
    expect(question.prompt.subtitle).toBe(
      form === 'A'
        ? 'Play the A form: 3rd, 5th, 7th, 9th — no root'
        : 'Play the B form: 7th, 9th, 3rd, 5th — no root',
    );
    expect(question.prompt.showKeyboard).toBe(true);
    // Nothing dims: the voicing may be played in any octave.
    expect(question.range).toBeUndefined();
    expect(question.expected).toEqual({
      kind: 'notes',
      notes: voicingOf(question),
      label: `${question.prompt.title.split(' · ')[0]} ${form} form`,
    });
  });

  it('sounds the root as a bass reference, never the answer', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const question = ask(seed);
      const { rootMidi, rootPc } = question.payload;
      expect(question.playback.events).toHaveLength(1);
      expect(question.playback.events[0].notes).toEqual([rootMidi]);
      expect(pcOf(rootMidi)).toBe(rootPc);
      // The one note the answer must not contain cannot give it away — and it
      // sits under the voicing, where a bass player would be.
      expect(voicingOf(question)).not.toContain(rootMidi);
      expect(rootMidi).toBeLessThan(Math.min(...voicingOf(question)));
    }
  });

  it('reveals the voicing: four distinct notes, in range, low to high', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const question = ask(seed);
      const { quality, form, bassMidi } = question.payload;
      const notes = voicingOf(question);
      expect(notes).toEqual(rootlessNotesFromBass(bassMidi, quality, form));
      expect(new Set(notes).size).toBe(4);
      expect(notes).toEqual([...notes].sort((a, b) => a - b));
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(36);
      expect(Math.max(...notes)).toBeLessThanOrEqual(84);
      // A left-hand comping voicing: its bottom note is around middle C.
      expect(bassMidi).toBeGreaterThanOrEqual(48);
      expect(bassMidi).toBeLessThanOrEqual(62);
    }
  });

  it('never puts the root in the voicing, in any key or form', () => {
    for (let seed = 0; seed < 120; seed += 1) {
      const question = ask(seed);
      const { rootPc } = question.payload;
      expect(voicingOf(question).map((midi) => pcOf(midi))).not.toContain(
        rootPc,
      );
    }
  });

  it('puts the form’s own degree at the bottom', () => {
    for (let seed = 0; seed < 120; seed += 1) {
      const { rootPc, quality, form, bassMidi } = ask(seed).payload;
      expect(pcOf(bassMidi)).toBe(
        (rootPc + (rootlessBassOffset(quality, form) ?? 0)) % 12,
      );
    }
  });

  it('keeps the whole voicing inside a narrow instrument', () => {
    // Two octaves: the narrowest instrument that holds any of these voicings
    // in all 12 keys (12 keys + the widest shape's 11 semitones).
    for (let seed = 0; seed < 60; seed += 1) {
      const notes = voicingOf(ask(seed, { low: 48, high: 72 }));
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(48);
      expect(Math.max(...notes)).toBeLessThanOrEqual(72);
    }
  });

  it('still asks the chord it chose on an instrument too small for it', () => {
    // A 17-semitone "piano" is not one (the settings store guards ranges under
    // an octave). The question stays the chord and form it asked for; the top
    // may poke out, and the reference root may have to sit above the voicing.
    for (let seed = 0; seed < 40; seed += 1) {
      const question = ask(seed, { low: 55, high: 72 });
      const notes = voicingOf(question);
      const { rootPc, quality, form } = question.payload;
      expect(pcOf(notes[0])).toBe(
        (rootPc + (rootlessBassOffset(quality, form) ?? 0)) % 12,
      );
      expect(notes[0]).toBeGreaterThanOrEqual(55);
      expect(new Set(notes).size).toBe(4);
      expect(question.payload.rootMidi).toBeGreaterThanOrEqual(55);
    }
  });

  it('answers as a note sequence, with a window sized for building it', () => {
    const question = ask(7);
    expect(question.answerMode).toBe('note-sequence');
    expect(question.answerGapMs).toBe(2500);
    expect(
      [...(question.spellings ?? [])].map(([, name]) => name),
    ).toHaveLength(4);
  });

  it('avoids repeating the chord just asked', () => {
    const first = ask(3);
    const next = ask(3, undefined, [first.skillId]);
    expect(next.skillId).not.toBe(first.skillId);
  });

  it('derives the question id and skill id from the seed and the chord', () => {
    const question = ask(21);
    const { bassMidi, rootPc, quality, form } = question.payload;
    expect(question.id).toBe(
      `${ROOTLESS_VOICING_ID}:21:${bassMidi}:${quality}:${form}`,
    );
    expect(question.skillId).toBe(skillIdFor(quality, rootPc, form));
    expect(question.seed).toBe(21);
  });

  it('only offers qualities it can voice, whatever the settings say', () => {
    const settings: RootlessVoicingSettings = {
      // No 7th, a flat 5th, a diminished 7th, no interval set at all.
      qualities: [
        'maj6',
        'min7b5',
        'dim7',
        'dom7alt',
        'min7',
      ] as ChordQuality[],
    };
    for (let seed = 0; seed < 30; seed += 1)
      expect(ask(seed, undefined, [], settings).payload.quality).toBe('min7');
  });
});

describe('rootless-voicing grade', () => {
  const question = ask(5);
  const { rootPc, rootMidi, quality, form } = question.payload;
  const voicing = voicingOf(question);

  it('accepts the voicing as it is revealed', () => {
    expect(rootlessVoicing.grade(question, played(voicing))).toEqual({
      correct: true,
      score: 1,
    });
  });

  it('accepts any octave, order and spacing that keeps the bass', () => {
    // The same shape two octaves down, struck top note first.
    expect(
      rootlessVoicing.grade(
        question,
        played([...voicing].reverse().map((midi) => midi - 24)),
      ).correct,
    ).toBe(true);
    // Open spacing: the upper three an octave up, the bass note where it was.
    const [bass, ...upper] = voicing;
    expect(
      rootlessVoicing.grade(
        question,
        played([bass, ...upper.map((midi) => midi + 12)]),
      ).correct,
    ).toBe(true);
  });

  it('grades every key and form the generator can ask', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const asked = ask(seed);
      expect(
        rootlessVoicing.grade(asked, played(voicingOf(asked))).correct,
        asked.prompt.title,
      ).toBe(true);
    }
  });

  it('rejects the other form — the same notes, the wrong one underneath', () => {
    const other = form === 'A' ? 'B' : 'A';
    const otherBass =
      voicing[0] -
      (rootlessBassOffset(quality, form) ?? 0) +
      (rootlessBassOffset(quality, other) ?? 0);
    const grade = rootlessVoicing.grade(
      question,
      played(rootlessNotesFromBass(otherBass - 12, quality, other) ?? []),
    );
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.feedback).toBe(
      form === 'A'
        ? 'That is the B form — A starts on the 3rd'
        : 'That is the A form — B starts on the 7th',
    );
    expect(grade.revealed).toEqual({
      notes: voicing,
      label: question.expected.label,
    });
  });

  it('rejects the voicing of another key', () => {
    expect(
      rootlessVoicing.grade(question, played(voicing.map((midi) => midi + 1)))
        .correct,
    ).toBe(false);
  });

  it('rejects the root, however it is added', () => {
    // The whole rooted chord.
    expect(
      rootlessVoicing.grade(
        question,
        played(chordNotes(rootMidi, quality) ?? []),
      ).correct,
    ).toBe(false);
    // The right four notes with the root underneath them.
    const grade = rootlessVoicing.grade(
      question,
      played([rootMidi, ...voicing]),
    );
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      'You played the root — a rootless voicing leaves it to the bass',
    );
  });

  it('rejects a doubling, which always costs a chord tone', () => {
    expect(
      rootlessVoicing.grade(
        question,
        played([voicing[0], voicing[1], voicing[2], voicing[0] + 12]),
      ).correct,
    ).toBe(false);
  });

  it('counts an empty or one-note answer as a miss', () => {
    expect(rootlessVoicing.grade(question, played([])).correct).toBe(false);
    expect(rootlessVoicing.grade(question, played([voicing[0]])).score).toBe(0);
    expect(
      rootlessVoicing.grade(question, { kind: 'choice', choiceId: 'x' })
        .correct,
    ).toBe(false);
  });

  it('scores binary, never partial', () => {
    for (const answer of [voicing, [...voicing.slice(0, 3), voicing[3] + 1]]) {
      const grade = rootlessVoicing.grade(question, played(answer));
      expect(grade.score).toBe(grade.correct ? 1 : 0);
    }
  });

  it('grades enharmonics equal, because it grades integers', () => {
    // The voicing's own pitch classes, respelled two octaves up — except the
    // bass, which is what the form is.
    const pcs = rootlessPitchClasses(rootPc, quality) ?? [];
    const bassPc = pcOf(voicing[0]);
    const respelled = [
      voicing[0],
      ...pcs.filter((pc) => pc !== bassPc).map((pc) => 72 + pc),
    ];
    expect(rootlessVoicing.grade(question, played(respelled)).correct).toBe(
      true,
    );
  });
});

describe('rootless-voicing skills', () => {
  it('covers one skill per chord and form: 12 keys × 2 forms', () => {
    const skills = rootlessVoicing.skillsCovered(DEFAULTS);
    expect(skills).toHaveLength(STARTER_QUALITIES.length * 12 * 2);
    expect(new Set(skills).size).toBe(skills.length);
    expect(skills).toContain(skillIdFor('maj7', 0, 'A'));
    expect(skills).toContain(skillIdFor('maj7', 0, 'B'));
  });

  it('leaves out a quality it cannot voice', () => {
    expect(
      rootlessVoicing.skillsCovered({
        qualities: ['min7b5', 'min7'] as ChordQuality[],
      }),
    ).toHaveLength(24);
  });

  it('labels a skill with its chord symbol and form, for the grid', () => {
    expect(rootlessSkillLabel(skillIdFor('maj7', 0, 'A'))).toBe('Cmaj7 A');
    expect(rootlessSkillLabel(skillIdFor('dom7', 1, 'B'))).toBe('Db7 B');
    expect(rootlessSkillLabel(skillIdFor('min7', 10, 'A'))).toBe('Bbm7 A');
  });

  it('gives an id it does not own back unchanged', () => {
    for (const id of [
      'play-the-voicing:maj7:0',
      `${ROOTLESS_VOICING_ID}:maj7:0`,
      `${ROOTLESS_VOICING_ID}:min7b5:0:A`,
      `${ROOTLESS_VOICING_ID}:maj7:nonsense:A`,
      `${ROOTLESS_VOICING_ID}:maj7:0:C`,
      `${ROOTLESS_VOICING_ID}:constructor:0:A`,
      `${ROOTLESS_VOICING_ID}:maj7:0:constructor`,
    ])
      expect(rootlessSkillLabel(id), id).toBe(id);
  });
});

describe('missDetail', () => {
  // Cmaj7: A form E-G-B-D (52-55-59-62), B form B-D-E-G (59-62-64-67).
  const cmaj7A = rootlessNotesFromBass(52, 'maj7', 'A') ?? [];
  const cmaj7B = rootlessNotesFromBass(59, 'maj7', 'B') ?? [];

  it('says nothing when the answer was right', () => {
    expect(missDetail(0, 'maj7', 'A', cmaj7A)).toBeUndefined();
    expect(missDetail(0, 'maj7', 'B', cmaj7B)).toBeUndefined();
  });

  it('names the shell, the habit this drill is breaking', () => {
    expect(missDetail(0, 'maj7', 'A', shellNotes(48, 'maj7') ?? [])).toBe(
      'That is the shell — a rootless voicing leaves the root to the bass',
    );
  });

  it('calls out the root wherever it appears', () => {
    // The right four notes plus the root on top.
    expect(missDetail(0, 'maj7', 'A', [...cmaj7A, 72])).toBe(
      'You played the root — a rootless voicing leaves it to the bass',
    );
    // The whole chord, root position.
    expect(missDetail(0, 'maj7', 'A', chordNotes(48, 'maj7') ?? [])).toBe(
      'You played the root — a rootless voicing leaves it to the bass',
    );
  });

  it('calls out the other form by name', () => {
    expect(missDetail(0, 'maj7', 'A', cmaj7B)).toBe(
      'That is the B form — A starts on the 3rd',
    );
    expect(missDetail(0, 'maj7', 'B', cmaj7A)).toBe(
      'That is the A form — B starts on the 7th',
    );
  });

  it('calls out the right notes over a tone that is neither form', () => {
    // Cmaj7's four tones with the 5th (G) underneath: not A, not B.
    expect(missDetail(0, 'maj7', 'A', [55, 59, 62, 64])).toBe(
      'Right notes — the A form starts on the 3rd',
    );
  });

  it('calls out the 9th, the note that replaces the root', () => {
    // Cmaj7 A without its D: E-G-B with the 3rd doubled — four notes, three
    // tones, and the missing one is the 9th.
    expect(missDetail(0, 'maj7', 'A', [52, 55, 59, 64])).toBe(
      'Both forms need the 9th — it is the note that replaces the root',
    );
  });

  it('names the voicing that was played instead', () => {
    // Asked Cmaj7 A, played Dmaj7's A form — a transposition, not noise.
    // (Db's would contain C, so the root line would rightly win instead: a
    // near key's rootless voicing very often holds the asked root.)
    expect(
      missDetail(0, 'maj7', 'A', rootlessNotesFromBass(54, 'maj7', 'A') ?? []),
    ).toBe('You played the Dmaj7 A form');
    // Asked Cmaj7 A, played the C7 A form (the 7th flat).
    expect(
      missDetail(0, 'maj7', 'A', rootlessNotesFromBass(52, 'dom7', 'A') ?? []),
    ).toBe('You played the C7 A form');
    // Asked Cmaj7 B, played the Db7 B form — the ii-V's neighbour.
    expect(
      missDetail(0, 'maj7', 'B', rootlessNotesFromBass(59, 'dom7', 'B') ?? []),
    ).toBe('You played the Db7 B form');
  });

  it('has nothing to say about a handful of notes', () => {
    expect(missDetail(0, 'maj7', 'A', [52])).toBeUndefined();
    expect(missDetail(0, 'maj7', 'A', [61, 62, 66])).toBeUndefined();
  });
});
