<p align="center">
  <img src="https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 33" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Android-APK-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Android APK" />
</p>

# Docker Compose Skeleton UI

A premium desktop and mobile application for managing [Docker Compose Skeleton](https://github.com/scotthowson/Docker-Compose-Skeleton) servers. Dark glassmorphism design, 30+ pages, real-time monitoring, and full server administration — built with Electron, React, and Tailwind CSS.

> **Platforms:** Linux (AppImage, .deb, .rpm) &bull; macOS (.dmg) &bull; Windows (NSIS) &bull; Android (APK via Capacitor)

---

## Quick Start

```bash
git clone https://github.com/scotthowson/Docker-Compose-Skeleton-UI.git
cd Docker-Compose-Skeleton-UI
npm install

# Desktop — Electron + Vite HMR
npm run dev:electron

# Browser only — Vite dev server at localhost:5173
npm run dev

# Production build
npm run build
```

**Requirements:** Node.js 20+, npm, and a running [Docker Compose Skeleton](https://github.com/scotthowson/Docker-Compose-Skeleton) instance with `API_ENABLED=true`.

---

## Feature Highlights

### Setup Wizard

5-step guided first-run configuration that activates automatically on uninitialized servers.

| Step | What it does |
|------|-------------|
| **1. Connect** | Enter server URL, auto-detect hostname, Docker/Compose versions, PUID/PGID, Docker availability |
| **2. Admin Account** | Create admin credentials with password strength meter, server + local auth registration |
| **3. Server Config** | Pre-populated timezone, domain, data directory, permissions. Collapsible advanced sections for Notifications, Startup & Health, and Backup settings |
| **4. Stack Categories** | Choose, rename, reorder, add, or remove stack categories |
| **5. Review & Apply** | Grouped summary by category, one-click write to server `.env`, auto-login to Dashboard |

- **Pre-flight validation** — detects already-configured servers and blocks duplicate setup
- **Docker status indicator** — green/red availability check in system info
- **Scrollable layout** — content-aware scrolling for long configuration forms
- **Welcome toast** — "Your server is configured and ready" on first Dashboard load

### Dashboard

Live overview with configurable polling intervals.

- **Overview cards** — container counts, stack status, health summary
- **Resource charts** — real-time memory and load visualization (Recharts)
- **Disk monitor** — mounted filesystems with custom labels, usage bars, and custom locations
- **Container overview** — top containers by status, uptime, restart count
- **Recent events** — live Docker event feed (collapsible)
- **Quick actions** — 9-tile navigation grid (collapsible)
- **Server info** — hostname, Docker version, API version
- **Disconnected hero** — animated illustration with reconnect button and exponential backoff

### Stack Management

- Start, stop, restart, update stacks with confirmation modals
- **Annotations** — custom labels, priority levels (critical/high/normal/low), notes per stack
- **Create & delete** stacks with full-screen glass overlays (React portals, escape key, backdrop blur)
- **Batch operations** — multi-select with floating action bar for Start/Stop/Restart/Update Selected
- **Progress overlay** — per-stack result cards showing success/failure during batch operations

### Compose Editor

- **Full editor** with edit mode, save, and discard
- **Validation** — runs `docker compose config` to check syntax before saving
- **Safe saves** — creates `.bak` backup before writing changes
- **LCS-based diff view** — side-by-side comparison with green/red highlighting
- **Stack .env tab** — view and edit per-stack environment variables alongside the compose file
- **Syntax highlighting** — YAML-aware color coding
- **In-file search** — find text within the compose file

### Template Gallery

- Browse, deploy, create, and edit templates with a polished modal workflow
- **Boolean env var toggles** — detected automatically from defaults, rendered as toggle switches
- **Text inputs** for non-boolean variables with labels, required badges, and placeholders
- **Dry-run preview** — preview services, port conflicts, environment additions before deploying
- **Port conflict detection** — detailed conflict breakdown with host port, container, and conflicting service
- **Auto-start toggle** — optionally start the stack immediately after deployment
- **Compose preview** — collapsible YAML preview of what will be written

### Container Management

- Full container list with sorting, search, status filtering
- Container detail view with stats (CPU, memory, network I/O, PIDs)
- Container logs viewer
- Start/stop/restart individual containers
- **Batch operations** — multi-select with floating action bar and per-container result cards

### Diagnostics & Factory Reset

- Container health table and status breakdown
- **Server Control** — Start All, Stop All, Restart All stacks, Maintenance Mode toggle
- **Resource gauges** — CPU, memory, disk with animated SVG arcs
- **Factory Reset** — dedicated `/auth/factory-reset` endpoint with:
  - App-only reset (clears local data, preserves server config)
  - Full reset (wipes server auth state + local data, returns to Setup Wizard)
  - **Compose reset toggle** — optionally restore all `docker-compose.yml` to git defaults
  - **5-second countdown** — confirmation timer prevents accidental resets
  - **Server URL preservation** — maintains connection after reset for seamless redirect to Setup Wizard

### Monitoring & Analysis

| Page | Capabilities |
|------|-------------|
| **Health** | Aggregate status, per-container breakdown, color-coded badges |
| **Networks** | List, detail, create/delete, subnet/gateway/container IPs |
| **Volumes** | Search, sort, size analysis, delete with confirmation |
| **Images** | Repository/tag/size/age, staleness indicators, batch prune |
| **Updates** | Image freshness checker with current vs latest tag comparison |
| **Uptime** | Uptime monitoring and availability tracking |
| **Trends** | Resource usage history with interactive charts |
| **Topology** | Network topology visualization with container relationships |
| **Disk Analysis** | Per-stack disk usage breakdown |

### Server Administration

| Page | Capabilities |
|------|-------------|
| **Environment** | Root `.env` editor, raw mode, per-stack selector, validation, duplicate detection |
| **Config** | Runtime profile, feature flags, display, log formatting, API, NTFY, security |
| **Maintenance** | System report, orphan detection, disk analysis, safe/image/deep prune, log rotate |
| **Backup** | Status polling, trigger full/per-stack backup, archive list, restore with confirmation |
| **Logs** | Live viewer, server-side filtering, statistics panel, archive browser, export |
| **Terminal** | Remote terminal access with authentication |
| **Cron Jobs** | View user and system crontabs, add/remove entries, raw editor |
| **File Browser** | Navigate server filesystem, view files |

### Users & Security

- **PBKDF2 key derivation** — 100k iterations, random 128-bit salt, Web Crypto API
- **Admin setup** — first-run account creation via Setup Wizard
- **Login** — remember-me, 4-hour sessions, rate limiting (5 attempts)
- **Invite system** — generate invite codes, track usage, revoke
- **Auto-lock** — configurable inactivity timer (5/15/30/60/120 min)
- **User management** — admin panel for all registered users

### Settings & Personalization

- **Profile** — display name, email, avatar (file upload or URL), bio, status emoji + text, timezone, accent color (8 colors)
- **Connection** — server URL with test connection button
- **Appearance** — dark/light theme, background image, project name & subtitle branding
- **Polling intervals** — configurable per data type
- **Disk labels** — rename detected drives, add custom mount locations
- **Export/Import** — backup all settings + profile to JSON, restore on any device
- **Auto-lock** — inactivity timer
- **Notifications** — desktop notification toggle
- **Session info** — status, expiry countdown, token preview
- **Security** — change password, delete account
- **Custom CSS** — inject your own styles
- **About** — version info, keyboard shortcut reference

### Notifications

- **NTFY integration** — create notification rules for system events
- **Rule management** — add, toggle, delete rules with event type filtering
- **Test notifications** — send test pushes to verify configuration
- **History** — view past notifications with timestamps

### Automations

- Create automation rules triggered by system events
- Configurable actions and conditions
- Enable/disable individual automations

### Bookmarks

- Pin pages, stacks, containers, or custom references
- 8 color options, search, filter by type or pinned status
- Click to navigate directly

---

## Navigation

### Command Palette

`Ctrl+K` / `Cmd+K` — global spotlight search across all pages, stacks, and actions.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1`–`9` | Navigate to page by position |
| `Ctrl+0` | Settings |
| `Ctrl+K` | Command palette |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+D` | Toggle dark/light theme |
| `Ctrl+R` | Refresh all data |
| `Ctrl+/` or `?` | Keyboard shortcuts overlay |

---

## Design System

Built on a **dark glassmorphism** foundation with full light mode support.

- **Glass components** — `.glass`, `.glass-subtle`, `.glass-card`, `.glass-hover` with 3 depth levels
- **Accent palette** — emerald (primary), cyan (info), amber (warning), rose (danger), violet (secondary)
- **Animations** — floating orbs, gradient rotation, morphing blobs, shimmer skeletons, stagger children, pulse glow, neon text
- **Micro-interactions** — `press` active feedback, hover transforms, staggered entrance animations
- **Toggle switches** — unified `h-6 w-11` / `h-5 w-9` pattern with smooth `translate-x` transitions
- **Icons** — exclusively Lucide React
- **Responsive** — mobile-first grids, `flex-wrap` controls, touch-optimized targets (36px+), safe area insets
- **Modals** — `createPortal` to document.body, escapes CSS transform stacking contexts, `z-[9999]`, backdrop blur

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 |
| Mobile | Capacitor (Android APK) |
| UI framework | React 18 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 5 (14 stores) |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Language | TypeScript 5 |
| Settings persistence | electron-store 8 / localStorage fallback |
| Overlay system | React Portals |

---

## Project Structure

```
src/
  main/                    # Electron main process
    index.ts               #   App lifecycle, window creation, CORS proxy
    preload.ts             #   contextBridge IPC exposure
    store.ts               #   electron-store persistence
  renderer/                # React SPA
    api/
      client.ts            #   Fetch wrapper, auth headers, retry logic
      endpoints.ts         #   ~80 typed API endpoint functions
    hooks/                 #   usePolling, useConnection, useApi
    stores/                #   14 Zustand stores (auth, settings, connection, stacks, ...)
    components/
      common/              #   Modal, Toast, ErrorBoundary, DisconnectedBanner
      dashboard/           #   OverviewCards, ResourceChart, DiskMonitor, ...
      containers/          #   ContainerRow, ContainerDetail
      stacks/              #   StackCard, ComposeViewer, CreateStack, EditStack
      images/              #   ImageCard
      layout/              #   Sidebar, Header, StatusBar
      settings/            #   ConnectionForm, AppSettings, ProfileCustomization
      CommandPalette.tsx   #   Ctrl+K spotlight search
      KeyboardShortcuts.tsx#   Ctrl+/ overlay
      NotificationDrawer.tsx
    pages/                 #   30+ page components
      SetupWizard.tsx      #     5-step first-run wizard with collapsible advanced config
      Dashboard.tsx        #     Live overview, charts, quick actions
      Stacks.tsx           #     Stack management with batch operations
      Containers.tsx       #     Container management with batch operations
      Templates.tsx        #     Template gallery with boolean toggles & dry-run preview
      Images.tsx           #     Image tracking with staleness indicators
      Networks.tsx         #     Network management
      Volumes.tsx          #     Volume management with search & sort
      Health.tsx           #     Health monitoring
      Diagnostics.tsx      #     Resource gauges, server control, factory reset
      Logs.tsx             #     Log viewer with filtering & statistics
      Config.tsx           #     Server configuration editor
      Environment.tsx      #     Root and stack .env editor
      Backup.tsx           #     Backup/restore with archive browser
      Maintenance.tsx      #     System report, orphan detection, prune actions
      Settings.tsx         #     Profile, appearance, export/import, security
      Login.tsx            #     Authentication with invite registration
      Users.tsx            #     User management and invite codes
      Notifications.tsx    #     NTFY notification center
      Automations.tsx      #     Automation rules
      Terminal.tsx         #     Remote terminal
      CronJobs.tsx         #     Cron job viewer/editor
      FileBrowser.tsx      #     Server file browser
      DiskAnalysis.tsx     #     Disk usage analysis
      Topology.tsx         #     Network topology
      Trends.tsx           #     Resource trends
      Uptime.tsx           #     Uptime monitoring
      Updates.tsx          #     Image update checker
      Snapshots.tsx        #     Container snapshots
      Bookmarks.tsx        #     Pinned navigation
      Activity.tsx         #     Activity feed
      System.tsx           #     System information
  shared/
    types.ts               #   TypeScript interfaces for all API responses
```

---

## API Compatibility

Connects to the Docker Compose Skeleton REST API (default `http://127.0.0.1:9876`). All ~80 endpoints are typed and wrapped:

```
/setup    /status    /health     /stacks      /containers   /images
/networks /volumes   /logs       /events      /config       /system
/version  /disks     /env        /maintenance  /backup      /auth
/terminal /batch     /templates  /cron        /files        /notifications
```

Server-side filtering via query parameters. Background operations (backup, restore) use status polling. Factory reset uses a dedicated admin-only endpoint.

---

## Building

```bash
# Full production build + electron-builder packaging
npm run build

# Build just the renderer
npm run build:renderer

# Build main process + launch Electron
npm run electron
```

| Platform | Format |
|----------|--------|
| Linux | AppImage, .deb, .rpm |
| macOS | .dmg |
| Windows | NSIS installer |
| Android | APK (via Capacitor) |

---

## License

MIT
