import type { Note } from 'easymidi';
import { compileSchema } from '@src/services/Ipc/render';
import { MidiSchema } from './shared';

const { Service } = compileSchema(MidiSchema);

class MidiService extends Service {
  onNoteDown(inputName: string, handler: (note: Note) => void) {
    return this.events.onNoteDown(({ input, note }) =>
      input === inputName ? handler(note) : undefined,
    );
  }

  onNoteUp(inputName: string, handler: (note: Note) => void) {
    return this.events.onNoteUp(({ input, note }) =>
      input === inputName ? handler(note) : undefined,
    );
  }
}

export const midiService = new MidiService();
