# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Docker Compose Skeleton UI is a premium Electron desktop application for managing [Docker Compose Skeleton](https://github.com/scotthowson/Docker-Compose-Skeleton) servers. It connects to the DCS REST API (default `http://127.0.0.1:9876`) and provides live monitoring, stack management, container control, and full server administration through a dark glassmorphism design system.

**Stack:** Electron 33 + React 18 + Vite 6 + Tailwind CSS 3 + Zustand 5 + TypeScript 5

## Build & Dev Commands

```bash
npm run dev              # Vite dev server only (browser at localhost:5173)
npm run dev:electron     # Full Electron dev mode (Vite + esbuild + Electron)
npm run build:main       # Bundle main/preload to dist/main/*.cjs via esbuild
npm run build:renderer   # Vite build to dist/renderer/
npm run build            # Full production build + electron-builder packaging
npm run electron         # Build main process and launch Electron
```

There are no tests, no linter, and no CI pipeline beyond the GitHub Actions build workflow.

## Architecture

### Process Model (Electron)

```
Main Process (src/main/index.ts)
  ├── BrowserWindow with contextIsolation: true
  ├── electron-store for persistent settings (IPC bridge)
  ├── CORS proxy via session.webRequest (allows localhost API calls)
  └── IPC handlers: get-settings, set-setting, get-setting, get-version

Preload (src/main/preload.ts)
  └── contextBridge exposes window.electronAPI (getSettings, setSetting, etc.)

Renderer (src/renderer/)
  ├── React 18 SPA — no React Router, uses currentPage state
  ├── Zustand stores (14 stores) for all state management
  ├── Fetch-based API client with retry logic
  └── Tailwind + custom glassmorphism CSS
```

The main process bundles to CJS (`dist/main/index.cjs`) via esbuild. The renderer builds to `dist/renderer/` via Vite. Both are wired together by electron-builder.

### Navigation / Page Routing

There is no React Router. Navigation is a `currentPage: PageId` state in `settingsStore`. App.tsx maps `PageId` to components via `pageComponents` record. Pages transition with a 150ms opacity fade. Keyboard shortcuts `Ctrl+1-9` map to `pageOrder` array indices.

**To add a new page:**
1. Add to `PageId` union in `src/shared/types.ts`
2. Create `src/renderer/pages/YourPage.tsx` (default export)
3. Import and add to `pageComponents` + `pageOrder` in `App.tsx`
4. Add nav item (with icon) to `navItems` array in `Sidebar.tsx`
5. Add page title to `pageTitles` in `Header.tsx`
6. Add icon + label to `pageIcon`, `pageLabels`, and `pages` array in `CommandPalette.tsx`

### State Management (Zustand)

All stores follow: `export const useXStore = create<State>((set, get) => ({ ... }))`

Key stores to understand:
- **authStore** — PBKDF2 password hashing, session management, rate limiting. Authentication is local-only (no server tokens).
- **settingsStore** — Dual persistence: electron-store IPC or localStorage fallback. Holds currentPage, theme, serverUrl, polling intervals, and all user preferences.
- **connectionStore** — API connection lifecycle with exponential backoff (max 30s, 50 retries), heartbeat monitoring (10s), and tab-visibility-aware reconnection. Pages use `reportPollSuccess/reportPollFailure` to track connection health.

### API Layer

**Client** (`src/renderer/api/client.ts`): Fetch wrapper with 30s timeout, AbortController, max 2 retries on network errors only. Singleton `apiClient` instance. No auth headers — API is open, authentication is client-side only.

**Endpoints** (`src/renderer/api/endpoints.ts`): ~60 typed functions wrapping all REST routes. Every function returns `Promise<TypedResponse>`. To add a new endpoint:
1. Add response type in `src/shared/types.ts`
2. Add typed function in `endpoints.ts`
3. Import the type in the endpoint file's import block

**Connection-aware polling** (`usePolling` / `useApi` hooks): Auto-pauses when tab is hidden, prevents overlapping requests, uses `enabled` flag gated by connection status.

