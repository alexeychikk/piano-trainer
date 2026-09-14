import { describe, expect, it } from 'vitest';
import {
  chordNotes,
  pcOf,
  shellNotes,
  shellPitchClasses,
  type ChordQuality,
} from '$lib/theory';
import { mulberry32 } from '../rng';
import type { Answer, GenerateContext, Question } from '../types';
import {
  PLAY_THE_VOICING_ID,
  STARTER_QUALITIES,
  missDetail,
  playTheVoicing,
  skillIdFor,
  voicingSkillLabel,
  type PlayTheVoicingPayload,
  type PlayTheVoicingSettings,
} from './index';

const DEFAULTS = playTheVoicing.defaultSettings as PlayTheVoicingSettings;

function context(
  seed: number,
  range = { low: 36, high: 84 },
  recentSkillIds: string[] = [],
  settings: PlayTheVoicingSettings = DEFAULTS,
): GenerateContext<PlayTheVoicingSettings> {
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
  settings?: PlayTheVoicingSettings,
): Question<PlayTheVoicingPayload> {
  return playTheVoicing.generate(context(seed, range, recent, settings));
}

/** The shell of a question — what the reveal plays and the answer must be. */
function shellOf(question: Question<PlayTheVoicingPayload>): number[] {
  return question.revealPlayback?.events[0].notes ?? [];
}

function played(notes: number[]): Answer {
  return { kind: 'notes', notes, order: notes, source: 'onscreen' };
}

describe('play-the-voicing generate', () => {
  it('is reproducible from the seed', () => {
    expect(ask(42)).toEqual(ask(42));
  });

  it('only asks qualities that have a shell of their own', () => {
    for (let seed = 0; seed < 80; seed += 1)
      expect(STARTER_QUALITIES).toContain(ask(seed).payload.quality);
  });

  it('asks all 12 keys over enough questions', () => {
    const keys = new Set<number>();
    for (let seed = 0; seed < 300; seed += 1)
      keys.add(ask(seed).payload.rootPc);
    expect(keys.size).toBe(12);
  });

  it('prompts with the chord symbol and nothing else', () => {
    const question = ask(11);
    const { rootPc, quality } = question.payload;
    expect(question.prompt.title).toMatch(/^[A-G][b#]?(maj7|m7|7)$/);
    expect(question.prompt.subtitle).toBe('Play the shell: root, 3rd and 7th');
    expect(question.prompt.showKeyboard).toBe(true);
    // Nothing dims: the shell may be played in any octave.
    expect(question.range).toBeUndefined();
    expect(question.expected).toEqual({
      kind: 'notes',
      notes: shellNotes(question.payload.rootMidi, quality),
      label: `${question.prompt.title} shell`,
    });
    expect(pcOf(question.payload.rootMidi)).toBe(rootPc);
  });

  it('sounds the root as a reference, never the answer', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const question = ask(seed);
      expect(question.playback.events).toHaveLength(1);
      expect(question.playback.events[0].notes).toEqual([
        question.payload.rootMidi,
      ]);
    }
  });

  it('reveals the shell: three distinct notes, in range, low to high', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const question = ask(seed);
      const notes = shellOf(question);
      expect(notes).toEqual(
        shellNotes(question.payload.rootMidi, question.payload.quality),
      );
      // Never a degenerate voicing: root, 3rd and 7th are always three notes.
      expect(new Set(notes).size).toBe(3);
      expect(notes).toEqual([...notes].sort((a, b) => a - b));
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(36);
      expect(Math.max(...notes)).toBeLessThanOrEqual(84);
      // The shell is a left-hand voicing: its root sits below middle C.
      expect(question.payload.rootMidi).toBeLessThan(60);
    }
  });

  it('keeps the whole shell inside a narrow instrument', () => {
    // Two octaves: the narrowest instrument that can hold a root-position
    // shell in all 12 keys (12 keys + the widest shell's 11 semitones).
    for (let seed = 0; seed < 60; seed += 1) {
      const notes = shellOf(ask(seed, { low: 48, high: 72 }));
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(48);
      expect(Math.max(...notes)).toBeLessThanOrEqual(72);
    }
  });

  it('still asks the key it chose on an instrument too small for it', () => {
    // Under 23 semitones some key's shell cannot fit at all — a 17-semitone
    // "piano" is not one (the settings store guards ranges under an octave).
    // The question stays the chord it asked for; the shell's top may poke out.
    for (let seed = 0; seed < 40; seed += 1) {
      const question = ask(seed, { low: 55, high: 72 });
      const notes = shellOf(question);
      expect(pcOf(notes[0])).toBe(question.payload.rootPc);
      expect(notes[0]).toBeGreaterThanOrEqual(55);
      expect(new Set(notes).size).toBe(3);
    }
  });

  it('answers as a note sequence, with the shell spelled for the keys', () => {
    const question = ask(7);
    expect(question.answerMode).toBe('note-sequence');
    expect(
      [...(question.spellings ?? [])].map(([, name]) => name),
    ).toHaveLength(3);
  });

  it('avoids repeating the chord just asked', () => {
    const first = ask(3);
    const next = ask(3, undefined, [first.skillId]);
    expect(next.skillId).not.toBe(first.skillId);
  });

  it('derives the question id and skill id from the seed and the chord', () => {
    const question = ask(21);
    const { rootMidi, rootPc, quality } = question.payload;
    expect(question.id).toBe(
      `${PLAY_THE_VOICING_ID}:21:${rootMidi}:${quality}`,
    );
    expect(question.skillId).toBe(skillIdFor(quality, rootPc));
    expect(question.seed).toBe(21);
  });

  it('only offers qualities it can shell, whatever the settings say', () => {
    const settings: PlayTheVoicingSettings = {
      // dim7 has no shell, maj6 has no 7th, dom7alt has no intervals at all.
      qualities: ['dim7', 'maj6', 'dom7alt', 'min7'] as ChordQuality[],
    };
    for (let seed = 0; seed < 30; seed += 1)
      expect(ask(seed, undefined, [], settings).payload.quality).toBe('min7');
  });
});

