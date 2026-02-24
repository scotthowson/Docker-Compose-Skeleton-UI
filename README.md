# Docker Compose Skeleton UI

A premium Electron desktop application for managing [Docker Compose Skeleton](https://github.com/scotthowson/Docker-Compose-Skeleton) servers. Built with React, TypeScript, Tailwind CSS, and a dark glassmorphism design system.

## Features

### Dashboard
- **Live overview** with polling — container counts, stack status, health, resource usage
- **Resource charts** — real-time memory and load visualisation (Recharts)
- **Disk monitor** — mounted filesystems with custom labels, custom locations, and usage bars
- **Container overview** — top containers with status, uptime, restart count
- **Recent events** — live Docker event feed (collapsible)
- **Quick actions** — 9-tile grid for one-click navigation (collapsible)
- **Server info** — hostname, Docker version, API version
- **Disconnected hero** — animated illustration with reconnect button

### Stack Management
- Start, stop, restart, update stacks with confirmation modals
- **Annotations** — custom labels, priority levels (critical/high/normal/low), notes per stack
- **Create & delete** stacks from the UI
- Solid opaque edit overlay for easy annotation editing

### Container Management
- Full container list with sorting, search, and status filtering
- Container detail view with stats (CPU, memory, network I/O, PIDs)
- Container logs viewer
- Start/stop/restart individual containers

### Image Tracking
- Image list with repository, tag, size, age
- **Staleness indicators** — current, aging, stale, unknown
- Sort by age or size

### Health Monitoring
- Aggregate health status (healthy/degraded/critical)
- Per-container health breakdown with state and status
- Color-coded status badges

### Networks & Volumes
- Network list with driver, scope, connected containers
- Network detail with subnet, gateway, container IPs
- Create and delete networks
- Volume list with driver, mountpoint, size
- Delete volumes with confirmation

### Logs
- Live log viewer with auto-scroll
- Search and filter by log level
- Line count indicator

### System Information
- Server hostname, kernel, Docker version
- Hardware specs (CPU cores, memory, swap)
- Docker disk usage table (images, containers, volumes, build cache)
- **Maintenance tools** — system prune and image prune with confirmation

### Server Configuration
- **Environment** — runtime profile, log level, server name, timezone
- **Feature flags** — 6 toggleable framework features
- **Display & Colors** — color theme, color mode, force color, verbose mode, progress bar width
- **Log formatting** — timestamps, milliseconds, date format, level indicators, PID, hostname
- **API server** — enable/disable, port, bind address
- **Push notifications (NTFY)** — URL, topic, priority
- **Security** — config protection status, API whitelist
- All cards are collapsible with localStorage persistence
- Unsaved changes indicator with save/discard

### Settings
- **User profile** — display name, email, avatar (file upload or URL), bio
- **Connection** — server URL with test connection
- **Appearance** — dark/light theme, background image, project name & subtitle branding
- **Polling intervals** — configurable per data type
- **Disk configuration** — rename detected drives, add custom mount locations
- **Keyboard shortcuts** — reference card
- **Auto-lock** — inactivity timer (5/15/30/60/120 min)
- **Notifications** — desktop notification toggle
- **Export/Import** — backup and restore all settings to JSON
- **Session info** — session status, expiry countdown, token preview
- **Security** — change password (PBKDF2), delete account
- **About** — version info

### Bookmarks
- Pin favourite pages, stacks, containers, or custom references
- 8 colour options, search, filter by type or pinned status
- Click to navigate directly

### Authentication
- **PBKDF2 key derivation** (100k iterations, random 128-bit salt, Web Crypto API)
- Initial setup flow with account creation
- Login with remember-me (4 hour sessions)
- Auto-lock after configurable inactivity

### Command Palette
- `Ctrl+K` / `Cmd+K` — global spotlight search
- Navigate to any page, toggle theme/sidebar, refresh, export, sign out
- Stack search with start/stop/restart actions

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+1-9` | Navigate to page by position |
| `Ctrl+0` | Settings |
| `Ctrl+K` | Command palette |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+D` | Toggle dark/light theme |
| `Ctrl+R` | Refresh all data |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 |
| UI framework | React 18 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 5 |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Language | TypeScript 5 |
| Settings persistence | electron-store 8 |

## Prerequisites

- **Node.js 20+** (required for Vite 6 and Web Crypto)
- **npm** or **yarn**
- A running [Docker Compose Skeleton](https://github.com/scotthowson/Docker-Compose-Skeleton) instance with the REST API enabled (`API_ENABLED=true` in `.env`)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/scotthowson/Docker-Compose-Skeleton-UI.git
cd Docker-Compose-Skeleton-UI

# Install dependencies
npm install

# Start development mode (Vite HMR + Electron)
npm run dev:electron

# Or just the renderer in a browser
npm run dev
```

## Building

```bash
# Build for your current platform
npm run build

# Build just the renderer (for testing)
npm run build:renderer
```

Build output goes to the `release/` directory. Supported targets:

| Platform | Format |
|----------|--------|
| Linux | AppImage, .deb, .rpm |
| macOS | .dmg |
| Windows | NSIS installer |

## Project Structure

```
src/
  main/                  # Electron main process
    index.ts             # App lifecycle, window creation
    preload.ts           # contextBridge IPC exposure
    store.ts             # electron-store persistence
  renderer/              # React app
    api/                 # HTTP client and typed endpoint functions
    hooks/               # usePolling, useConnection, useApi
    stores/              # Zustand stores (11 stores)
    components/
      common/            # Card, Badge, Button, Modal, Table, Toast, etc.
      dashboard/         # OverviewCards, HealthSummary, ResourceChart, etc.
      containers/        # ContainerList, ContainerRow, ContainerDetail
      stacks/            # StackList, StackCard, StackDetail
      images/            # ImageList, ImageCard
      layout/            # Sidebar, Header, StatusBar
      settings/          # ConnectionForm, AppSettings
      CommandPalette.tsx  # Global Ctrl+K search
    pages/               # Dashboard, Stacks, Containers, Images, Health,
                         # Networks, Logs, System, Config, Settings, Bookmarks, Login
  shared/
    types.ts             # TypeScript interfaces for all API responses
```

## API Compatibility

Connects to the Docker Compose Skeleton REST API (default `http://127.0.0.1:9876`). All 24+ endpoints are supported:

`/status` `/health` `/stacks` `/containers` `/images` `/networks` `/volumes` `/logs` `/events` `/config` `/system` `/version` `/disks` and action endpoints for start/stop/restart/update/create/delete.

## Configuration

All settings are persisted via `electron-store` (main process) with a `localStorage` fallback (browser dev mode). Settings include:

- Server connection URL
- Polling intervals per data type
- Theme preference
- Sidebar state
- Disk labels and custom locations
- Stack annotations
- Auto-lock timer
- Project branding
- Notification preferences

## License

MIT
