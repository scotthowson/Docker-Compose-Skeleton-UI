// =============================================================================
// Plugins — Extension marketplace with featured plugins, install, and guide
// =============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { PluginCatalogEntry } from '../../shared/types'
import { createPortal } from 'react-dom'
import {
  Puzzle, Plus, Trash2, ToggleLeft, ToggleRight, GitBranch, LayoutTemplate,
  Zap, Package, X, Loader2, AlertCircle, CheckCircle, RefreshCw, Download,
  Shield, Activity, Code, ChevronDown, ChevronRight, FileJson, FolderTree, Terminal,
  BookOpen, ExternalLink, Sparkles, Clock, Eye, Bell, FileCheck, Gauge,
  Archive, Lock, Wifi, FileSearch, Radio, Eraser, Wrench,
  HardDrive, RotateCcw, Timer, Network, Fingerprint, Database, Flame, ScrollText,
} from 'lucide-react'
import { usePluginStore } from '../stores/pluginStore'
import { useConnectionStore } from '../stores/connectionStore'
import { DisconnectedBanner } from '../components/common/DisconnectedBanner'
import { useToast } from '../components/common/Toast'

// ---------------------------------------------------------------------------
// Featured plugins catalog
// ---------------------------------------------------------------------------

interface FeaturedPlugin {
  name: string
  description: string
  author: string
  version: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  url: string
  tags: string[]
  hookCount: number
  templateCount: number
  category?: 'safety' | 'monitoring' | 'operations' | 'advanced' | 'cards'
  /** Built-in feature — always available, toggle controls the feature directly */
  builtIn?: boolean
  /** Root .env variables the hooks read (declared by the plugin) */
  env?: string[]
  /** Installed by the server from its catalogue */
  fromCatalog?: boolean
  /** When provided, plugin is scaffolded locally instead of git-cloned */
  scaffold?: {
    hooks?: Record<string, string>
    cards?: Record<string, { meta: Record<string, unknown>; html: string }>
  }
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  safety: { label: 'Safety & Validation', icon: Shield, color: 'text-cyan-400' },
  monitoring: { label: 'Monitoring & Observability', icon: Activity, color: 'text-violet-400' },
  operations: { label: 'Operations & Maintenance', icon: Wrench, color: 'text-amber-400' },
  advanced: { label: 'Advanced & Security', icon: Lock, color: 'text-rose-400' },
  cards: { label: 'Dashboard Cards', icon: LayoutTemplate, color: 'text-emerald-400' },
}

