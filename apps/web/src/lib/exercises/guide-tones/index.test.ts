import { describe, expect, it } from 'vitest';
import {
  chordNotes,
  chordSymbolText,
  guideToneNotes,
  guideTonePitchClasses,
  pcOf,
  rootlessNotesFromBass,
  shellNotes,
  type ChordQuality,
  type PitchClass,
} from '$lib/theory';
import { mulberry32 } from '../rng';
import type { Answer, GenerateContext, Question } from '../types';
import {
  GUIDE_TONES_ID,
  STARTER_QUALITIES,
  guideTones,
  guideTonesSkillLabel,
  missDetail,
  skillIdFor,
  type GuideTonesPayload,
  type GuideTonesSettings,
} from './index';

const DEFAULTS = guideTones.defaultSettings as GuideTonesSettings;

function context(
  seed: number,
  range = { low: 36, high: 84 },
  recentSkillIds: string[] = [],
  settings: GuideTonesSettings = DEFAULTS,
): GenerateContext<GuideTonesSettings> {
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
  settings?: GuideTonesSettings,
): Question<GuideTonesPayload> {
  return guideTones.generate(context(seed, range, recent, settings));
}

/** The pair of a question — what the reveal plays and the answer must be. */
function pairOf(question: Question<GuideTonesPayload>): number[] {
  return question.revealPlayback?.events[0].notes ?? [];
}

function played(notes: number[]): Answer {
  return { kind: 'notes', notes, order: notes, source: 'onscreen' };
}

/** The other starter quality, for "you played that colour's 3rd" cases. */
function otherQuality(quality: ChordQuality): ChordQuality {
  return STARTER_QUALITIES.find((other) => other !== quality) ?? 'dom7';
}

