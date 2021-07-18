import type { IpcRendererEvent } from 'electron/main';
import type { IpcSchema } from './shared';

const { ipcRenderer } = window.require('electron');

export type IpcServiceRender<Schema extends IpcSchema> = Exclude<
  Schema['methods'],
  undefined
> &
  {
    [key in keyof Schema['events']]: (
      fn: (param: Schema['events'][key]) => void,
    ) => { off: () => void };
  };

export function compileSchema<Schema extends IpcSchema>(
  schema: Schema,
): IpcServiceRender<Schema> {
  const service: IpcServiceRender<Schema> = {} as IpcServiceRender<Schema>;

  Object.keys(schema.methods || {}).forEach((methodName) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service[methodName] = (...args: any) =>
      ipcRenderer.invoke(`${schema.name}.${methodName}`, ...args);
  });

  Object.keys(schema.events || {}).forEach((eventName) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service[eventName] = (fn: (...args: any) => void) => {
      const channel = `${schema.name}.${eventName}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listener = (event: IpcRendererEvent, ...args: any) => fn(...args);
      ipcRenderer.on(channel, listener);
      const off = () => {
        ipcRenderer.off(channel, listener);
      };
      return { off };
    };
  });

  return service;
}