### Settings Persistence

Dual backend: `window.electronAPI?.setSetting()` (electron-store JSON file) or `localStorage['app-settings']` (browser fallback). The `settingsStore.updateSetting()` auto-persists. Profile data is stored separately in `localStorage['user-profile']`.

### Authentication Flow

Local PBKDF2 (100k iterations, random 128-bit salt, Web Crypto API). No server-side auth. Three modes on Login page:
1. Initial setup → Create Admin Account
2. Returning user → Sign In (4-hour sessions, rate-limited to 5 attempts)
3. Invite registration → Register with invite code via `authRegister` API endpoint

Sessions persist in `localStorage['auth-session']`. Auto-lock via configurable inactivity timer.

## Styling Conventions

### Design System

- **Dark mode default** — `bg-slate-950` base, glassmorphism cards with `bg-slate-900/60 backdrop-blur-xl border border-white/[0.06]`
- **Light mode** — `.light` class on `<html>`, CSS overrides in `index.css` using `!important`
- **Glass component classes** — `.glass`, `.glass-subtle`, `.glass-card`, `.glass-hover`, `.glass-1/2/3` (depth levels)
- **Accent colors** — emerald (primary/success), cyan (info), amber (warning), rose (error/danger), violet (secondary)
- **Icons** — exclusively `lucide-react`, imported per-component

### CSS Patterns

Custom animations defined in both `tailwind.config.js` (keyframes) and `src/renderer/index.css` (@layer components). Key classes:
- `animate-fade-in`, `animate-scale-in`, `animate-slide-up` — entrance animations
- `stagger-children` — cascading entrance (60ms delay per child, up to 12)
- `gradient-border`, `gradient-border-animated` — decorative card borders
- `text-gradient`, `text-gradient-warm`, `text-gradient-cool` — gradient text
- `glow-emerald/cyan/rose/amber/violet` — subtle glow effects
- `neon-emerald/cyan/rose/amber` — text shadow glow
- `skeleton` — shimmer loading placeholder
- `press` — active:scale(0.97) click feedback
- `scrollbar-thin`, `scrollbar-none` — custom scrollbar utilities

### Card Pattern

```tsx
<div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-6">
  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Title</h3>
  {/* content */}
</div>
```

### Table Pattern

```tsx
<th className="text-xs text-slate-500 uppercase tracking-wider">Header</th>
<tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
```

### Full-screen Overlay Pattern

Use `createPortal(jsx, document.body)` with `z-[9999]` for overlays that must escape CSS transform containing blocks (the page transition wrapper uses `translate-y-0` which creates a new stacking context for `position: fixed`).

## Key Patterns

### Adding a Toast Notification

```tsx
import { useToast } from '../components/common/Toast'
const { addToast } = useToast()
addToast({ type: 'success', message: 'Done!' })
```

### Connection-Gated Polling

```tsx
const isConnected = useConnectionStore((s) => s.status === 'connected')
const { data, refresh } = usePolling(fetchFn, intervalMs, { enabled: isConnected })
```

### Store-Driven Page Data

Pages poll data via hooks, sync results into stores, and components read from stores:
```tsx
// Page: poll → store
const { data } = useApi(fetchStacks, 5000, { enabled: isConnected })
useEffect(() => { if (data) setStacks(data.stacks) }, [data])

// Component: read store
const stacks = useStackStore((s) => s.stacks)
```

## Backend API Reference

The UI connects to the Docker Compose Skeleton REST API (`api-server.sh`). The backend repo is at `../Docker-Compose-Skeleton/`. Key endpoint groups: `/status`, `/health`, `/stacks`, `/containers`, `/images`, `/networks`, `/volumes`, `/logs`, `/events`, `/config`, `/system`, `/env`, `/maintenance`, `/backups`, `/batch`, `/auth`.

All endpoint types are defined in `src/shared/types.ts` and all fetch wrappers in `src/renderer/api/endpoints.ts`.