describe('guide-tones generate', () => {
  it('is reproducible from the seed', () => {
    expect(ask(42)).toEqual(ask(42));
  });

  it('only asks qualities that have a 3rd-and-7th pair', () => {
    for (let seed = 0; seed < 80; seed += 1)
      expect(STARTER_QUALITIES).toContain(ask(seed).payload.quality);
  });

  it('asks all 12 keys and every quality over enough questions', () => {
    const keys = new Set<number>();
    const qualities = new Set<ChordQuality>();
    for (let seed = 0; seed < 300; seed += 1) {
      const { rootPc, quality } = ask(seed).payload;
      keys.add(rootPc);
      qualities.add(quality);
    }
    expect(keys.size).toBe(12);
    expect(qualities.size).toBe(STARTER_QUALITIES.length);
  });

  it('prompts with the chord symbol alone — the drill is read, not heard', () => {
    const question = ask(11);
    expect(question.prompt.title).toMatch(/^[A-G][b#]?(maj7|m7|7)$/);
    expect(question.prompt.subtitle).toBe(
      'Play the guide tones: 3rd and 7th — no root',
    );
    expect(question.prompt.showKeyboard).toBe(true);
    // Nothing dims: the pair may be played in any octave.
    expect(question.range).toBeUndefined();
    expect(question.expected).toEqual({
      kind: 'notes',
      notes: pairOf(question),
      label: `${question.prompt.title} guide tones`,
    });
  });

  it('sounds the root as a reference, never the answer', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const question = ask(seed);
      const { rootMidi, rootPc } = question.payload;
      expect(question.playback.events).toHaveLength(1);
      expect(question.playback.events[0].notes).toEqual([rootMidi]);
      expect(pcOf(rootMidi)).toBe(rootPc);
      // The note the answer must not contain cannot give it away — and it
      // sits under the pair, where a bass player would be.
      expect(pairOf(question)).not.toContain(rootMidi);
      expect(rootMidi).toBeLessThan(Math.min(...pairOf(question)));
    }
  });

  it('reveals the pair alone: two notes, in range, 3rd then 7th', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const question = ask(seed);
      const { quality, rootMidi, rootPc } = question.payload;
      const notes = pairOf(question);
      expect(notes).toEqual(guideToneNotes(rootMidi, quality));
      expect(notes).toHaveLength(2);
      expect(new Set(notes.map((midi) => pcOf(midi))).size).toBe(2);
      // Never the shell or the whole chord: the reveal shows only what was
      // asked for (slice 11's rule).
      expect(notes.map((midi) => pcOf(midi))).not.toContain(rootPc);
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(36);
      expect(Math.max(...notes)).toBeLessThanOrEqual(84);
      // The pair lands around middle C, where a hand comps it over a bass.
      expect(rootMidi).toBeGreaterThanOrEqual(48);
      expect(rootMidi).toBeLessThanOrEqual(62);
    }
  });

  it('keeps the pair inside a narrow instrument', () => {
    // Two octaves: still enough for any pair in any key (12 + 11 semitones).
    for (let seed = 0; seed < 60; seed += 1) {
      const notes = pairOf(ask(seed, { low: 48, high: 72 }));
      expect(Math.min(...notes)).toBeGreaterThanOrEqual(48);
      expect(Math.max(...notes)).toBeLessThanOrEqual(72);
    }
  });

  it('still asks the chord it chose on an instrument too small for it', () => {
    // An 11-semitone "piano" is not one (the settings store guards ranges
    // under an octave). The question stays the chord it asked for; the 7th
    // may poke out above the top key.
    for (let seed = 0; seed < 40; seed += 1) {
      const question = ask(seed, { low: 60, high: 71 });
      const { rootPc, quality, rootMidi } = question.payload;
      expect(pcOf(rootMidi)).toBe(rootPc);
      expect(rootMidi).toBeGreaterThanOrEqual(60);
      expect(pairOf(question)).toEqual(guideToneNotes(rootMidi, quality));
    }
  });

  it('answers as a note sequence, with a window sized for building it', () => {
    const question = ask(7);
    expect(question.answerMode).toBe('note-sequence');
    // A construction drill, not an echo: slice 11's window (the runner's
    // 1200 ms default closes an answer the user is still working out).
    expect(question.answerGapMs).toBe(2500);
    expect(
      [...(question.spellings ?? [])].map(([, name]) => name),
    ).toHaveLength(2);
  });

  it('avoids repeating the chord just asked', () => {
    const first = ask(3);
    const next = ask(3, undefined, [first.skillId]);
    expect(next.skillId).not.toBe(first.skillId);
  });

  it('derives the question id and skill id from the seed and the chord', () => {
    const question = ask(21);
    const { rootMidi, rootPc, quality } = question.payload;
    expect(question.id).toBe(`${GUIDE_TONES_ID}:21:${rootMidi}:${quality}`);
    expect(question.skillId).toBe(skillIdFor(quality, rootPc));
    expect(question.seed).toBe(21);
  });

  it('only offers qualities it can voice, whatever the settings say', () => {
    const settings: GuideTonesSettings = {
      // No 7th, a diminished 7th, no interval set at all — and `min7b5`,
      // whose pair is `min7`'s, so it is not drilled as its own colour.
      qualities: ['maj6', 'dim7', 'dom7alt', 'min7'] as ChordQuality[],
    };
    for (let seed = 0; seed < 30; seed += 1)
      expect(ask(seed, undefined, [], settings).payload.quality).toBe('min7');
  });
});

