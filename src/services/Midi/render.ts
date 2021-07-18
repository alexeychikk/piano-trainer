import { compileSchema } from '@src/services/Ipc/render';
import { MidiSchema } from './shared';

export const MidiService = compileSchema(MidiSchema);
