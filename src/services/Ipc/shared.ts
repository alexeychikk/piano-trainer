export type IpcSchema = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods?: Record<string, (...args: any) => Promise<any>>;
  events?: Record<string, unknown>;
};

const noop = async () => undefined;
const noopObject = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ipcFn = <T extends (...args: any) => Promise<any>>() => noop as T;

export const ipcEvent = <T>() => noopObject as T;
