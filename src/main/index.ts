import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import path from 'path'
import Store from 'electron-store'

const store = new Store({
  defaults: {
    serverUrl: 'http://127.0.0.1:9876',
    pollingInterval: 5000,
    containerPollingInterval: 10000,
    imagePollingInterval: 60000,
    logPollingInterval: 3000,
    theme: 'dark',
    sidebarCollapsed: false,
    windowBounds: { width: 1400, height: 900 },
  },
})

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const bounds = store.get('windowBounds') as { width: number; height: number }

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Load from Vite dev server or built files
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize()
      store.set('windowBounds', { width, height })
    }
  })

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC handlers for settings
ipcMain.handle('get-settings', () => {
  return store.store
})

ipcMain.handle('get-setting', (_event, key: string) => {
  return store.get(key)
})

ipcMain.handle('set-setting', (_event, key: string, value: unknown) => {
  store.set(key, value)
  return true
})

ipcMain.handle('get-version', () => {
  return app.getVersion()
})

app.whenReady().then(() => {
  // Allow renderer to fetch from the local API server without CORS issues
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://127.0.0.1:*/*', 'http://localhost:*/*'] },
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, Origin: '' } })
    },
  )
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['http://127.0.0.1:*/*', 'http://localhost:*/*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET, POST, OPTIONS'],
          'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
        },
      })
    },
  )
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
