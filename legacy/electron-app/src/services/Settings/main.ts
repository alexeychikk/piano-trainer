import Store from 'electron-store';
import type { MainServiceParams } from '../Ipc/main';
import { compileSchema } from '../Ipc/main';
import type { InputSettings, Settings, SettingsMethods } from './shared';
import { SettingsSchema } from './shared';

const { Service } = compileSchema(SettingsSchema);

export class SettingsService extends Service implements SettingsMethods {
  protected store: Store<Settings>;

  constructor(params: MainServiceParams) {
    super(params);
    this.store = new Store<Settings>({
      name: 'settings',
      defaults: {
        inputs: {},
      },
    });
  }

  get inputs(): Record<string, InputSettings> {
    return this.store.get('inputs');
  }

  get lastConnectedInput(): string | undefined {
    return this.store.get('lastConnectedInput');
  }

  async getInputSettings(name: string) {
    return this.inputs[name];
  }

  async setInputSettings(name: string, settings: InputSettings) {
    this.store.set(`inputs.${name}`, settings);
  }

  async deleteInputSettings(name: string) {
    this.store.delete(`inputs.${name}` as keyof Settings);
  }

  async getLastConnectedInputSettings() {
    const name = this.lastConnectedInput;
    return name ? this.getInputSettings(name) : undefined;
  }

  async setLastConnectedInput(name: string) {
    this.store.set('lastConnectedInput', name);
  }
}