describe('guide-tones grade', () => {
  const question = ask(5);
  const { rootPc, rootMidi, quality } = question.payload;
  const pair = pairOf(question);

  it('accepts the pair as it is revealed', () => {
    expect(guideTones.grade(question, played(pair))).toEqual({
      correct: true,
      score: 1,
    });
  });

  it('accepts any octave, order and spacing — and either note underneath', () => {
    // Two octaves down, 7th struck first.
    expect(
      guideTones.grade(question, played([pair[1] - 24, pair[0] - 24])).correct,
    ).toBe(true);
    // The 7th below the 3rd: a guide-tone pair has no bass rule, unlike a
    // shell (root at the bottom) or a rootless form (the form *is* its bass).
    expect(
      guideTones.grade(question, played([pair[1] - 12, pair[0]])).correct,
    ).toBe(true);
    // Wide open: nearly three octaves apart.
    expect(
      guideTones.grade(question, played([pair[0] - 12, pair[1] + 24])).correct,
    ).toBe(true);
  });

  it('grades every key and quality the generator can ask', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const asked = ask(seed);
      expect(
        guideTones.grade(asked, played(pairOf(asked))).correct,
        asked.prompt.title,
      ).toBe(true);
    }
  });

  it('rejects the pair of another key', () => {
    const grade = guideTones.grade(
      question,
      played(pair.map((midi) => midi + 1)),
    );
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(grade.revealed).toEqual({
      notes: pair,
      label: question.expected.label,
    });
  });

  it('rejects the shell — the pair with the root added', () => {
    const grade = guideTones.grade(
      question,
      played(shellNotes(rootMidi, quality) ?? []),
    );
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      'That is the shell — guide tones are the 3rd and 7th alone',
    );
  });

  it('rejects the rootless voicing — the pair with its colour notes', () => {
    // The A form from the 3rd of the asked chord: 3-5-7-9, no root.
    const grade = guideTones.grade(
      question,
      played(rootlessNotesFromBass(pair[0], quality, 'A') ?? []),
    );
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      'That is the rootless voicing — the guide tones are the 3rd and 7th',
    );
  });

  it('rejects the whole chord, and names the root', () => {
    const grade = guideTones.grade(
      question,
      played(chordNotes(rootMidi, quality) ?? []),
    );
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      'You played the root — the bass has it, the guide tones do not',
    );
  });

  it('rejects half the pair, and says which half', () => {
    const third = guideTones.grade(question, played([pair[0]]));
    expect(third.correct).toBe(false);
    expect(third.feedback).toBe(
      'That is the 3rd — the 7th is the other guide tone',
    );
    expect(guideTones.grade(question, played([pair[1]])).feedback).toBe(
      'That is the 7th — the 3rd is the other guide tone',
    );
  });

  it('rejects a doubling, which always costs the other guide tone', () => {
    const grade = guideTones.grade(question, played([pair[0], pair[0] + 12]));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      'You played the 3rd twice — the 7th is missing',
    );
    expect(
      guideTones.grade(question, played([pair[1], pair[1] - 12])).feedback,
    ).toBe('You played the 7th twice — the 3rd is missing');
  });

  it('names the other colour’s pair in the asked key', () => {
    const other = otherQuality(quality);
    const theirs = guideToneNotes(rootMidi, other) ?? [];
    const grade = guideTones.grade(question, played(theirs));
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toBe(
      `You played the ${chordSymbolText(rootPc, other)} guide tones`,
    );
  });

  it('names the pair of whatever chord was played, in any key', () => {
    // The whole pair a semitone out: a transposition, not noise. Which of the
    // two readings it is named by is `missDetail`'s rule (tested below with
    // hand-built keys); what `grade()` owes is a named chord.
    const grade = guideTones.grade(
      question,
      played(guideToneNotes(rootMidi + 1, quality) ?? []),
    );
    expect(grade.correct).toBe(false);
    expect(grade.feedback).toMatch(/^You played the \S+ guide tones$/);
  });

  it('counts an empty answer and a choice as a miss', () => {
    expect(guideTones.grade(question, played([])).correct).toBe(false);
    expect(guideTones.grade(question, played([])).feedback).toBeUndefined();
    expect(
      guideTones.grade(question, { kind: 'choice', choiceId: 'x' }).correct,
    ).toBe(false);
  });

  it('scores binary, never partial', () => {
    // One of two guide tones is not half a pair: the mastery EWMA would read
    // it as a key half-learned (ADR §10).
    expect(guideTones.grade(question, played([pair[0]])).score).toBe(0);
    expect(guideTones.grade(question, played(pair)).score).toBe(1);
  });
});

describe('the tritone substitute shares the pair — and that is the music', () => {
  it('accepts a dominant’s pair asked from either of its two roots', () => {
    // C7 and Gb7 are the same E and Bb: the fact tritone substitution is built
    // on. Neither reading is wrong, so `grade()` cannot call one of them so.
    const seed = [...Array(200).keys()].find(
      (candidate) => ask(candidate).payload.quality === 'dom7',
    );
    expect(seed).toBeDefined();
    const question = ask(seed ?? 0);
    const { rootMidi } = question.payload;
    expect(
      guideTones.grade(
        question,
        played(guideToneNotes(rootMidi + 6, 'dom7') ?? []),
      ).correct,
    ).toBe(true);
  });
});

