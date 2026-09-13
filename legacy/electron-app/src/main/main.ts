import path from 'path';
import { format } from 'url';
import { app, BrowserWindow, Menu } from 'electron';
import { is } from 'electron-util';
import { ServiceRegistry } from '@src/services/main';

async function createWindow() {
  const isDev = is.development;

  const win = new BrowserWindow({
    width: 800,
    height: 820,
    minHeight: 600,
    minWidth: 480,
    webPreferences: {
      nodeIntegration: true,
      devTools: true,
      enableRemoteModule: true,
      contextIsolation: false,
    },
    show: false,
    darkTheme: true,
    center: true,
  });

  if (!isDev) Menu.setApplicationMenu(null);

  if (isDev) {
    void win.loadURL('http://localhost:9080');
  } else {
    void win.loadURL(
      format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true,
      }),
    );
  }

  win.on('closed', () => {
    // do something
  });

  win.webContents.on('devtools-opened', () => {
    win!.focus();
  });

  win.on('ready-to-show', () => {
    win!.show();
    win!.focus();

    if (isDev) win!.webContents.openDevTools({ mode: 'bottom' });
  });

  return win;
}

function bootstrap() {
  const serviceRegistry = new ServiceRegistry();

  const init = async () => {
    const win = await createWindow();
    await serviceRegistry.init({ app, win });
  };

  app.on('ready', init);

  app.on('window-all-closed', async () => {
    await serviceRegistry.destroy();
    app.quit();
  });
}

bootstrap();
