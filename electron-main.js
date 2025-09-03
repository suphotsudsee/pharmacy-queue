// electron-main.js
// --- Main process for Electron + Next.js (2 windows: "/" and "/display") ---
// - Dev: ถ้ายังไม่มี next dev จะสตาร์ทให้เอง แล้วรอจนพร้อม
// - Packaged: fork .next/standalone/server.js (รองรับ asar & asarUnpack)
// - เปิด 2 Window: main (หน้าเรียกคิว "/") และ display (หน้าแสดงคิว "/display")
// - รองรับจอนอก: โยนหน้าจอ display ไปจอนอกแบบ kiosk/fullscreen ถ้ามี
// - จัดการ error/unhandled และ kill โปรเซสอย่างเรียบร้อยบน Windows

const { app, BrowserWindow, screen, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, fork } = require('child_process');

// ---------------------- Config ----------------------
const IS_DEV = !app.isPackaged;
const BASE_PORT = Number(process.env.PORT) || 3000;
const HEALTH_PATH = process.env.HEALTH_PATH || '/api/health'; // ถ้ามี endpoint health จะเช็คอันนี้ก่อน
const CANDIDATE_PORTS = [BASE_PORT, BASE_PORT + 1, 3001, 5173];

let mainWin = null;
let displayWin = null;
let serverProcess = null; // packaged next server
let devProcess = null;    // dev next process (ถ้าเราสตาร์ทให้)

// ---------------------- Utils ----------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ping(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, timeoutMs = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await ping(url)) return true;
    await sleep(300);
  }
  throw new Error(`Next server not ready at ${url}`);
}

async function findReadyBaseUrl() {
  // ลองเช็ค /api/health ก่อน ถ้าไม่พร้อมค่อยเช็ค /
  for (const p of CANDIDATE_PORTS) {
    const h = `http://localhost:${p}${HEALTH_PATH}`;
    if (await ping(h)) return `http://localhost:${p}`;
  }
  for (const p of CANDIDATE_PORTS) {
    const u = `http://localhost:${p}`;
    if (await ping(u)) return u;
  }
  return null;
}

// ---------------------- Dev: ensure next dev ----------------------
async function ensureDevServer() {
  // ถ้ามี dev server วิ่งอยู่แล้ว ใช้เลย
  const ready = await findReadyBaseUrl();
  if (ready) return ready;

  // พยายามสตาร์ท next dev แบบเสถียรบน Windows โดยเรียก Next CLI ผ่าน node
  const APP_ROOT = process.cwd();

  // strategy: ลองพอร์ตตามลำดับ CANDIDATE_PORTS จนสำเร็จ
  for (const tryPort of CANDIDATE_PORTS) {
    try {
      // ตำแหน่ง CLI ของ Next
      const nextCli = require.resolve('next/dist/bin/next', { paths: [APP_ROOT] });

      // kill ของเดิมถ้ามี
      if (devProcess && !devProcess.killed) { try { devProcess.kill(); } catch {} }

      devProcess = spawn(
        process.execPath,                   // ตัว node ปัจจุบัน
        [nextCli, 'dev', '-p', String(tryPort)],
        {
          cwd: APP_ROOT,
          stdio: 'ignore',                 // กัน spawn EINVAL
          windowsHide: true,
          shell: false
        }
      );

      const baseUrl = `http://localhost:${tryPort}`;

      // รอ health ก่อน ถ้าไม่มี health จะ fallback ไปเช็คหน้า /
      try {
        await waitFor(`${baseUrl}${HEALTH_PATH}`, 180_000);
      } catch {
        await waitFor(baseUrl, 180_000);
      }
      return baseUrl;
    } catch (e) {
      // ลองพอร์ตถัดไป
      continue;
    }
  }

  // fallback สุดท้าย (npm run dev)
  try {
    if (devProcess && !devProcess.killed) { try { devProcess.kill(); } catch {} }
    devProcess = spawn(
      'npm',
      ['run', 'dev', '--', '-p', String(BASE_PORT)],
      {
        cwd: process.cwd(),
        stdio: 'ignore',
        windowsHide: true,
        shell: true
      }
    );
    const baseUrl = `http://localhost:${BASE_PORT}`;
    try {
      await waitFor(`${baseUrl}${HEALTH_PATH}`, 180_000);
    } catch {
      await waitFor(baseUrl, 180_000);
    }
    return baseUrl;
  } catch (err) {
    throw new Error(`Failed to start Next dev server: ${err?.message || err}`);
  }
}

