// electron-main.js
const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const http = require('http')

const isDev = !app.isPackaged

function createWindow (loadUrl) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'), // ถ้าไม่มี ให้สร้างไฟล์ preload ตามด้านล่าง
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(loadUrl)
  if (isDev) win.webContents.openDevTools()
}

async function startNextInProc() {
  // รัน Next ในโปรเซสเดียว (prod)
  const next = require('next')
  const nextApp = next({ dev: false, dir: path.join(__dirname) }) // __dirname คือรากโปรเจกต์เมื่อ pack แล้ว
  const handle = nextApp.getRequestHandler()
  await nextApp.prepare()
  const server = http.createServer((req, res) => handle(req, res))
  return new Promise((resolve) => {
    server.listen(3000, '127.0.0.1', () => resolve(server))
  })
}

app.setAppUserModelId('com.pharmacy.queue')
ipcMain.handle('ping', () => 'pong from main')

app.whenReady().then(async () => {
  if (isDev && process.env.NEXT_DEV_SERVER_URL) {
    // DEV: ใช้ next dev ที่พอร์ต 3000
    createWindow(process.env.NEXT_DEV_SERVER_URL)
  } else {
    // PROD: ใช้ .next ที่ build แล้ว
    await startNextInProc()
    createWindow('http://127.0.0.1:3000')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const url = isDev && process.env.NEXT_DEV_SERVER_URL
        ? process.env.NEXT_DEV_SERVER_URL
        : 'http://127.0.0.1:3000'
      createWindow(url)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
