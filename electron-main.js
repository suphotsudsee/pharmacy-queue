const { app, BrowserWindow, shell, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const http = require('http')
const net = require('net')

const isDev = !app.isPackaged

function createWindow(loadUrl) {
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }

  const preload = path.join(__dirname, 'electron', 'preload.js')
  if (fs.existsSync(preload)) {
    webPreferences.preload = preload
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(loadUrl)
  if (isDev) win.webContents.openDevTools()
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function waitForServer(port, timeoutMs = 30000) {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume()
        resolve()
      })

      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Next server did not start on port ${port}`))
          return
        }
        setTimeout(check, 300)
      })
    }

    check()
  })
}

async function startNextStandalone() {
  const port = await getFreePort()

  process.env.PORT = String(port)
  process.env.HOSTNAME = '0.0.0.0'
  process.env.NODE_ENV = 'production'

  require(path.join(__dirname, '.next', 'standalone', 'server.js'))
  await waitForServer(port)

  return `http://127.0.0.1:${port}`
}

app.setAppUserModelId('com.pharmacy.queue')
ipcMain.handle('ping', () => 'pong from main')

app.whenReady().then(async () => {
  if (isDev && process.env.NEXT_DEV_SERVER_URL) {
    createWindow(process.env.NEXT_DEV_SERVER_URL)
  } else {
    const url = await startNextStandalone()
    createWindow(url)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const url = isDev && process.env.NEXT_DEV_SERVER_URL
        ? process.env.NEXT_DEV_SERVER_URL
        : `http://127.0.0.1:${process.env.PORT || 3000}`
      createWindow(url)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
