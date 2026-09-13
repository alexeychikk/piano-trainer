import easymidi from 'easymidi';
import { compileSchema } from '@src/services/Ipc/main';
import type { MidiMethods } from './shared';
import { MidiSchema } from './shared';

const { Service } = compileSchema(MidiSchema);

export class MidiService extends Service implements MidiMethods {
  private connectedInputs: Record<string, easymidi.Input> = {};

  async getInputs() {
    return easymidi.getInputs();
  }

  async connect(name: string) {
    const input = new easymidi.Input(name);

    input.on('noteon', (note) => this.emit.onNoteDown({ input: name, note }));
    input.on('noteoff', (note) => this.emit.onNoteUp({ input: name, note }));

    this.connectedInputs[name] = input;
  }

  async disconnect(name: string) {
    const input = this.connectedInputs[name];
    input.removeAllListeners();
    input.close();
    delete this.connectedInputs[name];
  }

  async destroy() {
    await super.destroy();
    Object.keys(this.connectedInputs).forEach((name) => this.disconnect(name));
  }
}
