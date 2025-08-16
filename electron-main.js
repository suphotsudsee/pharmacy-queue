const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const next = require('next');

let mainWindow;
let serverInstance;

async function startNextServer() {
  const isDev = !app.isPackaged;
  const dir = path.join(__dirname);
  const nextApp = next({ dev: isDev, dir });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  const srv = http.createServer((req, res) => handle(req, res));
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  return srv;
}

async function createWindow() {
  serverInstance = await startNextServer();
  const address = serverInstance.address();
  const url = `http://127.0.0.1:${address.port}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    icon: path.join(__dirname, 'public', 'icon.ico')
  });

  await mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  try {
    if (serverInstance) serverInstance.close();
  } catch (e) { /* ignore */ }
});