// ---------------------- Packaged: start standalone ----------------------
async function startNextServerIfPackaged() {
  // รองรับทั้งกรณี asarUnpack (แนะนำ) และรันจากใน asar
  const unpackedStandalone = path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone');
  const asarStandalone = path.join(process.resourcesPath, 'app.asar', '.next', 'standalone');

  const standaloneDir = fs.existsSync(unpackedStandalone)
    ? unpackedStandalone
    : asarStandalone;

  const serverJs = path.join(standaloneDir, 'server.js');

  if (!fs.existsSync(serverJs)) {
    throw new Error(`Cannot find Next standalone server at: ${serverJs}
Make sure:
  - next.config.mjs has:  output: 'standalone'
  - package.json build.files includes ".next/standalone/**" and ".next/static/**"
  - If using asar: true, add "asarUnpack": [".next/standalone/**"]`);
  }

  // fork server.js
  serverProcess = fork(serverJs, [], {
    cwd: standaloneDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(BASE_PORT) },
    stdio: 'ignore',
    windowsHide: true
  });

  const baseUrl = `http://localhost:${BASE_PORT}`;
  try {
    await waitFor(`${baseUrl}${HEALTH_PATH}`, 120_000);
  } catch {
    await waitFor(baseUrl, 120_000);
  }
  return baseUrl;
}

// ---------------------- Windows/Process Safety ----------------------
function cleanupProcesses() {
  try { if (serverProcess && !serverProcess.killed) serverProcess.kill(); } catch {}
  try { if (devProcess && !devProcess.killed) devProcess.kill(); } catch {}
}

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
  dialog.showErrorBox('Startup error', String(err?.stack || err));
  cleanupProcesses();
  app.quit();
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  dialog.showErrorBox('Uncaught error', String(err?.stack || err));
  cleanupProcesses();
  app.quit();
});

// ---------------------- Create Windows ----------------------
function createMainWindow(baseUrl) {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true
    }
  });

  mainWin.loadURL(baseUrl); // "/" route
  mainWin.on('closed', () => (mainWin = null));
}

function createDisplayWindow(baseUrl) {
  const displays = screen.getAllDisplays();
  const ext = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0);

  const opts = {
    width: ext ? ext.size.width : 1280,
    height: ext ? ext.size.height : 720,
    x: ext ? ext.bounds.x : undefined,
    y: ext ? ext.bounds.y : undefined,
    show: true,
    autoHideMenuBar: true,
    fullscreen: !!ext,
    kiosk: !!ext,            // โหมดคีออสสำหรับหน้าจอแสดงคิว
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true
    }
  };

  displayWin = new BrowserWindow(opts);
  displayWin.setMenuBarVisibility(false);
  displayWin.loadURL(`${baseUrl}/display`);
  displayWin.on('closed', () => (displayWin = null));
}

// ---------------------- App Lifecycle ----------------------
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
    try {
      Menu.setApplicationMenu(null);

      let baseUrl;
      if (IS_DEV) {
        // Dev: ถ้า next dev ยังไม่พร้อม จะสตาร์ทให้ แล้วรอจนพร้อม
        baseUrl = await ensureDevServer();
      } else {
        // Packaged: fork .next/standalone/server.js แล้วรอจนพร้อม
        baseUrl = await startNextServerIfPackaged();
      }

      createMainWindow(baseUrl);
      createDisplayWindow(baseUrl);

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          const url = (await findReadyBaseUrl()) || baseUrl;
          createMainWindow(url);
          createDisplayWindow(url);
        }
      });
    } catch (err) {
      dialog.showErrorBox('Startup failed', String(err?.stack || err));
      cleanupProcesses();
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    cleanupProcesses();
    if (process.platform !== 'darwin') app.quit();
  });
}