// Two entries live in the UI: the compose linter (a built-in feature of the
// editors) and the example dashboard cards. Every other plugin comes from the
// server's catalogue (.plugins-catalog/), where the hook scripts are versioned,
// linted and installed by copying — so what you see is exactly what runs.
const SPECIAL_PLUGINS: FeaturedPlugin[] = [
  {
    name: 'compose-linter',
    builtIn: true,
    category: 'safety',
    description: 'Comprehensive compose validation — catches missing restart policies, privileged containers, unbound ports, Docker socket mounts, missing health checks, resource limits, and 18+ security rules before deployment.',
    author: 'DCS Community',
    version: '1.2.0',
    icon: FileCheck,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    url: '',
    tags: ['validation', 'compose', 'safety'],
    hookCount: 1,
    templateCount: 0,
  },
  {
    name: 'example-card',
    category: 'cards',
    description: 'Dashboard widget cards — a live System Clock, animated Server Pulse with CPU/RAM/NET metrics, and a comprehensive CSS Framework Showcase. Add custom widgets to your dashboard.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: LayoutTemplate,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    url: '',
    tags: ['dashboard', 'cards', 'widgets', 'ui'],
    hookCount: 0,
    templateCount: 3,
    scaffold: {
      cards: {
        'system-clock': {
          meta: { name: 'system-clock', title: 'System Clock', description: 'Live date and time', defaultW: 6, defaultH: 4, minW: 4, minH: 3, maxW: 12, maxH: 6 },
          html: `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:transparent;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}.clock{text-align:center}.time{font-size:2.5rem;font-weight:700;letter-spacing:.05em;background:linear-gradient(135deg,#34d399,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.date{font-size:.75rem;color:#64748b;margin-top:.25rem}.seconds{font-size:.875rem;color:#475569;font-variant-numeric:tabular-nums}</style></head><body><div class="clock"><div class="time" id="time">--:--</div><div class="seconds" id="sec">:00</div><div class="date" id="date">Loading...</div></div><script>function u(){const n=new Date();document.getElementById('time').textContent=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:true}).replace(/:\\d{2}\\s/,' ');document.getElementById('sec').textContent=':'+String(n.getSeconds()).padStart(2,'0');document.getElementById('date').textContent=n.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'})}u();setInterval(u,1000)</script></body></html>`,
        },
        'server-pulse': {
          meta: { name: 'server-pulse', title: 'Server Pulse', description: 'Animated CPU/RAM/NET metrics', defaultW: 8, defaultH: 5, minW: 6, minH: 4, maxW: 16, maxH: 8 },
          html: `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:transparent;color:#e2e8f0;padding:1rem;overflow:hidden}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;height:100%}.metric{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:.75rem;padding:.75rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25rem}.label{font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:#64748b;font-weight:600}.value{font-size:1.5rem;font-weight:700;font-variant-numeric:tabular-nums}.bar{width:100%;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden}.fill{height:100%;border-radius:2px;transition:width .8s ease}.cpu .value{color:#34d399}.cpu .fill{background:linear-gradient(90deg,#34d399,#059669)}.ram .value{color:#06b6d4}.ram .fill{background:linear-gradient(90deg,#06b6d4,#0284c7)}.net .value{color:#a78bfa}.net .fill{background:linear-gradient(90deg,#a78bfa,#7c3aed)}</style></head><body><div class="grid"><div class="metric cpu"><span class="label">CPU</span><span class="value" id="cpu">0%</span><div class="bar"><div class="fill" id="cpuBar" style="width:0%"></div></div></div><div class="metric ram"><span class="label">RAM</span><span class="value" id="ram">0%</span><div class="bar"><div class="fill" id="ramBar" style="width:0%"></div></div></div><div class="metric net"><span class="label">NET</span><span class="value" id="net">0ms</span><div class="bar"><div class="fill" id="netBar" style="width:0%"></div></div></div></div><script>function r(min,max){return Math.floor(Math.random()*(max-min+1))+min}function u(){const cpu=r(15,85),ram=r(30,75),net=r(1,45);document.getElementById('cpu').textContent=cpu+'%';document.getElementById('cpuBar').style.width=cpu+'%';document.getElementById('ram').textContent=ram+'%';document.getElementById('ramBar').style.width=ram+'%';document.getElementById('net').textContent=net+'ms';document.getElementById('netBar').style.width=Math.min(net*2,100)+'%'}u();setInterval(u,3000)</script></body></html>`,
        },
        'css-showcase': {
          meta: { name: 'css-showcase', title: 'CSS Showcase', description: 'Complete CSS framework reference for building plugin cards', defaultW: 10, defaultH: 10, minW: 8, minH: 6, maxW: 24, maxH: 16 },
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:transparent;color:#e2e8f0;padding:1.25rem;overflow-y:auto;overflow-x:hidden;line-height:1.5;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}body::-webkit-scrollbar{width:4px}body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}.section-title{font-size:.6rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.12em;margin:1rem 0 .5rem 0;display:flex;align-items:center;gap:.5rem}.section-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.06),transparent)}.section-title:first-child{margin-top:0}.palette{display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:.25rem}.swatch{width:2.25rem;height:2.25rem;border-radius:.625rem;cursor:pointer;transition:transform .2s,box-shadow .2s;position:relative}.swatch:hover{transform:scale(1.2) translateY(-2px);box-shadow:0 8px 20px -4px currentColor}.swatch::after{content:attr(data-label);position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font-size:7px;color:#64748b;white-space:nowrap;opacity:0;transition:opacity .15s}.swatch:hover::after{opacity:1}.pills{display:flex;gap:.375rem;flex-wrap:wrap}.pill{padding:.2rem .625rem;border-radius:9999px;font-size:.6rem;font-weight:600;border:1px solid;transition:transform .15s,filter .15s;cursor:default}.pill:hover{transform:translateY(-1px);filter:brightness(1.2)}.pill-emerald{background:rgba(52,211,153,.12);color:#34d399;border-color:rgba(52,211,153,.2)}.pill-cyan{background:rgba(6,182,212,.12);color:#06b6d4;border-color:rgba(6,182,212,.2)}.pill-violet{background:rgba(167,139,250,.12);color:#a78bfa;border-color:rgba(167,139,250,.2)}.pill-amber{background:rgba(251,191,36,.12);color:#fbbf24;border-color:rgba(251,191,36,.2)}.pill-rose{background:rgba(251,113,133,.12);color:#fb7185;border-color:rgba(251,113,133,.2)}.pill-indigo{background:rgba(129,140,248,.12);color:#818cf8;border-color:rgba(129,140,248,.2)}.pill-solid{background:#34d399;color:#0f172a;border-color:#34d399;font-weight:700}.buttons{display:flex;gap:.375rem;flex-wrap:wrap}.btn{padding:.3rem .75rem;border-radius:.5rem;font-size:.6rem;font-weight:600;border:1px solid;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:.25rem}.btn:hover{transform:translateY(-1px)}.btn-ghost{background:rgba(52,211,153,.1);color:#34d399;border-color:rgba(52,211,153,.2)}.btn-ghost:hover{background:rgba(52,211,153,.2)}.btn-solid{background:#34d399;color:#0f172a;border-color:#34d399}.btn-solid:hover{background:#2dd4a8;box-shadow:0 4px 12px rgba(52,211,153,.3)}.btn-outline{background:transparent;color:#94a3b8;border-color:rgba(255,255,255,.1)}.btn-outline:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.2)}.btn-danger{background:rgba(251,113,133,.1);color:#fb7185;border-color:rgba(251,113,133,.2)}.btn-danger:hover{background:rgba(251,113,133,.2)}.bar-stack{display:flex;gap:3px;height:8px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.03)}.bar-seg{height:100%;border-radius:4px;transition:width 1.5s cubic-bezier(.4,0,.2,1)}.progress-row{display:flex;align-items:center;gap:.5rem;margin-bottom:.375rem}.progress-label{font-size:.55rem;color:#64748b;width:2.5rem;text-align:right}.progress-track{flex:1;height:6px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden}.progress-fill{height:100%;border-radius:3px;transition:width 1s ease}.progress-val{font-size:.55rem;color:#94a3b8;width:2rem;font-variant-numeric:tabular-nums}.cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.glass-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:.75rem;padding:.625rem;transition:all .2s;cursor:default}.glass-card:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);transform:translateY(-1px);box-shadow:0 8px 24px -8px rgba(0,0,0,.3)}.glass-card .card-icon{font-size:1rem;margin-bottom:.25rem}.glass-card .card-title{font-size:.6rem;font-weight:600;color:#e2e8f0}.glass-card .card-value{font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums}.glass-card .card-sub{font-size:.5rem;color:#64748b}.type-row{margin-bottom:.375rem;display:flex;align-items:baseline;gap:.75rem;flex-wrap:wrap}.t-gradient{font-weight:800;font-size:.875rem;background:linear-gradient(135deg,#34d399,#06b6d4,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.t-glow{font-weight:700;font-size:.75rem;color:#34d399;text-shadow:0 0 20px rgba(52,211,153,.5)}.t-mono{font-family:'SF Mono','Fira Code',monospace;font-size:.65rem;color:#06b6d4;background:rgba(6,182,212,.08);padding:.1rem .4rem;border-radius:.25rem}.t-muted{font-size:.65rem;color:#475569}.t-label{font-size:.55rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#64748b}.pulse-container{display:flex;align-items:center;gap:.75rem}.pulse-dot{width:10px;height:10px;border-radius:50%;background:#34d399;position:relative}.pulse-dot::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid #34d399;animation:pulse-ring 2s ease-out infinite}@keyframes pulse-ring{0%{transform:scale(.8);opacity:.8}100%{transform:scale(2);opacity:0}}.toggle{display:flex;align-items:center;gap:.5rem}.toggle-track{width:28px;height:16px;border-radius:8px;background:#334155;position:relative;cursor:pointer;transition:background .2s}.toggle-track.on{background:#34d399}.toggle-thumb{width:12px;height:12px;border-radius:50%;background:white;position:absolute;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}.toggle-track.on .toggle-thumb{transform:translateX(12px)}.toggle-label{font-size:.6rem;color:#94a3b8}.sep{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);margin:.75rem 0}</style></head><body><div class="section-title">Typography</div><div class="type-row"><span class="t-gradient">Gradient Text</span><span class="t-glow">Glow Effect</span><span class="t-mono">monospace</span><span class="t-muted">Muted caption</span><span class="t-label">Label</span></div><div class="section-title">Color Palette</div><div class="palette"><div class="swatch" style="background:#34d399;color:rgba(52,211,153,.4)" data-label="Emerald"></div><div class="swatch" style="background:#06b6d4;color:rgba(6,182,212,.4)" data-label="Cyan"></div><div class="swatch" style="background:#a78bfa;color:rgba(167,139,250,.4)" data-label="Violet"></div><div class="swatch" style="background:#fbbf24;color:rgba(251,191,36,.4)" data-label="Amber"></div><div class="swatch" style="background:#fb7185;color:rgba(251,113,133,.4)" data-label="Rose"></div><div class="swatch" style="background:#f472b6;color:rgba(244,114,182,.4)" data-label="Pink"></div><div class="swatch" style="background:#818cf8;color:rgba(129,140,248,.4)" data-label="Indigo"></div><div class="swatch" style="background:#38bdf8;color:rgba(56,189,248,.4)" data-label="Sky"></div><div class="swatch" style="background:#4ade80;color:rgba(74,222,128,.4)" data-label="Green"></div><div class="swatch" style="background:#f97316;color:rgba(249,115,22,.4)" data-label="Orange"></div></div><div class="section-title">Badges</div><div class="pills"><span class="pill pill-emerald">Success</span><span class="pill pill-cyan">Info</span><span class="pill pill-violet">Feature</span><span class="pill pill-amber">Warning</span><span class="pill pill-rose">Error</span><span class="pill pill-indigo">Update</span><span class="pill pill-solid">Active</span></div><div class="section-title">Buttons</div><div class="buttons"><button class="btn btn-solid">&#9654; Primary</button><button class="btn btn-ghost">&#10010; Ghost</button><button class="btn btn-outline">&#9881; Outline</button><button class="btn btn-danger">&#10005; Danger</button></div><div class="section-title">Progress Bars</div><div class="progress-row"><span class="progress-label">CPU</span><div class="progress-track"><div class="progress-fill" id="cpu-bar" style="width:0%;background:linear-gradient(90deg,#34d399,#059669)"></div></div><span class="progress-val" id="cpu-val">0%</span></div><div class="progress-row"><span class="progress-label">RAM</span><div class="progress-track"><div class="progress-fill" id="ram-bar" style="width:0%;background:linear-gradient(90deg,#06b6d4,#0284c7)"></div></div><span class="progress-val" id="ram-val">0%</span></div><div class="progress-row"><span class="progress-label">Disk</span><div class="progress-track"><div class="progress-fill" id="disk-bar" style="width:0%;background:linear-gradient(90deg,#a78bfa,#7c3aed)"></div></div><span class="progress-val" id="disk-val">0%</span></div><div style="margin-top:.5rem"><div class="bar-stack"><div class="bar-seg" id="seg1" style="width:0%;background:#34d399"></div><div class="bar-seg" id="seg2" style="width:0%;background:#06b6d4"></div><div class="bar-seg" id="seg3" style="width:0%;background:#a78bfa"></div><div class="bar-seg" id="seg4" style="width:0%;background:#fbbf24"></div><div class="bar-seg" id="seg5" style="width:0%;background:#fb7185"></div></div></div><div class="section-title">Glass Cards</div><div class="cards-grid"><div class="glass-card"><div class="card-icon">&#9889;</div><div class="card-title">Uptime</div><div class="card-value" style="color:#34d399" id="uptime">99.9%</div><div class="card-sub">Last 30 days</div></div><div class="glass-card"><div class="card-icon">&#128230;</div><div class="card-title">Containers</div><div class="card-value" style="color:#06b6d4" id="containers">24</div><div class="card-sub">3 stacks</div></div><div class="glass-card"><div class="card-icon">&#128737;</div><div class="card-title">Alerts</div><div class="card-value" style="color:#fbbf24" id="alerts">0</div><div class="card-sub">All clear</div></div></div><div class="section-title">Interactive</div><div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap"><div class="pulse-container"><div class="pulse-dot"></div><span style="font-size:.6rem;color:#34d399;font-weight:600">Live</span></div><div class="toggle" onclick="this.querySelector('.toggle-track').classList.toggle('on')"><div class="toggle-track on"><div class="toggle-thumb"></div></div><span class="toggle-label">Auto-refresh</span></div><div class="toggle" onclick="this.querySelector('.toggle-track').classList.toggle('on')"><div class="toggle-track"><div class="toggle-thumb"></div></div><span class="toggle-label">Dark mode</span></div></div><div class="sep"></div><div style="text-align:center;font-size:.5rem;color:#334155">DCS Plugin Card CSS Framework &middot; Build custom dashboard widgets</div><script>function randomize(){var cpu=Math.floor(Math.random()*60)+20;var ram=Math.floor(Math.random()*40)+35;var disk=Math.floor(Math.random()*30)+40;document.getElementById('cpu-bar').style.width=cpu+'%';document.getElementById('cpu-val').textContent=cpu+'%';document.getElementById('ram-bar').style.width=ram+'%';document.getElementById('ram-val').textContent=ram+'%';document.getElementById('disk-bar').style.width=disk+'%';document.getElementById('disk-val').textContent=disk+'%';var segs=[35,25,20,12,8].map(function(v){return v+Math.floor(Math.random()*6)-3});var total=segs.reduce(function(a,b){return a+b},0);for(var i=0;i<5;i++){document.getElementById('seg'+(i+1)).style.width=((segs[i]/total)*100)+'%'}document.getElementById('uptime').textContent=(99+Math.random()).toFixed(1)+'%';document.getElementById('containers').textContent=Math.floor(Math.random()*30)+10;document.getElementById('alerts').textContent=Math.floor(Math.random()*3)}setTimeout(randomize,300);setInterval(randomize,5000)</script></body></html>`,
        },
      },
    },
  },
]

