import { app, BrowserWindow, ipcMain, shell, session, Menu } from 'electron'
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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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

  // Toggle DevTools with Ctrl+Shift+I in any build
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools()
    }
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
    { urls: ['http://*/*'] },
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, Origin: '' } })
    },
  )
  // CORS proxy + CSP — merged into a single handler (Electron only allows one)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isApiRequest = details.url.startsWith('http://')
    const headers = { ...details.responseHeaders }

    // Inject CORS headers for API requests
    if (isApiRequest) {
      headers['Access-Control-Allow-Origin'] = ['*']
      headers['Access-Control-Allow-Methods'] = ['GET, POST, DELETE, OPTIONS']
      headers['Access-Control-Allow-Headers'] = ['Content-Type, Authorization']
    }

    // Content Security Policy for all responses
    headers['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://* ws://* https://* wss://*; font-src 'self' data:; frame-ancestors 'none'",
    ]

    callback({ responseHeaders: headers })
  })
  // Remove default menu bar on Windows/Linux; keep minimal menu on macOS
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]))
  } else {
    Menu.setApplicationMenu(null)
  }

  createWindow()
})

app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.removeAllListeners('close')
  }
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
