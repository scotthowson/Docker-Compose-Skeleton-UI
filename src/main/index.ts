import { app, BrowserWindow, ipcMain, shell, session, Menu, protocol, net } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Store from 'electron-store'

// Disable Chromium's Private Network Access preflight checks.
// Without this, requests from the renderer (even from a custom app:// scheme)
// to loopback/private IPs like 127.0.0.1 can be blocked by PNA enforcement
// before any webRequest handler fires.
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
)

// ---------------------------------------------------------------------------
// Custom app:// protocol — MUST be registered before app.ready
// ---------------------------------------------------------------------------
// In packaged builds, Electron loads the renderer from file:// which gives
// the page an opaque "null" origin.  Chromium's Private Network Access
// (CORS-RFC1918) blocks fetch() from null origins to loopback/private IPs
// like 127.0.0.1 — BEFORE any webRequest handler can intercept.  This is
// why the CORS proxy alone is not enough for packaged builds.
//
// Registering a custom scheme with `standard: true` + `secure: true` gives
// the renderer a real origin (app://renderer) that Chromium treats like
// https://, allowing normal CORS negotiation with the API server.
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,        // RFC 3986 URI syntax — relative paths work
      secure: true,          // Treated like https:// — no mixed-content blocks
      supportFetchAPI: true, // fetch() works from this origin
      corsEnabled: true,     // Participates in standard CORS negotiation
      stream: true,          // Supports streaming responses
    },
  },
])

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
    // Use custom app:// protocol instead of file:// to get a real origin
    mainWindow.loadURL('app://renderer/index.html')
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

// Proxy an HTTP GET through the main process using Electron's net module.
// This bypasses ALL renderer security policies (CORS, CSP, Private Network
// Access) because net.fetch runs in the main process, not the browser sandbox.
ipcMain.handle('net-fetch-json', async (_event, url: string) => {
  try {
    const response = await net.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return { ok: false, status: response.status, data: null }
    }
    const data = await response.json()
    return { ok: true, status: response.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
})

app.whenReady().then(() => {
  // -------------------------------------------------------------------------
  // app:// protocol handler — serves renderer files from dist/renderer/
  // -------------------------------------------------------------------------
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    // url.pathname is e.g. "/index.html" or "/assets/index-abc123.js"
    const filePath = path.join(__dirname, '..', 'renderer', decodeURIComponent(url.pathname))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // -------------------------------------------------------------------------
  // CORS proxy — allow renderer to fetch from the local API server
  // -------------------------------------------------------------------------
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*'] },
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, Origin: '' } })
    },
  )

  // CORS headers + Private Network Access + CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isApiRequest = details.url.startsWith('http://')
    const headers = { ...details.responseHeaders }

    if (isApiRequest) {
      // Standard CORS headers
      headers['Access-Control-Allow-Origin'] = ['*']
      headers['Access-Control-Allow-Methods'] = ['GET, POST, DELETE, OPTIONS']
      headers['Access-Control-Allow-Headers'] = ['Content-Type, Authorization']
      // Private Network Access (CORS-RFC1918) — required for requests to
      // loopback/private IPs from non-localhost origins
      headers['Access-Control-Allow-Private-Network'] = ['true']
    }

    // Content Security Policy
    headers['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://*:* ws://*:* https://*:* wss://*:*; font-src 'self' data:; frame-ancestors 'none'",
    ]

    callback({ responseHeaders: headers })
  })

  // -------------------------------------------------------------------------
  // Menu
  // -------------------------------------------------------------------------
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
