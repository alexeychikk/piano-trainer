import type { App, BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type { IpcSchema } from './shared';

export type MainServiceParams = { app: App; win: BrowserWindow };

export abstract class MainService {
  protected readonly app: App;
  protected readonly win: BrowserWindow;

  constructor({ app, win }: MainServiceParams) {
    this.app = app;
    this.win = win;
  }

  abstract destroy(): Promise<void>;
}

export function compileSchema<Schema extends IpcSchema>(schema: Schema) {
  type Emit = {
    [key in keyof Schema['events']]: (param: Schema['events'][key]) => void;
  };

  abstract class IpcServiceMain extends MainService {
    protected readonly emit: Emit;

    constructor(params: MainServiceParams) {
      super(params);

      Object.keys(schema.methods || {}).forEach((methodName) => {
        ipcMain.handle(`${schema.name}.${methodName}`, async (event, ...args) =>
          // @ts-ignore
          this[methodName](...args),
        );
      });

      this.emit = Object.keys(schema.events || {}).reduce((res, eventName) => {
        res[eventName as keyof Schema['events']] = (param) =>
          this.win.webContents.send(`${schema.name}.${eventName}`, param);
        return res;
      }, {} as Emit);
    }

    async destroy() {
      Object.keys(schema.methods || {}).forEach((methodName) => {
        ipcMain.removeHandler(`${schema.name}.${methodName}`);
      });
    }
  }

  return { Service: IpcServiceMain };
}
