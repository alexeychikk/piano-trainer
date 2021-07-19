import type { IpcRendererEvent } from 'electron/main';
import type { IpcSchema } from './shared';

const { ipcRenderer } = window.require('electron');

export function compileSchema<Schema extends IpcSchema>(schema: Schema) {
  class IpcServiceRender {
    public readonly invoke!: Exclude<Schema['methods'], undefined>;
    public readonly events!: {
      [key in keyof Schema['events']]: (
        fn: (param: Schema['events'][key]) => void,
      ) => { off: () => void };
    };

    constructor() {
      // @ts-ignore
      this.invoke = {};
      // @ts-ignore
      this.events = {};

      Object.keys(schema.methods || {}).forEach((methodName) => {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.invoke[methodName] = (...args: any) =>
          ipcRenderer.invoke(`${schema.name}.${methodName}`, ...args);
      });

      Object.keys(schema.events || {}).forEach((eventName) => {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.events[eventName] = (fn: (...args: any) => void) => {
          const channel = `${schema.name}.${eventName}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const listener = (event: IpcRendererEvent, ...args: any) =>
            fn(...args);
          ipcRenderer.on(channel, listener);
          const off = () => {
            ipcRenderer.off(channel, listener);
          };
          return { off };
        };
      });
    }
  }

  return { Service: IpcServiceRender };
}
