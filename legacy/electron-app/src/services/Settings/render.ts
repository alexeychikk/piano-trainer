import { compileSchema } from '@src/services/Ipc/render';
import { SettingsSchema } from './shared';

const { Service } = compileSchema(SettingsSchema);

class SettingsService extends Service {}

export const settingsService = new SettingsService();