describe('missDetail', () => {
  it('says nothing about a right answer, or about no answer at all', () => {
    expect(missDetail(0, 'maj7', guideToneNotes(60, 'maj7') ?? [])).toBe(
      undefined,
    );
    expect(missDetail(0, 'maj7', [])).toBe(undefined);
  });

  it('says nothing it cannot name', () => {
    // D and E, asked Cmaj7: nobody's 3rd and 7th, not a chord, and not the
    // root either — a bare ✗ is the honest answer.
    expect(missDetail(0, 'maj7', [62, 64])).toBe(undefined);
  });

  it('names the root even in an answer it cannot name otherwise', () => {
    // C and D, asked Cmaj7: nothing nameable, but the root is in there and
    // leaving it out is the whole drill.
    expect(missDetail(0, 'maj7', [60, 62])).toBe(
      'You played the root — the bass has it, the guide tones do not',
    );
  });

  it('names another chord’s pair rather than the root it happens to contain', () => {
    // Asked Cmaj7 (E, B); played Dbmaj7's pair (F, C). C is the asked root,
    // but the user did not add a root to anything — they played a whole other
    // chord's guide tones, and the reading in the asked quality names it.
    expect(missDetail(0, 'maj7', [65, 72])).toBe(
      'You played the Dbmaj7 guide tones',
    );
  });

  it('prefers the reading in the asked key — the wrong colour, right key', () => {
    // Asked Am7 (C, G); played C# and G#, which is Amaj7's pair and also
    // Bbm7's. The asked key is the useful sentence: both notes were raised.
    expect(missDetail(9, 'min7', [61, 68])).toBe(
      'You played the Amaj7 guide tones',
    );
  });

  it('names a guide tone played beside the 5th — the triad player’s reflex', () => {
    // Asked Cmaj7 (E, B); played E and G. Right 3rd, and then the note a hand
    // that learned triads first reaches for. No chord anywhere has this pair
    // for its guide tones (3 semitones apart), so before this branch it was a
    // bare ✗ — the one plausible miss in the drill nothing named.
    expect(missDetail(0, 'maj7', [64, 67])).toBe(
      'That is the 3rd and the 5th — the 7th is the other guide tone',
    );
    // The mirror, asked C7: the 7th kept, the 5th reached for instead of the
    // 3rd — the note that makes the chord a colour at all.
    expect(missDetail(0, 'dom7', [67, 70])).toBe(
      'That is the 7th and the 5th — the 3rd is the other guide tone',
    );
    // Register, octave, spacing and order are as free here as they are in the
    // answer itself: it is a pitch-class rule.
    expect(missDetail(0, 'maj7', [79, 52])).toBe(
      'That is the 3rd and the 5th — the 7th is the other guide tone',
    );
  });

  it('prefers the asked chord’s own tones to a distant minMaj7 reading', () => {
    // Asked Cm7 (Eb, Bb); played Eb and G — the same mistake as above, except
    // that those two notes *are* Em(maj7)'s guide tones, a chord this drill
    // never asks for. Two tones of the chord on screen, named in the asked key,
    // beat a transposition into a quality the user has never seen.
    expect(missDetail(0, 'min7', [63, 67])).toBe(
      'That is the 3rd and the 5th — the 7th is the other guide tone',
    );
  });

  it('leaves every answer another branch names better alone', () => {
    // The shell, the rootless voicing, another chord's whole pair and a larger
    // voicing in another key all keep the lines they had: the new branch is
    // exactly two pitch classes, one of them this chord's guide tone and the
    // other this chord's own 5th.
    expect(missDetail(0, 'maj7', shellNotes(60, 'maj7') ?? [])).toBe(
      'That is the shell — guide tones are the 3rd and 7th alone',
    );
    expect(
      missDetail(0, 'maj7', rootlessNotesFromBass(64, 'maj7', 'A') ?? []),
    ).toBe(
      'That is the rootless voicing — the guide tones are the 3rd and 7th',
    );
    expect(missDetail(0, 'maj7', [65, 72])).toBe(
      'You played the Dbmaj7 guide tones',
    );
    expect(missDetail(0, 'maj7', [62, 65, 69, 72])).toBe(
      'You played Dm7 in full',
    );
    // The root beside the 5th is not a guide tone beside the 5th: C and G stay
    // the Abmaj7 reading they always had (a true sentence, and out of scope).
    expect(missDetail(0, 'maj7', [60, 67])).toBe(
      'You played the Abmaj7 guide tones',
    );
    // Half the pair still reads as half the pair, at one note and at two.
    expect(missDetail(0, 'maj7', [64])).toBe(
      'That is the 3rd — the 7th is the other guide tone',
    );
    expect(missDetail(0, 'maj7', [64, 76])).toBe(
      'You played the 3rd twice — the 7th is missing',
    );
  });

  it('changes no grade — a named miss is still a miss', () => {
    // The whole point of the branch is a better sentence, never a better mark
    // (ADR §10 is binary, and `spellsGuideTones()` is untouched).
    const question = ask(0);
    const { rootPc, quality, rootMidi } = question.payload;
    // The starter qualities all have a perfect 5th.
    const fifth = rootMidi + 7;
    const third = (guideToneNotes(rootMidi, quality) ?? [])[0];
    const grade = guideTones.grade(question, played([third, fifth]));
    expect(grade.correct).toBe(false);
    expect(grade.score).toBe(0);
    expect(missDetail(rootPc, quality, [third, fifth])).toBe(
      'That is the 3rd and the 5th — the 7th is the other guide tone',
    );
  });

  it('names a larger voicing in another key', () => {
    // Asked Cmaj7; played the Ab7 shell (Ab, C, Gb).
    expect(missDetail(0, 'maj7', [56, 60, 66])).toBe(
      'You played the Ab7 shell',
    );
    // Asked Cmaj7; played a whole Dm7.
    expect(missDetail(0, 'maj7', [62, 65, 69, 72])).toBe(
      'You played Dm7 in full',
    );
  });
});