describe('play-the-voicing grade', () => {
  const question = ask(5);
  const { rootPc, rootMidi, quality } = question.payload;
  const shell = shellOf(question);

  it('accepts the shell as it is revealed', () => {
    expect(playTheVoicing.grade(question, played(shell))).toEqual({
      correct: true,
      score: 1,
    });
  });

  it('accepts the A form, the B form and another octave', () => {
    const [root, third, seventh] = shell;
    // A form 1-7-3: the 7th under the 3rd, which moves an octave up.
    expect(
      playTheVoicing.grade(question, played([root, seventh, third + 12]))
        .correct,
    ).toBe(true);
    // The same shape an octave down, played top note first.
    expect(
      playTheVoicing.grade(
        question,
        played([seventh - 12, third - 12, root - 12]),
      ).correct,
    ).toBe(true);
  });

  it('rejects the shell of another key — the key is what is asked', () => {
    const transposed = shell.map((midi) => midi + 2);
    const grade = playTheVoicing.grade(question, played(transposed));
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.revealed).toEqual({
      notes: shell,
      label: question.expected.label,
    });
  });

  it('rejects the right notes over the wrong bass', () => {
    const inverted = [shell[1], shell[2], shell[0] + 12];
    const grade = playTheVoicing.grade(question, played(inverted));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe('Right notes — the root belongs at the bottom');
  });

  it('rejects the whole chord and the triad', () => {
    expect(
      playTheVoicing.grade(
        question,
        played(chordNotes(rootMidi, quality) ?? []),
      ).correct,
    ).toBe(false);
    expect(
      playTheVoicing.grade(question, played([rootMidi, shell[1], rootMidi + 7]))
        .correct,
    ).toBe(false);
  });

  it('rejects a doubling, which always costs a chord tone', () => {
    expect(
      playTheVoicing.grade(
        question,
        played([rootMidi, shell[1], rootMidi + 12]),
      ).correct,
    ).toBe(false);
  });

  it('counts an empty or one-note answer as a miss', () => {
    expect(playTheVoicing.grade(question, played([])).correct).toBe(false);
    expect(playTheVoicing.grade(question, played([rootMidi])).score).toBe(0);
    expect(
      playTheVoicing.grade(question, { kind: 'choice', choiceId: 'x' }).correct,
    ).toBe(false);
  });

  it('scores binary, never partial', () => {
    for (const answer of [shell, [shell[0], shell[1], shell[2] + 1]]) {
      const grade = playTheVoicing.grade(question, played(answer));
      expect(grade.score).toBe(grade.correct ? 1 : 0);
    }
  });

  it('grades enharmonics equal, because it grades integers', () => {
    // Whatever the key, the shell's own pitch classes are what is compared.
    const pcs = shellPitchClasses(rootPc, quality) ?? [];
    const respelled = [
      rootMidi,
      ...pcs.filter((pc) => pc !== rootPc).map((pc) => 72 + pc),
    ];
    expect(playTheVoicing.grade(question, played(respelled)).correct).toBe(
      true,
    );
  });
});

