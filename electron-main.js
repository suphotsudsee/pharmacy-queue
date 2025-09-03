// electron-main.js
const { app, BrowserWindow, screen, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');

const isDev = !app.isPackaged;
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

let mainWin = null;
let displayWin = null;
let serverProcess = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Node 18+ มี fetch ในตัว
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch (_) {}
    await sleep(300);
  }
  throw new Error(`Next server not ready at ${url}`);
}

async function startNextServerIfPackaged() {
  if (isDev) return;

  // รัน Next standalone จากใน asar (แนะนำให้ asarUnpack โฟลเดอร์นี้ด้วย)
  const asarRoot = path.join(process.resourcesPath, 'app.asar');
  const standaloneDir = path.join(asarRoot, '.next', 'standalone');
  const serverJs = path.join(standaloneDir, 'server.js');

  serverProcess = fork(serverJs, [], {
    cwd: standaloneDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit'
  });

  // รอ server ตื่น
  await waitForServer(`${BASE_URL}`);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  mainWin.loadURL(BASE_URL); // หน้าเรียกคิว "/"
  mainWin.on('closed', () => (mainWin = null));
}

function createDisplayWindow() {
  // จอภายนอกถ้ามี ให้โยนไปจอนั้นแบบเต็มจอ
  const displays = screen.getAllDisplays();
  const ext = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);

  const opts = {
    width: ext ? ext.size.width : 1280,
    height: ext ? ext.size.height : 720,
    x: ext ? ext.bounds.x : undefined,
    y: ext ? ext.bounds.y : undefined,
    show: true,
    autoHideMenuBar: true,
    fullscreen: !!ext,      // ถ้ามีจอนอกให้เต็มจอ
    kiosk: !!ext,           // โหมดคีออสสำหรับจอแสดงผล
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true }
  };

  displayWin = new BrowserWindow(opts);
  displayWin.setMenuBarVisibility(false);
  displayWin.loadURL(`${BASE_URL}/display`);  // หน้าแสดงคิว "/display"
  displayWin.on('closed', () => (displayWin = null));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    if (!isDev) await startNextServerIfPackaged();
    else await waitForServer(BASE_URL); // dev: ให้แน่ใจว่า next dev เปิดอยู่

    createMainWindow();
    createDisplayWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
        createDisplayWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (serverProcess && !serverProcess.killed) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
  });
}
