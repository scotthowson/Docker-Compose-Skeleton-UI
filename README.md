# Docker Compose Skeleton UI

A premium Electron desktop application for managing [Docker Compose Skeleton](https://github.com/scotthowson/Docker-Compose-Skeleton) servers. Built with React, TypeScript, Tailwind CSS, and a dark glassmorphism design system.

## Features

### First-Run Setup Wizard
- **5-step guided configuration** — Connect, Admin Account, Server Config, Stack Categories, Review & Complete
- **Server connection** — enter server IP, auto-detect system info (hostname, timezone, Docker/Compose versions, PUID/PGID)
- **Admin account creation** — username, password with strength indicator, server + local auth registration
- **Server configuration** — pre-populated timezone, domain, data directory, user/group IDs
- **Stack management** — choose, rename, reorder, add, or remove stack categories with drag-to-reorder
- **Review & apply** — summary cards, one-click configuration write to server `.env`
- Auto-detected when connecting to an uninitialized server (`/setup/status`)

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
- **Create & delete** stacks from the UI with full-screen glass overlays (React portals, escape key, backdrop blur)
- **Batch operations** — multi-select mode with checkboxes and a floating action bar for Start/Stop/Restart/Update Selected, plus "All" quick actions
- **Progress overlay** — per-stack result cards showing success/failure during batch operations

### Compose Editor
- **Full editor** — upgraded from read-only viewer to a complete editor with edit mode
- **Validation** — runs `docker compose config` to check syntax before saving
- **Safe saves** — creates `.bak` backup before writing changes
- **LCS-based diff view** — side-by-side comparison with green/red highlighting for added/removed lines
- **Stack .env tab** — view and edit per-stack environment variables alongside the compose file
- **Syntax highlighting** — YAML-aware colour coding
- **In-file search** — find text within the compose file

### Container Management
- Full container list with sorting, search, and status filtering
- Container detail view with stats (CPU, memory, network I/O, PIDs)
- Container logs viewer
- Start/stop/restart individual containers
- **Batch operations** — multi-select mode with checkboxes and a floating action bar for Start/Stop/Restart, with per-container result cards

### Image Tracking
- Image list with repository, tag, size, age
- **Staleness indicators** — current, aging, stale, unknown
- Sort by age or size

### Health Monitoring
- Aggregate health status (healthy/degraded/critical)
- Per-container health breakdown with state and status
- Color-coded status badges

### Networks
- Network list with driver, scope, connected containers
- Network detail with subnet, gateway, container IPs
- Create and delete networks
- **Networks moved above Health** in sidebar navigation

### Volumes
- **Dedicated Volumes page** — full volume management with summary stats
- Volume table with name, driver, mountpoint, size
- **Search and sort** — filter by name, sort by name or size
- **Size analysis** — total storage, largest volume, driver breakdown
- Delete volumes with confirmation modal
- Color-coded size indicators (amber for large volumes)

### Log Viewer
- Live log viewer with auto-scroll
- **Server-side filtering** by log level and keyword
- **Log statistics panel** — error, warning, and info counts at a glance
- **Archive browser tab** — browse and open rotated log archives
- **Lines dropdown** — configurable line count from 100 to 5000
- **Export** — download logs to a local file

### Maintenance
- **System report** — container, image, volume, and network counts
- **Orphan detection** — identifies orphaned containers, dangling images, and dangling volumes
- **Disk analysis** — per-stack disk usage sizes
- **Actions** — Safe Prune, Image Prune, Deep Prune (confirmation required), Log Rotate

### Environment Variables
- **Root .env editor** — parsed key-value table for the server's root `.env` file
- **Raw editor mode** — toggle between structured table and freeform text editing
- **Stack .env selector** — switch between per-stack `.env` files
- **Variable impact view** — see which settings affect which features
- **Validation** — detects syntax errors and duplicate keys
- **Save with backup** — writes a timestamped backup before overwriting

### Backup & Restore
- **Backup status polling** — idle, running, and error states with animated indicators
- **Trigger backups** — full server backup or per-stack backup
- **Archive list** — browse archives with sizes and dates
- **Restore from archive** — requires typing "RESTORE" to confirm before proceeding

### Diagnostics
- Container health table and status breakdown
- **Server Control Card** — Start All, Stop All, Restart All stacks, and a Maintenance Mode toggle, displayed below the Resource Gauges
- Resource gauges for CPU, memory, disk

### System Information
- Server hostname, kernel, Docker version
- Hardware specs (CPU cores, memory, swap)
- Docker disk usage table (images, containers, volumes, build cache)

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
- **User profile** — display name, email, avatar (file upload or URL), bio, status emoji + text, timezone selector, accent color picker (8 colours)
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
- **Invite code system** — used invites are tracked (not deleted), shows who used each code
- **About** — version info

### Bookmarks
- Pin favourite pages, stacks, containers, or custom references
- 8 colour options, search, filter by type or pinned status
- Click to navigate directly

### Authentication
- **PBKDF2 key derivation** (100k iterations, random 128-bit salt, Web Crypto API)
- Initial setup flow with account creation
- Login with remember-me (4 hour sessions)
- **Invite code registration** — new users can register with an invite code from the login screen
- Auto-lock after configurable inactivity
- **Invite code system** — used invites tracked instead of deleted, shows who used each code

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
| `Ctrl+/` or `?` | Keyboard shortcuts overlay |

### UI & Design
- **Glassmorphism design system** — multi-depth glass effects, gradient borders, neon glow utilities
- **Full-screen glass overlays** for creating and editing stacks — built with React portals, escape key to close, backdrop blur
- **Animated dashboard counters** — numbers smoothly count up with 60fps ease-out animation
- **Premium CSS animations** — floating orbs, gradient rotation, morphing blobs, shimmer skeletons, stagger children, pulse glow effects
- **Keyboard shortcuts overlay** — press `?` or `Ctrl+/` to see all shortcuts in a beautiful panel
- **CPU usage bar** in the status bar footer alongside RAM
- **Networks above Health** in sidebar navigation order
- **Profile customization** — status emoji + text, timezone selector, accent colour picker (8 colours)
- **Micro-interactions** — press effects on buttons, hover transforms on cards, staggered entrance animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 |
| UI framework | React 18 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 5 (14 stores) |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Language | TypeScript 5 |
| Settings persistence | electron-store 8 |
| Overlay system | React Portals |

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
    api/                 # HTTP client and ~80 typed endpoint wrappers
      client.ts          # Fetch instance, auth headers, error handling
      endpoints.ts       # Typed functions for all ~80 API endpoints
    hooks/               # usePolling, useConnection, useApi
    stores/              # Zustand stores (14 stores)
      authStore.ts       # Authentication state and session management
      backupStore.ts     # Backup/restore status, archive list, triggers
      configStore.ts     # Server configuration (.env values, feature flags)
      connectionStore.ts # Server connection URL and status
      containerStore.ts  # Container list, stats, actions
      envStore.ts        # Root and per-stack .env editing, validation
      healthStore.ts     # Health status aggregation
      imageStore.ts      # Image list, staleness tracking
      logStore.ts        # Log entries, server-side filtering, statistics
      maintenanceStore.ts# System report, orphans, disk analysis, prune actions
      networkStore.ts    # Network list, details, create/delete
      notificationStore.ts # Desktop notification preferences
      settingsStore.ts   # User settings, appearance, polling intervals
      stackStore.ts      # Stack list, batch operations, annotations
      systemStore.ts     # System info, Docker disk usage
    components/
      common/            # Card, Badge, Button, Modal, Table, Toast, Skeleton, Spinner
      dashboard/         # OverviewCards, HealthSummary, ResourceChart, etc.
      containers/        # ContainerList, ContainerRow, ContainerDetail
      stacks/            # StackList, StackCard, StackDetail, ComposeViewer,
                         # CreateStackOverlay, EditStackOverlay
      images/            # ImageList, ImageCard
      layout/            # Sidebar, Header, StatusBar (with CPU bar)
      settings/          # ConnectionForm, AppSettings, ProfileCustomization
      CommandPalette.tsx  # Global Ctrl+K search
      KeyboardShortcuts.tsx # Ctrl+/ or ? overlay
      NotificationDrawer.tsx
    pages/               # 30+ pages
      SetupWizard.tsx    # 5-step first-run configuration wizard
      Dashboard.tsx      # Live overview, charts, quick actions
      Stacks.tsx         # Stack list with batch operations
      Containers.tsx     # Container list with batch operations
      Images.tsx         # Image tracking with staleness
      Networks.tsx       # Network management
      Volumes.tsx        # Volume management with search, sort, delete
      Health.tsx         # Health monitoring
      Logs.tsx           # Log viewer with server-side filtering and statistics
      System.tsx         # System information
      Config.tsx         # Server configuration editor
      Diagnostics.tsx    # Resource gauges, server control card
      Maintenance.tsx    # System report, orphan detection, disk analysis, prune actions
      Environment.tsx    # Root and stack .env editor with validation
      Backup.tsx         # Backup/restore with status polling and archive browser
      Settings.tsx       # User profile, appearance, connection, security
      Bookmarks.tsx      # Pinned pages, stacks, containers
      Login.tsx          # Authentication with invite code registration
      Users.tsx          # User management and invite codes
      Activity.tsx       # Activity feed
      Uptime.tsx         # Uptime monitoring
      Templates.tsx      # Template browser and deployment
      Automations.tsx    # Automation rules and triggers
      Topology.tsx       # Network topology visualization
      Trends.tsx         # Resource usage trends and history
      FileBrowser.tsx    # Server file browser
      DiskAnalysis.tsx   # Disk usage analysis
      Terminal.tsx       # Remote terminal access
      CronJobs.tsx       # Cron job viewer
      Snapshots.tsx      # Container snapshots
      Notifications.tsx  # Notification center
      Updates.tsx        # Image update checker
  shared/
    types.ts             # TypeScript interfaces for all API responses
```

## API Compatibility

Connects to the Docker Compose Skeleton REST API (default `http://127.0.0.1:9876`). All ~80 endpoints are supported across status, health, stacks, containers, images, networks, volumes, logs, events, config, system, environment, maintenance, backup, and setup domains:

`/setup` `/status` `/health` `/stacks` `/containers` `/images` `/networks` `/volumes` `/logs` `/events` `/config` `/system` `/version` `/disks` `/env` `/maintenance` `/backup` `/auth` `/terminal` `/batch` and action endpoints for start/stop/restart/update/create/delete/prune/restore/rename/reorder.

Server-side filtering is supported via query string parameters (e.g., log level, keyword search). Background operations like backup and restore use status polling for progress tracking.

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
- Profile customization (status emoji, timezone, accent colour)

## License

MIT
