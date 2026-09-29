import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installClipboardFallback } from './lib/clipboard'
import { DcsMantineProvider } from './lib/mantine'

// a dashboard opened over plain http (a LAN address) has no navigator.clipboard: give Copy buttons a working one
installClipboardFallback()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DcsMantineProvider>
      <App />
    </DcsMantineProvider>
  </React.StrictMode>,
)