describe('guideTonesSkillLabel', () => {
  it('names a cell with the chord symbol a chart would print', () => {
    expect(guideTonesSkillLabel(skillIdFor('maj7', 0))).toBe('Cmaj7');
    expect(guideTonesSkillLabel(skillIdFor('dom7', 1))).toBe('Db7');
    expect(guideTonesSkillLabel(skillIdFor('min7', 10))).toBe('Bbm7');
  });

  it('gives an id it does not own back unchanged', () => {
    for (const id of [
      'guide-tones',
      'guide-tones:maj7',
      'guide-tones:maj7:0:A',
      'guide-tones:maj7:12',
      'guide-tones:maj7:-1',
      'guide-tones:maj7: 3 ',
      'guide-tones:maj7:',
      'guide-tones:maj7:3.0',
      'guide-tones:constructor:0',
      // A quality with no pair at all: a cell nothing can ask.
      'guide-tones:dim7:0',
      'guide-tones:maj6:0',
      'rootless-voicing:maj7:0:A',
      'play-the-voicing:maj7:0',
    ])
      expect(guideTonesSkillLabel(id), id).toBe(id);
  });
});

describe('guide-tones skillsCovered', () => {
  it('is one cell per chord: 12 keys × the starter qualities', () => {
    const skillIds = guideTones.skillsCovered(DEFAULTS);
    expect(skillIds).toHaveLength(12 * STARTER_QUALITIES.length);
    expect(new Set(skillIds).size).toBe(skillIds.length);
    for (const skillId of skillIds)
      expect(guideTonesSkillLabel(skillId)).not.toBe(skillId);
  });

  it('covers every skill the generator can ask', () => {
    const covered = new Set(guideTones.skillsCovered(DEFAULTS));
    for (let seed = 0; seed < 200; seed += 1)
      expect(covered.has(ask(seed).skillId)).toBe(true);
  });

  it('leaves out a quality it cannot voice', () => {
    const settings: GuideTonesSettings = {
      qualities: ['maj7', 'dim7', 'dom7alt'] as ChordQuality[],
    };
    const skillIds = guideTones.skillsCovered(settings);
    expect(skillIds).toHaveLength(12);
    for (const skillId of skillIds) expect(skillId).toContain('maj7');
  });

  it('its own pitch classes are the ones the pair is built from', () => {
    // A guard on the vocabulary the cells are named from: the drill asks for
    // exactly two pitch classes per chord, in every key.
    for (const quality of STARTER_QUALITIES)
      for (let rootPc = 0; rootPc < 12; rootPc += 1)
        expect(
          guideTonePitchClasses(rootPc as PitchClass, quality),
        ).toHaveLength(2);
  });
});
