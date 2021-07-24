import type { App, BrowserWindow } from 'electron';
import type { MainService, MainServiceParams } from './Ipc/main';
import { MidiService } from './Midi/main';
import { SettingsService } from './Settings/main';

export class ServiceRegistry {
  protected services: MainService[] = [];
  protected win!: BrowserWindow;
  protected app!: App;

  get serviceParams() {
    return { win: this.win, app: this.app };
  }

  async init({ app, win }: MainServiceParams) {
    this.app = app;
    this.win = win;
    this.services.push(new SettingsService(this.serviceParams));
    this.services.push(new MidiService(this.serviceParams));
  }

  async destroy() {
    for (const service of this.services) {
      await service.destroy();
    }
  }
}