describe('play-the-voicing skills', () => {
  it('covers one skill per chord: every quality in all 12 keys', () => {
    const skills = playTheVoicing.skillsCovered(DEFAULTS);
    expect(skills).toHaveLength(STARTER_QUALITIES.length * 12);
    expect(new Set(skills).size).toBe(skills.length);
    expect(skills).toContain(skillIdFor('maj7', 0));
  });

  it('leaves out a quality it cannot shell', () => {
    expect(
      playTheVoicing.skillsCovered({
        qualities: ['dim7', 'min7'] as ChordQuality[],
      }),
    ).toHaveLength(12);
  });

  it('labels a skill with its chord symbol, for the grid', () => {
    expect(voicingSkillLabel(skillIdFor('maj7', 0))).toBe('Cmaj7');
    expect(voicingSkillLabel(skillIdFor('dom7', 1))).toBe('Db7');
    expect(voicingSkillLabel(skillIdFor('min7', 10))).toBe('Bbm7');
    expect(voicingSkillLabel('chord-quality:min7')).toBe('chord-quality:min7');
    expect(voicingSkillLabel(`${PLAY_THE_VOICING_ID}:dim7:0`)).toBe(
      `${PLAY_THE_VOICING_ID}:dim7:0`,
    );
    expect(voicingSkillLabel(`${PLAY_THE_VOICING_ID}:maj7:nonsense`)).toBe(
      `${PLAY_THE_VOICING_ID}:maj7:nonsense`,
    );
  });
});

describe('missDetail', () => {
  it('says nothing when the answer was right', () => {
    expect(missDetail(0, 'dom7', shellNotes(48, 'dom7') ?? [])).toBeUndefined();
  });

  it('calls out the right notes over the wrong bass', () => {
    // C7 played E-Bb-C.
    expect(missDetail(0, 'dom7', [52, 58, 72])).toBe(
      'Right notes — the root belongs at the bottom',
    );
  });

  it('calls out the 5th a shell leaves out', () => {
    // C7 played as a C triad: root, 3rd, 5th — the triad player's reflex.
    expect(missDetail(0, 'dom7', [48, 52, 55])).toBe(
      'A shell leaves the 5th out — keep the 3rd and the 7th',
    );
    // Dmaj7 played D-F#-A: the 7th is C#, not the highest pitch class.
    expect(missDetail(2, 'maj7', [50, 54, 57])).toBe(
      'A shell leaves the 5th out — keep the 3rd and the 7th',
    );
  });

  it('calls out the 3rd, the note a shell cannot lose', () => {
    // C7 played C-G-Bb: the 7th is there, the colour is not.
    expect(missDetail(0, 'dom7', [48, 55, 58])).toBe(
      'The 3rd is the colour — a shell keeps the 3rd and the 7th',
    );
    // Dm7 played D-A-C, same shape a tone up.
    expect(missDetail(2, 'min7', [50, 57, 60])).toBe(
      'The 3rd is the colour — a shell keeps the 3rd and the 7th',
    );
  });

  it('leaves an answer that has the other 3rd to the naming branch', () => {
    // Asked Cm7, played the C7 shell: the mirror of the maj7/dom7 pair below,
    // and the one that differs in the *3rd*. The answer has a 3rd — the wrong
    // one — so "the 3rd is the colour" would be false and the shell is named.
    expect(missDetail(0, 'min7', shellNotes(48, 'dom7') ?? [])).toBe(
      'You played the C7 shell',
    );
    // And the other way round: asked Cmaj7, played the minor/major 7th shell.
    expect(missDetail(0, 'maj7', [48, 51, 59])).toBe(
      'You played the CmMaj7 shell',
    );
  });

  it('names the shell that was played instead', () => {
    // Asked Cmaj7, played the C7 shell.
    expect(missDetail(0, 'maj7', shellNotes(48, 'dom7') ?? [])).toBe(
      'You played the C7 shell',
    );
    // Asked Cmaj7, played the Db maj7 shell — a transposition, not noise.
    expect(missDetail(0, 'maj7', shellNotes(49, 'maj7') ?? [])).toBe(
      'You played the Dbmaj7 shell',
    );
  });

  it('names a whole chord played where a shell was asked', () => {
    expect(missDetail(0, 'dom7', chordNotes(48, 'dom7') ?? [])).toBe(
      'You played C7 in full',
    );
  });

  it('has nothing to say about a handful of notes', () => {
    expect(missDetail(0, 'dom7', [48])).toBeUndefined();
    expect(missDetail(0, 'dom7', [60, 61, 62])).toBeUndefined();
  });
});
