import { app, BrowserWindow, ipcMain, shell, session, Menu } from 'electron'
import path from 'path'
import http from 'http'
import Store from 'electron-store'

// Disable Chromium's Private Network Access preflight checks so the renderer
// can fetch() to local/private IPs without CORS preflight blocking.
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights',
)

// ---------------------------------------------------------------------------
// Plain Node.js HTTP GET — completely bypasses Chromium's networking stack.
// No CORS, no CSP, no PNA, no webRequest handlers.  Just a raw TCP request.
// ---------------------------------------------------------------------------
function httpGetJson(url: string, timeoutMs = 5000): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => {
          const status = res.statusCode || 0
          const ok = status >= 200 && status < 300
          try {
            const data = JSON.parse(body)
            resolve({ ok, status, data })
          } catch {
            resolve({ ok, status, data: null, error: 'Invalid JSON' })
          }
        })
      })
      req.on('error', (err: Error) => {
        resolve({ ok: false, status: 0, data: null, error: err.message })
      })
      req.on('timeout', () => {
        req.destroy()
        resolve({ ok: false, status: 0, data: null, error: 'Timeout' })
      })
    } catch (err) {
      resolve({ ok: false, status: 0, data: null, error: String(err) })
    }
  })
}

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

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize()
      store.set('windowBounds', { width, height })
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle('get-settings', () => store.store)
ipcMain.handle('get-setting', (_event, key: string) => store.get(key))
ipcMain.handle('set-setting', (_event, key: string, value: unknown) => {
  if (value === undefined || value === null) {
    store.delete(key)
  } else {
    store.set(key, value)
  }
  return true
})
ipcMain.handle('get-version', () => app.getVersion())

// Combined server check: tests connectivity AND setup status in one call.
// Uses Node.js http module (NOT Chromium net.fetch) — zero browser security
// policies apply.  Returns everything the renderer needs in a single IPC trip.
ipcMain.handle('check-server', async (_event, serverUrl: string) => {
  console.log('[check-server] called with URL:', serverUrl)

  // 1. Test basic connectivity
  const root = await httpGetJson(`${serverUrl}/`)
  console.log('[check-server] root response:', JSON.stringify(root))
  if (!root.ok) {
    const result = { reachable: false, initialized: true, error: root.error || 'unreachable' }
    console.log('[check-server] returning:', JSON.stringify(result))
    return result
  }

  // 2. Check setup status
  const setup = await httpGetJson(`${serverUrl}/setup/status`)
  console.log('[check-server] setup response:', JSON.stringify(setup))
  if (setup.ok && setup.data && typeof setup.data === 'object' && 'initialized' in (setup.data as Record<string, unknown>)) {
    const result = { reachable: true, initialized: !!(setup.data as { initialized: boolean }).initialized }
    console.log('[check-server] returning:', JSON.stringify(result))
    return result
  }

  // Setup endpoint missing or unexpected response — treat as initialized
  const result = { reachable: true, initialized: true }
  console.log('[check-server] returning (fallback):', JSON.stringify(result))
  return result
})

// Generic JSON fetch via Node.js http (for any other IPC callers)
ipcMain.handle('net-fetch-json', async (_event, url: string) => {
  return httpGetJson(url)
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  // CORS proxy for renderer-side fetch (ongoing API calls after login)
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*'] },
    (details, callback) => {
      callback({ requestHeaders: { ...details.requestHeaders, Origin: '' } })
    },
  )

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isApiRequest = details.url.startsWith('http://')
    const headers = { ...details.responseHeaders }

    if (isApiRequest) {
      headers['Access-Control-Allow-Origin'] = ['*']
      headers['Access-Control-Allow-Methods'] = ['GET, POST, DELETE, OPTIONS']
      headers['Access-Control-Allow-Headers'] = ['Content-Type, Authorization']
      headers['Access-Control-Allow-Private-Network'] = ['true']
    }

    headers['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://*:* ws://*:* https://*:* wss://*:*; font-src 'self' data:; frame-ancestors 'none'",
    ]

    callback({ responseHeaders: headers })
  })

  // Menu
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