const CATEGORY_STYLE: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  safety: { icon: Shield, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/20' },
  monitoring: { icon: Activity, color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20' },
  operations: { icon: Wrench, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  advanced: { icon: Lock, color: 'text-rose-400', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/20' },
  cards: { icon: LayoutTemplate, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
}

const PLUGIN_ICONS: Record<string, React.ElementType> = {
  'env-validator': FileSearch,
  'deploy-guard': Shield,
  'auto-backup': Archive,
  'rollback-sentinel': RotateCcw,
  'container-notifier': Bell,
  'resource-monitor': Gauge,
  'uptime-ping': Activity,
  'disk-watchdog': HardDrive,
  'response-timer': Timer,
  'port-guard': Network,
  'cleanup-sweeper': Trash2,
  'crash-responder': RefreshCw,
  'volume-sizer': Database,
  'dependency-checker': GitBranch,
  'network-firewall': Lock
}

/** Display shape for a catalogue entry delivered by the server */
function catalogToDisplay(entry: PluginCatalogEntry): FeaturedPlugin {
  const cat = (entry.category || 'operations') as FeaturedPlugin['category']
  const style = CATEGORY_STYLE[cat || 'operations'] || CATEGORY_STYLE.operations
  return {
    name: entry.name,
    description: entry.description,
    author: entry.author || 'DCS Community',
    version: entry.version,
    icon: PLUGIN_ICONS[entry.name] || style.icon,
    color: style.color,
    bgColor: style.bgColor,
    borderColor: style.borderColor,
    url: '',
    tags: entry.tags || [],
    hookCount: entry.hooks?.length ?? 0,
    templateCount: 0,
    category: cat,
    env: entry.env,
    fromCatalog: true,
  }
}

// ---------------------------------------------------------------------------
// Plugin creation guide content
// ---------------------------------------------------------------------------

const GUIDE_SECTIONS = [
  {
    title: 'Directory Structure',
    icon: FolderTree,
    content: `my-plugin/
├── plugin.json          # Required manifest
├── hooks/               # Lifecycle hook scripts
│   ├── post-deploy      # Runs after stack deploy
│   ├── pre-update       # Runs before stack update
│   ├── post-start       # Runs after stack start
│   └── pre-stop         # Runs before stack stop
└── templates/           # Compose templates
    └── my-service/
        └── docker-compose.yml`,
  },
  {
    title: 'Plugin Manifest',
    icon: FileJson,
    content: `{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What your plugin does",
  "author": "Your Name",
  "enabled": true,
  "hooks": ["post-start"],
  "env": ["NOTIFY_WEBHOOK_URL"],
  "config": { "threshold": 85 }
}
// "env": root .env values the hooks may read
// "config": editable from the UI, passed as DCS_PLUGIN_CONFIG`,
  },
  {
    title: 'Example Hook',
    icon: Terminal,
    content: `#!/bin/bash
# hooks/post-deploy — runs after every deployment
# Receives deployment context as JSON via stdin

CONTEXT=$(cat)
STACK=$(echo "$CONTEXT" | jq -r '.stack // "unknown"')
OK=$(echo "$CONTEXT" | jq -r '.success // true')
[ "\${DCS_DRY_RUN:-false}" = "true" ] && { echo "dry run: skipping side effects"; exit 0; }

if [ "$OK" = "true" ]; then
  echo "✓ $STACK deployed" >> "$PLUGIN_STATE_DIR/log.txt"
else
  curl -s -H "Title: DCS" -d "$STACK deployment failed" "$DCS_NTFY_URL"
fi`,
  },
  {
    title: 'Available Hooks',
    icon: Zap,
    content: `pre-start      Before a stack starts (stack, batch, template auto-start)
post-start     After the start finished — context.success tells the outcome
pre-stop       Before a stack stops
post-stop      After the stop finished
pre-update     Before a stack's images are pulled
post-update    After the update — with changed_images
pre-deploy     Before a template is merged (context.compose = the template;
               dry runs set dry_run: true and show your output in the preview)
post-deploy    After the deployment (and its auto-start) — with success

Context arrives as JSON on stdin: {event, stack, project, compose_file,
action, success, containers[], template, compose, dry_run}.
Environment: BASE_DIR COMPOSE_DIR DCS_EVENT PLUGIN_NAME PLUGIN_DIR
PLUGIN_STATE_DIR DCS_PLUGIN_CONFIG DCS_DRY_RUN DCS_NTFY_URL NTFY_TOKEN
DOCKER_COMPOSE_CMD TZ, plus the .env names listed under "env" in
plugin.json. 30 s timeout, 64 KB output, logs on the plugin's page.`,
  },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Plugins() {
  const { plugins, catalog, catalogLoading, loading, installing, error, fetchPlugins, fetchCatalog, installPlugin, installFromCatalog, scaffoldPlugin, removePlugin, togglePlugin } = usePluginStore()
  const [showInstall, setShowInstall] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)
  const [installingFeatured, setInstallingFeatured] = useState<string | null>(null)
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  useEffect(() => { if (isConnected) { fetchPlugins(); fetchCatalog() } }, [fetchPlugins, fetchCatalog, isConnected])

  // Everything the page can offer: the two UI-side entries plus the server catalogue
  const displayPlugins = useMemo<FeaturedPlugin[]>(() => {
    const fromServer = catalog.map(catalogToDisplay)
    const names = new Set(fromServer.map((p) => p.name))
    return [...SPECIAL_PLUGINS.filter((sp) => !names.has(sp.name)), ...fromServer]
  }, [catalog])

  // Close topmost modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteTarget) { setDeleteTarget(null); return }
      if (showInstall) { setShowInstall(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deleteTarget, showInstall])

  const handleInstall = useCallback(async () => {
    if (!gitUrl) return
    const ok = await installPlugin(gitUrl)
    if (ok) {
      setShowInstall(false)
      setGitUrl('')
      addToast({ type: 'success', message: 'Plugin installed successfully' })
    }
  }, [gitUrl, installPlugin, addToast])

  const handleInstallFeatured = useCallback(async (fp: FeaturedPlugin) => {
    if (installingFeatured) return
    // Check if already installed
    if (plugins.some(p => p.name === fp.name)) {
      addToast({ type: 'info', message: `${fp.name} is already installed` })
      return
    }
    setInstallingFeatured(fp.name)
    let ok: boolean
    if (fp.fromCatalog) {
      ok = await installFromCatalog(fp.name)
    } else if (fp.scaffold) {
      // Scaffold bundled plugin directly on disk (no git clone needed)
      ok = await scaffoldPlugin({
        name: fp.name,
        description: fp.description,
        version: fp.version,
        author: fp.author,
        hooks: fp.scaffold.hooks,
        cards: fp.scaffold.cards,
      })
    } else {
      ok = await installPlugin(fp.url)
    }
    setInstallingFeatured(null)
    if (ok) {
      addToast({ type: 'success', message: `${fp.name} installed — enable it to activate its hooks` })
    } else {
      addToast({ type: 'error', message: usePluginStore.getState().error || `Failed to install ${fp.name}` })
    }
  }, [installingFeatured, plugins, installPlugin, installFromCatalog, scaffoldPlugin, addToast])

  const installedNames = new Set(plugins.map(p => p.name))

  // Built-in plugin toggle — just calls the store (which handles localStorage persistence)
  const handleBuiltInToggle = useCallback((name: string) => {
    togglePlugin(name).then((ok) => {
      if (!ok) addToast({ type: 'error', message: usePluginStore.getState().error || `Could not toggle ${name}` })
    })
  }, [togglePlugin, addToast])

  // Read built-in toggle state from the store (reactive — re-renders on toggle)
  const builtInToggles: Record<string, boolean> = {}
  for (const fp of displayPlugins) {
    if (fp.builtIn) {
      const p = plugins.find(pl => pl.name === fp.name)
      builtInToggles[fp.name] = p ? p.enabled : true
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <DisconnectedBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/10 flex items-center justify-center">
            <Puzzle className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight"><span className="text-gradient">Plugins</span></h1>
            <p className="text-sm text-slate-400">Extend DCS with templates and lifecycle hooks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPlugins()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10 transition-all"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">Create Guide</span>
          </button>
          <button
            onClick={() => setShowInstall(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-all"
          >
            <Download size={14} />
            <span>Install from Git</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Plugin Creation Guide (collapsible) */}
      {showGuide && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-violet-400" />
              <h2 className="text-sm font-semibold text-white">Create Your Own Plugin</h2>
            </div>
            <button onClick={() => setShowGuide(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              Plugins are Git repositories with a <code className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">plugin.json</code> manifest.
              They can provide compose templates and lifecycle hook scripts that run during deployments.
            </p>
            {GUIDE_SECTIONS.map((section, i) => {
              const isExpanded = expandedGuide === i
              const Icon = section.icon
              return (
                <div key={section.title} className="border border-white/[0.03] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedGuide(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <Icon size={14} className="text-violet-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-200 flex-1">{section.title}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-500" />
                      : <ChevronRight size={14} className="text-slate-500" />
                    }
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <pre className="bg-slate-950/60 border border-white/[0.03] rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed">
                        {section.content}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
              <Sparkles size={12} className="text-violet-400" />
              <span>Make your hook scripts executable: <code className="text-cyan-400">chmod +x hooks/*</code></span>
            </div>
          </div>
        </div>
      )}

      {/* Featured Plugins — grouped by category */}
      {(['safety', 'monitoring', 'operations', 'advanced', 'cards'] as const).map((cat) => {
        const catPlugins = displayPlugins.filter((fp) => (fp.category || 'safety') === cat)
        if (catPlugins.length === 0) return null
        const catInfo = CATEGORY_LABELS[cat]
        const CatIcon = catInfo.icon
        return (
      <div key={cat}>
        <div className="flex items-center gap-2 mb-3">
          <CatIcon size={12} className={catInfo.color} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{catInfo.label}</span>
          <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {catPlugins.map((fp) => {
            const Icon = fp.icon
            const isInstalled = installedNames.has(fp.name)
            const isInstalling = installingFeatured === fp.name
            const isSafety = fp.tags.includes('safety') || fp.tags.includes('validation')
            return (
              <div
                key={fp.name}
                className={`
                  bg-slate-900/60 backdrop-blur-md border rounded-xl p-5 overflow-visible
                  transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:z-20 relative
                  ${isSafety ? 'gradient-border' : ''}
                  ${isInstalled ? 'border-emerald-500/20 glow-emerald' : 'border-white/5 hover:border-white/10'}
                `}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${fp.bgColor} border ${fp.borderColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${fp.color}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isInstalled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <CheckCircle size={10} />
                        Installed
                      </span>
                    )}
                    {/* Info popover */}
                    <div className="relative group/info">
                      <button className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors" aria-label="Plugin details">
                        <AlertCircle size={14} />
                      </button>
                      <div className="absolute right-full top-0 mr-1 z-[100] hidden group-hover/info:block animate-fade-in" style={{ width: '300px' }}>
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${fp.color}`} />
                            <span className="text-xs font-semibold text-slate-200">{fp.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">v{fp.version}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{fp.description}</p>
                          {fp.scaffold?.hooks && (
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Lifecycle Hooks</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(fp.scaffold.hooks).map((hook) => (
                                  <span key={hook} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-mono text-cyan-400 border border-white/[0.03]">
                                    <Zap size={8} className="text-cyan-500/60" />
                                    {hook}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Tags</p>
                            <div className="flex flex-wrap gap-1">
                              {fp.tags.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-slate-500">{tag}</span>
                              ))}
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-500">by {fp.author}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{fp.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">{fp.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-4">
                  {fp.category === 'cards' ? (
                    <span className="flex items-center gap-1"><LayoutTemplate size={10} />{fp.templateCount} cards</span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1"><Zap size={10} />{fp.hookCount} hooks</span>
                      {fp.templateCount > 0 && <span className="flex items-center gap-1"><LayoutTemplate size={10} />{fp.templateCount} templates</span>}
                    </>
                  )}
                  <span>v{fp.version}</span>
                </div>
                {fp.builtIn ? (
                  <button
                    onClick={() => handleBuiltInToggle(fp.name)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      builtInToggles[fp.name]
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'text-slate-500 bg-slate-800/60 border border-white/5 hover:bg-slate-800'
                    }`}
                  >
                    {builtInToggles[fp.name]
                      ? <><ToggleRight size={16} /> Enabled</>
                      : <><ToggleLeft size={16} /> Disabled</>
                    }
                  </button>
                ) : isInstalled ? (
                  <button
                    onClick={() => togglePlugin(fp.name)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      plugins.find(p => p.name === fp.name)?.enabled
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'text-slate-500 bg-slate-800/60 border border-white/5 hover:bg-slate-800'
                    }`}
                  >
                    {plugins.find(p => p.name === fp.name)?.enabled
                      ? <><ToggleRight size={16} /> Enabled</>
                      : <><ToggleLeft size={16} /> Disabled</>
                    }
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstallFeatured(fp)}
                    disabled={isInstalling || !isConnected}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all press"
                  >
                    {isInstalling ? (
                      <><Loader2 size={13} className="animate-spin" /> Installing...</>
                    ) : (
                      <><Download size={13} /> Install</>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
        )
      })}

      {/* Installed Plugins */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package size={12} className="text-cyan-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Installed ({plugins.length})
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="bg-slate-900/60 border border-white/5 rounded-xl p-5 h-36 skeleton" />)}
          </div>
        ) : plugins.length === 0 ? (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-xl p-10 text-center">
            <Package className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No plugins installed yet</p>
            <p className="text-xs text-slate-500 mt-1">Install a featured plugin above or add one from a Git URL</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
            {plugins.map((p, i) => (
              <div
                key={p.name}
                className={`bg-slate-900/60 backdrop-blur-md border rounded-xl p-5 glass-hover transition-all animate-fade-in overflow-visible relative hover:z-20 ${p.enabled ? 'border-white/5 glow-cyan' : 'border-white/5'}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.enabled ? 'bg-cyan-500/15 border border-cyan-500/20' : 'bg-slate-800/60 border border-white/[0.03]'}`}>
                      <Puzzle className={`w-4 h-4 ${p.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">v{p.version}</span>
                      </div>
                      {p.author && <span className="text-xs text-slate-500">{p.author}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Info popover */}
                    <div className="relative group/info">
                      <button className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors" aria-label="Plugin details">
                        <AlertCircle size={14} />
                      </button>
                      <div className="absolute right-full top-0 mr-1 z-[100] hidden group-hover/info:block animate-fade-in" style={{ width: '280px' }}>
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Puzzle className={`w-4 h-4 ${p.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                            <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">v{p.version}</span>
                          </div>
                          {p.description && <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>}
                          {p.hooks && p.hooks.length > 0 && (
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Lifecycle Hooks</p>
                              <div className="flex flex-wrap gap-1">
                                {p.hooks.map((hook) => (
                                  <span key={hook} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-mono text-cyan-400 border border-white/[0.03]">
                                    <Zap size={8} className="text-cyan-500/60" />
                                    {hook}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {p.templates && p.templates.length > 0 && (
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Templates</p>
                              <div className="flex flex-wrap gap-1">
                                {p.templates.map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-slate-400">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {p.author && <p className="text-[9px] text-slate-500">by {p.author}</p>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => togglePlugin(p.name)}
                      className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                      title={p.enabled ? 'Disable plugin' : 'Enable plugin'}
                    >
                      {p.enabled
                        ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                        : <ToggleLeft className="w-6 h-6 text-slate-500" />
                      }
                    </button>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{p.description}</p>
                )}

                {/* Hook chips */}
                {p.hooks && p.hooks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.hooks.map((hook) => (
                      <span key={hook} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-mono text-slate-500 border border-white/[0.03]">
                        <Zap size={7} className="text-cyan-500/50" />
                        {hook}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <LayoutTemplate size={11} />
                    {(p.templates ?? []).length} {(p.templates ?? []).length === 1 ? 'template' : 'templates'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap size={11} />
                    {(p.hooks ?? []).length} {(p.hooks ?? []).length === 1 ? 'hook' : 'hooks'}
                  </span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-medium ${p.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/60 text-slate-500'}`}>
                    {p.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => setDeleteTarget(p.name)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                    title="Remove plugin"
                    aria-label="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install from Git Modal */}
      {showInstall && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowInstall(false)}>
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 shadow-2xl shadow-black/40 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <GitBranch size={14} className="text-cyan-400" />
                </div>
                <h2 className="text-base font-semibold text-white">Install from Git</h2>
              </div>
              <button onClick={() => setShowInstall(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Repository URL</label>
                <input
                  value={gitUrl}
                  onChange={e => setGitUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInstall()}
                  placeholder="https://github.com/user/my-dcs-plugin.git"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/60 text-sm text-white placeholder-slate-500 border border-white/5 focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all"
                />
              </div>
              <div className="bg-slate-800/40 rounded-lg px-3.5 py-3 border border-white/[0.03]">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The repository must contain a <code className="text-cyan-400 font-medium">plugin.json</code> manifest at the root.
                  Plugins can include templates and lifecycle hook scripts.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowInstall(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/5 text-sm text-slate-300 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstall}
                  disabled={installing || !gitUrl.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                  {installing
                    ? <><Loader2 size={14} className="animate-spin" /> Installing...</>
                    : <><Download size={14} /> Install Plugin</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete Confirmation */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-sm mx-4 border border-rose-500/20 shadow-2xl shadow-black/40 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 size={14} className="text-rose-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Remove Plugin</h3>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              Remove <span className="font-medium text-white">{deleteTarget}</span> and all its templates and hooks? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/5 text-sm text-slate-300 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const ok = await removePlugin(deleteTarget)
                  if (ok) addToast({ type: 'success', message: `${deleteTarget} removed` })
                  setDeleteTarget(null)
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/25 text-rose-400 hover:bg-rose-500/25 text-sm font-medium transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
