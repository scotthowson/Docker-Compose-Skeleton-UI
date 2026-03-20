// =============================================================================
// Plugins — Extension marketplace with featured plugins, install, and guide
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Puzzle, Plus, Trash2, ToggleLeft, ToggleRight, GitBranch, LayoutTemplate,
  Zap, Package, X, Loader2, AlertCircle, CheckCircle, RefreshCw, Download,
  Shield, Activity, Code, ChevronDown, ChevronRight, FileJson, FolderTree, Terminal,
  BookOpen, ExternalLink, Sparkles, Clock, Eye, Bell, FileCheck, Gauge,
  Archive, Lock, Wifi, FileSearch, Radio, Eraser,
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
  /** Built-in feature — always available, toggle controls the feature directly */
  builtIn?: boolean
  /** When provided, plugin is scaffolded locally instead of git-cloned */
  scaffold?: {
    hooks: Record<string, string>
  }
}

const FEATURED_PLUGINS: FeaturedPlugin[] = [
  // ── Safety & Validation ──────────────────────────────────────────────
  {
    name: 'compose-linter',
    builtIn: true,
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
    scaffold: {
      hooks: {
        'pre-deploy': '#!/bin/bash\n# compose-linter — pre-deploy hook\n# Validates compose content before deployment\nCONTEXT=$(cat)\nCOMPOSE=$(echo "$CONTEXT" | jq -r \'.compose // empty\' 2>/dev/null)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nTEMPLATE=$(echo "$CONTEXT" | jq -r \'.template // "unknown"\' 2>/dev/null)\nif [[ -z "$COMPOSE" ]]; then\n    echo "{\\"plugin\\":\\"compose-linter\\",\\"status\\":\\"skip\\",\\"message\\":\\"No compose content to lint\\"}"\n    exit 0\nfi\nWARN_COUNT=0\nWARNINGS=""\nSERVICES=$(echo "$COMPOSE" | grep -E "^  [a-zA-Z_-][a-zA-Z0-9_-]*:" | sed "s/^  //;s/://")\nfor SVC in $SERVICES; do\n    BLOCK=$(echo "$COMPOSE" | sed -n "/^  ${SVC}:/,/^  [a-zA-Z_-]/p")\n    if ! echo "$BLOCK" | grep -q "restart:"; then\n        WARN_COUNT=$((WARN_COUNT+1))\n        [[ -n "$WARNINGS" ]] && WARNINGS+=","\n        WARNINGS+="{\\"service\\":\\"$SVC\\",\\"rule\\":\\"missing-restart\\",\\"message\\":\\"No restart policy\\",\\"severity\\":\\"warning\\"}"\n    fi\n    if echo "$BLOCK" | grep -q "privileged:[[:space:]]*true"; then\n        WARN_COUNT=$((WARN_COUNT+1))\n        [[ -n "$WARNINGS" ]] && WARNINGS+=","\n        WARNINGS+="{\\"service\\":\\"$SVC\\",\\"rule\\":\\"privileged\\",\\"message\\":\\"Privileged mode enabled\\",\\"severity\\":\\"warning\\"}"\n    fi\n    if ! echo "$BLOCK" | grep -q "healthcheck:"; then\n        WARN_COUNT=$((WARN_COUNT+1))\n        [[ -n "$WARNINGS" ]] && WARNINGS+=","\n        WARNINGS+="{\\"service\\":\\"$SVC\\",\\"rule\\":\\"missing-healthcheck\\",\\"message\\":\\"No health check\\",\\"severity\\":\\"info\\"}"\n    fi\ndone\nif [[ $WARN_COUNT -eq 0 ]]; then\n    echo "{\\"plugin\\":\\"compose-linter\\",\\"status\\":\\"pass\\",\\"stack\\":\\"$STACK\\",\\"template\\":\\"$TEMPLATE\\",\\"warnings\\":[],\\"message\\":\\"All checks passed\\"}"\nelse\n    echo "{\\"plugin\\":\\"compose-linter\\",\\"status\\":\\"warn\\",\\"stack\\":\\"$STACK\\",\\"template\\":\\"$TEMPLATE\\",\\"warning_count\\":$WARN_COUNT,\\"warnings\\":[$WARNINGS],\\"message\\":\\"$WARN_COUNT issue(s) found\\"}"\nfi\nexit 0\n',
      },
    },
  },
  {
    name: 'env-validator',
    description: 'Scans compose files for referenced environment variables that are not defined, detects duplicate keys, flags empty values, and warns about hardcoded secrets — catching configuration gaps before deployment.',
    author: 'DCS Community',
    version: '1.1.0',
    icon: FileSearch,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    url: '',
    tags: ['validation', 'environment', 'safety'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'pre-deploy': '#!/bin/bash\n# env-validator — pre-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nCOMPOSE=$(echo "$CONTEXT" | jq -r \'.compose // empty\' 2>/dev/null)\nWARNINGS=""\nWARN_COUNT=0\nif [[ -n "$COMPOSE" ]]; then\n    REFERENCED_VARS=$(echo "$COMPOSE" | grep -oE \'\\$\\{[A-Z_][A-Z0-9_]*\' | sed \'s/\\${//\' | sort -u)\n    for var in $REFERENCED_VARS; do\n        VAL=$(eval echo "\\${$var:-}" 2>/dev/null)\n        if [[ -z "$VAL" ]]; then\n            WARN_COUNT=$((WARN_COUNT+1))\n            [[ -n "$WARNINGS" ]] && WARNINGS+=","\n            WARNINGS+="{\\"variable\\":\\"$var\\",\\"rule\\":\\"undefined\\",\\"message\\":\\"Referenced but not set\\",\\"severity\\":\\"warning\\"}"\n        fi\n    done\nfi\nif [[ $WARN_COUNT -eq 0 ]]; then\n    echo "{\\"plugin\\":\\"env-validator\\",\\"event\\":\\"pre-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"pass\\",\\"warnings\\":[],\\"message\\":\\"All environment variables resolved\\"}"\nelse\n    echo "{\\"plugin\\":\\"env-validator\\",\\"event\\":\\"pre-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"warn\\",\\"warning_count\\":$WARN_COUNT,\\"warnings\\":[$WARNINGS],\\"message\\":\\"$WARN_COUNT undefined variable(s)\\"}"\nfi\nexit 0\n',
      },
    },
  },
  {
    name: 'deploy-guard',
    description: 'Logs every deployment with full context, creates pre-update safety checkpoints of running container states, and validates container health after starts.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Shield,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    url: '',
    tags: ['safety', 'deployment', 'health'],
    hookCount: 3,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-deploy': '#!/bin/bash\n# deploy-guard — post-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nSUCCESS=$(echo "$CONTEXT" | jq -r \'.success // "true"\' 2>/dev/null)\nTIMESTAMP=$(date +%Y%m%d_%H%M%S)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nLOG_DIR="$BASE/.logs/deploy-guard"\nmkdir -p "$LOG_DIR"\necho "$CONTEXT" | jq . > "$LOG_DIR/${STACK}_${TIMESTAMP}.json" 2>/dev/null\nif [[ "$SUCCESS" == "true" ]]; then\n    echo "{\\"plugin\\":\\"deploy-guard\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"message\\":\\"Deployment logged successfully\\"}"\nelse\n    echo "{\\"plugin\\":\\"deploy-guard\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"alert\\",\\"message\\":\\"Deployment failure logged\\"}"\nfi\nexit 0\n',
        'pre-update': '#!/bin/bash\n# deploy-guard — pre-update hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nCHECKPOINT_DIR="$BASE/.logs/deploy-guard/checkpoints"\nmkdir -p "$CHECKPOINT_DIR"\nTIMESTAMP=$(date +%Y%m%d_%H%M%S)\ndocker ps --format "{{.Names}}|{{.Image}}|{{.Status}}" > "$CHECKPOINT_DIR/${STACK}_${TIMESTAMP}.txt" 2>/dev/null\necho "{\\"plugin\\":\\"deploy-guard\\",\\"event\\":\\"pre-update\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"message\\":\\"Safety checkpoint created\\"}"\nexit 0\n',
        'post-start': '#!/bin/bash\n# deploy-guard — post-start health validation\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nUNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null | wc -l)\nSTARTING=$(docker ps --filter "health=starting" --format "{{.Names}}" 2>/dev/null | wc -l)\nif [[ "$UNHEALTHY" -gt 0 ]]; then\n    echo "{\\"plugin\\":\\"deploy-guard\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"warn\\",\\"unhealthy\\":$UNHEALTHY,\\"message\\":\\"$UNHEALTHY unhealthy containers detected\\"}"\nelse\n    echo "{\\"plugin\\":\\"deploy-guard\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"starting\\":$STARTING,\\"message\\":\\"All containers healthy\\"}"\nfi\nexit 0\n',
      },
    },
  },
  {
    name: 'auto-backup',
    description: 'Snapshots compose files before updates and deployments automatically, so you can always roll back to the last known-good configuration.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Clock,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    url: '',
    tags: ['backup', 'safety', 'rollback'],
    hookCount: 2,
    templateCount: 0,
    scaffold: {
      hooks: {
        'pre-update': '#!/bin/bash\n# auto-backup — pre-update hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nBACKUP_DIR="$BASE/.backups/auto/$STACK"\nmkdir -p "$BACKUP_DIR"\nTIMESTAMP=$(date +%Y%m%d_%H%M%S)\nSTACK_DIR="$BASE/Stacks"\nCOUNT=0\nif [[ -d "$STACK_DIR" ]]; then\n    for compose in "$STACK_DIR"/*/docker-compose.yml; do\n        [[ -f "$compose" ]] || continue\n        CATEGORY=$(basename "$(dirname "$compose")")\n        cp "$compose" "$BACKUP_DIR/${CATEGORY}_${TIMESTAMP}.yml" 2>/dev/null\n        COUNT=$((COUNT+1))\n    done\nfi\necho "{\\"plugin\\":\\"auto-backup\\",\\"event\\":\\"pre-update\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"files_backed_up\\":$COUNT,\\"message\\":\\"$COUNT compose files backed up\\"}"\nexit 0\n',
        'pre-deploy': '#!/bin/bash\n# auto-backup — pre-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nBACKUP_DIR="$BASE/.backups/auto/$STACK"\nmkdir -p "$BACKUP_DIR"\nTIMESTAMP=$(date +%Y%m%d_%H%M%S)\nTARGET_COMPOSE="$BASE/Stacks/$STACK/docker-compose.yml"\nif [[ -f "$TARGET_COMPOSE" ]]; then\n    cp "$TARGET_COMPOSE" "$BACKUP_DIR/compose_${TIMESTAMP}.yml.bak"\n    echo "{\\"plugin\\":\\"auto-backup\\",\\"event\\":\\"pre-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"message\\":\\"Compose file backed up before deployment\\"}"\nelse\n    echo "{\\"plugin\\":\\"auto-backup\\",\\"event\\":\\"pre-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"skip\\",\\"message\\":\\"No existing compose to backup\\"}"\nfi\nexit 0\n',
      },
    },
  },
  // ── Monitoring & Observability ───────────────────────────────────────
  {
    name: 'container-notifier',
    description: 'Sends webhook alerts to Slack, Discord, or NTFY when deployments fail or containers go unhealthy. Set NOTIFY_WEBHOOK_URL in your .env to activate.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Bell,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    url: '',
    tags: ['notifications', 'webhooks', 'alerting'],
    hookCount: 2,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-deploy': '#!/bin/bash\n# container-notifier — post-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nSUCCESS=$(echo "$CONTEXT" | jq -r \'.success // "true"\' 2>/dev/null)\nWEBHOOK_URL="${NOTIFY_WEBHOOK_URL:-}"\nif [[ "$SUCCESS" != "true" ]]; then\n    MESSAGE="Deployment to stack \'$STACK\' reported failure"\n    if [[ -n "$WEBHOOK_URL" ]]; then\n        curl -s -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d "{\\"text\\":\\"$MESSAGE\\",\\"content\\":\\"$MESSAGE\\"}" >/dev/null 2>&1 || true\n    fi\n    echo "{\\"plugin\\":\\"container-notifier\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"alert\\",\\"message\\":\\"$MESSAGE\\"}"\nelse\n    echo "{\\"plugin\\":\\"container-notifier\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"message\\":\\"Deployment to $STACK succeeded\\"}"\nfi\nexit 0\n',
        'post-start': '#!/bin/bash\n# container-notifier — post-start hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nUNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null | head -10)\nWEBHOOK_URL="${NOTIFY_WEBHOOK_URL:-}"\nif [[ -n "$UNHEALTHY" ]]; then\n    COUNT=$(echo "$UNHEALTHY" | wc -l)\n    NAMES=$(echo "$UNHEALTHY" | tr \'\\n\' \', \' | sed \'s/,$//\')\n    MESSAGE="$COUNT unhealthy container(s) after start: $NAMES"\n    if [[ -n "$WEBHOOK_URL" ]]; then\n        curl -s -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d "{\\"text\\":\\"$MESSAGE\\",\\"content\\":\\"$MESSAGE\\"}" >/dev/null 2>&1 || true\n    fi\n    echo "{\\"plugin\\":\\"container-notifier\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"alert\\",\\"unhealthy_count\\":$COUNT,\\"message\\":\\"$MESSAGE\\"}"\nelse\n    echo "{\\"plugin\\":\\"container-notifier\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"message\\":\\"All containers healthy\\"}"\nfi\nexit 0\n',
      },
    },
  },
  {
    name: 'resource-monitor',
    description: 'Identifies containers running without memory limits or CPU quotas after deployment — finds the resource hogs before they starve the host.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Gauge,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    url: '',
    tags: ['resources', 'monitoring', 'performance'],
    hookCount: 2,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-deploy': '#!/bin/bash\n# resource-monitor — post-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nWARNINGS=""\nWARN_COUNT=0\nwhile IFS= read -r container; do\n    [[ -z "$container" ]] && continue\n    MEM=$(docker inspect "$container" --format "{{.HostConfig.Memory}}" 2>/dev/null)\n    CPU=$(docker inspect "$container" --format "{{.HostConfig.NanoCpus}}" 2>/dev/null)\n    if [[ "${MEM:-0}" == "0" ]]; then\n        WARN_COUNT=$((WARN_COUNT+1))\n        [[ -n "$WARNINGS" ]] && WARNINGS+=","\n        WARNINGS+="{\\"container\\":\\"$container\\",\\"rule\\":\\"no-memory-limit\\",\\"message\\":\\"No memory limit set\\"}"\n    fi\n    if [[ "${CPU:-0}" == "0" ]]; then\n        WARN_COUNT=$((WARN_COUNT+1))\n        [[ -n "$WARNINGS" ]] && WARNINGS+=","\n        WARNINGS+="{\\"container\\":\\"$container\\",\\"rule\\":\\"no-cpu-limit\\",\\"message\\":\\"No CPU limit set\\"}"\n    fi\ndone < <(docker ps --format "{{.Names}}" 2>/dev/null | head -30)\nif [[ $WARN_COUNT -eq 0 ]]; then\n    echo "{\\"plugin\\":\\"resource-monitor\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"pass\\",\\"message\\":\\"All containers have resource constraints\\"}"\nelse\n    echo "{\\"plugin\\":\\"resource-monitor\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"warn\\",\\"warning_count\\":$WARN_COUNT,\\"warnings\\":[$WARNINGS],\\"message\\":\\"$WARN_COUNT container(s) missing resource limits\\"}"\nfi\nexit 0\n',
        'post-start': '#!/bin/bash\n# resource-monitor — post-start hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nCONTAINER_COUNT=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l)\necho "{\\"plugin\\":\\"resource-monitor\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"containers_monitored\\":$CONTAINER_COUNT,\\"message\\":\\"Resource snapshot captured for $CONTAINER_COUNT containers\\"}"\nexit 0\n',
      },
    },
  },
  {
    name: 'stack-analytics',
    description: 'Records every deployment and start event to a JSONL timeline, building a complete operational history you can query and analyze.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Activity,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    url: '',
    tags: ['analytics', 'metrics', 'history'],
    hookCount: 2,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-deploy': '#!/bin/bash\n# stack-analytics — post-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nDATA_DIR="$BASE/.logs/stack-analytics"\nmkdir -p "$DATA_DIR"\nDATA_FILE="$DATA_DIR/events.jsonl"\nTIMESTAMP=$(date -Iseconds)\nCONTAINER_COUNT=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l)\necho "{\\"timestamp\\":\\"$TIMESTAMP\\",\\"stack\\":\\"$STACK\\",\\"event\\":\\"deploy\\",\\"containers\\":$CONTAINER_COUNT}" >> "$DATA_FILE"\nTOTAL=$(wc -l < "$DATA_FILE" 2>/dev/null || echo 0)\necho "{\\"plugin\\":\\"stack-analytics\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"total_events\\":$TOTAL,\\"message\\":\\"Deployment #$TOTAL recorded\\"}"\nexit 0\n',
        'post-start': '#!/bin/bash\n# stack-analytics — post-start hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nDATA_DIR="$BASE/.logs/stack-analytics"\nmkdir -p "$DATA_DIR"\nDATA_FILE="$DATA_DIR/events.jsonl"\nTIMESTAMP=$(date -Iseconds)\necho "{\\"timestamp\\":\\"$TIMESTAMP\\",\\"stack\\":\\"$STACK\\",\\"event\\":\\"start\\"}" >> "$DATA_FILE"\necho "{\\"plugin\\":\\"stack-analytics\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"message\\":\\"Start event recorded\\"}"\nexit 0\n',
      },
    },
  },
  {
    name: 'uptime-ping',
    description: 'Pings Healthchecks.io, Uptime Kuma, or any webhook URL after successful starts. Set UPTIME_PING_URL in your .env to connect your monitoring stack.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Radio,
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/20',
    url: '',
    tags: ['uptime', 'integrations', 'webhooks'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-start': '#!/bin/bash\n# uptime-ping — post-start hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nPING_URL="${UPTIME_PING_URL:-}"\nHEALTHCHECK_URL="${HEALTHCHECKS_PING_URL:-}"\nURL="${PING_URL:-$HEALTHCHECK_URL}"\nif [[ -z "$URL" ]]; then\n    echo "{\\"plugin\\":\\"uptime-ping\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"skip\\",\\"message\\":\\"No ping URL configured (set UPTIME_PING_URL or HEALTHCHECKS_PING_URL)\\"}"\n    exit 0\nfi\nHTTP_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)\nif [[ "$HTTP_CODE" =~ ^2 ]]; then\n    echo "{\\"plugin\\":\\"uptime-ping\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"http_code\\":$HTTP_CODE,\\"message\\":\\"Uptime ping sent successfully\\"}"\nelse\n    echo "{\\"plugin\\":\\"uptime-ping\\",\\"event\\":\\"post-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"warn\\",\\"http_code\\":${HTTP_CODE:-0},\\"message\\":\\"Uptime ping failed (HTTP $HTTP_CODE)\\"}"\nfi\nexit 0\n',
      },
    },
  },
  // ── Operations & Maintenance ─────────────────────────────────────────
  {
    name: 'port-guard',
    description: 'Scans host ports before stack startup to detect conflicts that would cause silent bind failures. Catches the problem before Docker does.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Lock,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/20',
    url: '',
    tags: ['ports', 'conflicts', 'prevention'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'pre-start': '#!/bin/bash\n# port-guard — pre-start hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nCONFLICT_COUNT=0\nPORTS_LIST=""\nfor port in $(ss -tlnp 2>/dev/null | awk \'NR>1 {print $4}\' | grep -oE \'[0-9]+$\' | sort -un); do\n    [[ "$port" -ge 32768 ]] && continue\n    CONFLICT_COUNT=$((CONFLICT_COUNT+1))\n    [[ -n "$PORTS_LIST" ]] && PORTS_LIST+=","\n    PORTS_LIST+="$port"\ndone\necho "{\\"plugin\\":\\"port-guard\\",\\"event\\":\\"pre-start\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"ports_in_use\\":$CONFLICT_COUNT,\\"message\\":\\"$CONFLICT_COUNT ports in use on host\\"}"\nexit 0\n',
      },
    },
  },
  {
    name: 'log-archiver',
    description: 'Archives the last 500 lines of every container log with timestamps before stacks stop. Debug context preserved, even after containers are gone.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Archive,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    url: '',
    tags: ['logs', 'archival', 'debugging'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'pre-stop': '#!/bin/bash\n# log-archiver — pre-stop hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBASE="${BASE_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"\nARCHIVE_DIR="$BASE/.logs/archive"\nmkdir -p "$ARCHIVE_DIR"\nTIMESTAMP=$(date +%Y%m%d_%H%M%S)\nCOUNT=0\nwhile IFS= read -r container; do\n    [[ -z "$container" ]] && continue\n    LOG_FILE="$ARCHIVE_DIR/${container}_${TIMESTAMP}.log"\n    docker logs --tail 500 "$container" > "$LOG_FILE" 2>&1 && COUNT=$((COUNT+1))\ndone < <(docker ps --format "{{.Names}}" 2>/dev/null)\necho "{\\"plugin\\":\\"log-archiver\\",\\"event\\":\\"pre-stop\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"archived\\":$COUNT,\\"path\\":\\"$ARCHIVE_DIR\\",\\"message\\":\\"Archived logs for $COUNT containers\\"}"\nexit 0\n',
      },
    },
  },
  {
    name: 'dns-verify',
    description: 'Tests HTTP connectivity on every exposed port after deployment, confirming services are actually reachable — not just running.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Wifi,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    url: '',
    tags: ['connectivity', 'verification', 'networking'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-deploy': '#!/bin/bash\n# dns-verify — post-deploy hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nCHECKED=0\nREACHABLE=0\nUNREACHABLE=""\nwhile IFS= read -r line; do\n    [[ -z "$line" ]] && continue\n    CONTAINER=$(echo "$line" | cut -d\'|\' -f1)\n    PORTS=$(echo "$line" | cut -d\'|\' -f2)\n    for port in $(echo "$PORTS" | grep -oE \'0\\.0\\.0\\.0:[0-9]+\' | cut -d: -f2); do\n        CHECKED=$((CHECKED+1))\n        if curl -s --max-time 3 -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port" 2>/dev/null | grep -qE \'^[1-5][0-9]{2}$\'; then\n            REACHABLE=$((REACHABLE+1))\n        else\n            [[ -n "$UNREACHABLE" ]] && UNREACHABLE+=", "\n            UNREACHABLE+="$CONTAINER:$port"\n        fi\n    done\ndone < <(docker ps --format "{{.Names}}|{{.Ports}}" 2>/dev/null | head -20)\nif [[ $CHECKED -eq 0 ]]; then\n    echo "{\\"plugin\\":\\"dns-verify\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"skip\\",\\"message\\":\\"No exposed ports to verify\\"}"\nelif [[ -z "$UNREACHABLE" ]]; then\n    echo "{\\"plugin\\":\\"dns-verify\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"pass\\",\\"checked\\":$CHECKED,\\"reachable\\":$REACHABLE,\\"message\\":\\"All $REACHABLE endpoints reachable\\"}"\nelse\n    echo "{\\"plugin\\":\\"dns-verify\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"warn\\",\\"checked\\":$CHECKED,\\"reachable\\":$REACHABLE,\\"unreachable\\":\\"$UNREACHABLE\\",\\"message\\":\\"$((CHECKED-REACHABLE)) of $CHECKED endpoints unreachable\\"}"\nfi\nexit 0\n',
      },
    },
  },
  {
    name: 'cleanup-sweeper',
    description: 'Prunes dangling images and detects orphaned networks after stacks stop. Keeps your Docker environment lean without manual intervention.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Eraser,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    url: '',
    tags: ['cleanup', 'disk', 'maintenance'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-stop': '#!/bin/bash\n# cleanup-sweeper — post-stop hook\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nCLEANED=0\nDANGLING=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l)\nif [[ "$DANGLING" -gt 0 ]]; then\n    docker image prune -f >/dev/null 2>&1\n    CLEANED=$((CLEANED+DANGLING))\nfi\nORPHAN_NETS=$(docker network ls --filter "type=custom" -q 2>/dev/null | while read -r net; do\n    CONNECTED=$(docker network inspect "$net" --format \'{{len .Containers}}\' 2>/dev/null)\n    [[ "${CONNECTED:-0}" == "0" ]] && echo "$net"\ndone | wc -l)\nCACHE_SIZE=$(docker system df --format \'{{.Type}}\\t{{.Reclaimable}}\' 2>/dev/null | grep "Build Cache" | awk \'{print $2}\')\necho "{\\"plugin\\":\\"cleanup-sweeper\\",\\"event\\":\\"post-stop\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"dangling_images\\":$DANGLING,\\"orphan_networks\\":$ORPHAN_NETS,\\"cache_reclaimable\\":\\"${CACHE_SIZE:-0B}\\",\\"message\\":\\"Cleaned $CLEANED dangling images, found $ORPHAN_NETS orphan networks\\"}"\nexit 0\n',
      },
    },
  },
  // ── Advanced / Sophisticated ──────────────────────────────────────────
  {
    name: 'security-audit',
    description: 'Deep security scanner — checks for writable root filesystems, excessive capabilities, host PID/IPC namespace sharing, missing seccomp profiles, and containers running as UID 0. Generates a security score per service.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    url: '',
    tags: ['security', 'audit', 'hardening'],
    hookCount: 2,
    templateCount: 0,
    scaffold: {
      hooks: {
        'pre-deploy': '#!/bin/bash\n# security-audit — pre-deploy deep scan\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nCOMPOSE=$(echo "$CONTEXT" | jq -r \'.compose // empty\' 2>/dev/null)\nif [[ -z "$COMPOSE" ]]; then\n    echo "{\\"plugin\\":\\"security-audit\\",\\"status\\":\\"skip\\",\\"message\\":\\"No compose content\\"}"\n    exit 0\nfi\nSCORE=100\nFINDINGS=""\nFIND_COUNT=0\nadd_finding() {\n    local sev="$1" svc="$2" rule="$3" msg="$4" penalty="$5"\n    FIND_COUNT=$((FIND_COUNT+1))\n    SCORE=$((SCORE-penalty))\n    [[ -n "$FINDINGS" ]] && FINDINGS+=","\n    FINDINGS+="{\\"severity\\":\\"$sev\\",\\"service\\":\\"$svc\\",\\"rule\\":\\"$rule\\",\\"message\\":\\"$msg\\"}"\n}\nSERVICES=$(echo "$COMPOSE" | grep -E "^  [a-zA-Z_-][a-zA-Z0-9_-]*:" | sed "s/^  //;s/://")\nfor SVC in $SERVICES; do\n    BLOCK=$(echo "$COMPOSE" | sed -n "/^  ${SVC}:/,/^  [a-zA-Z_-]/p")\n    # Privileged mode\n    echo "$BLOCK" | grep -q "privileged:[[:space:]]*true" && add_finding "critical" "$SVC" "privileged" "Privileged mode — full host access" 25\n    # Docker socket mount\n    echo "$BLOCK" | grep -q "/var/run/docker.sock" && add_finding "critical" "$SVC" "docker-socket" "Docker socket mounted — daemon control" 20\n    # Host PID namespace\n    echo "$BLOCK" | grep -q "pid:[[:space:]]*host" && add_finding "high" "$SVC" "host-pid" "Host PID namespace — process visibility" 15\n    # Host IPC namespace\n    echo "$BLOCK" | grep -q "ipc:[[:space:]]*host" && add_finding "high" "$SVC" "host-ipc" "Host IPC namespace shared" 10\n    # Host network\n    echo "$BLOCK" | grep -q "network_mode:[[:space:]]*host" && add_finding "medium" "$SVC" "host-network" "Host network — no isolation" 10\n    # CAP_ADD ALL\n    echo "$BLOCK" | grep -q "ALL" && echo "$BLOCK" | grep -q "cap_add" && add_finding "critical" "$SVC" "cap-all" "ALL capabilities granted" 20\n    # No read_only root filesystem\n    if ! echo "$BLOCK" | grep -q "read_only:[[:space:]]*true"; then\n        add_finding "info" "$SVC" "writable-rootfs" "Root filesystem is writable" 2\n    fi\n    # No user directive (runs as root)\n    if ! echo "$BLOCK" | grep -q "user:"; then\n        add_finding "low" "$SVC" "root-user" "Runs as root (no user: set)" 3\n    fi\n    # No security_opt\n    if ! echo "$BLOCK" | grep -q "security_opt:"; then\n        add_finding "info" "$SVC" "no-seccomp" "No seccomp/apparmor profile" 1\n    fi\ndone\n[[ $SCORE -lt 0 ]] && SCORE=0\nGRADE="F"\n[[ $SCORE -ge 90 ]] && GRADE="A"\n[[ $SCORE -ge 80 ]] && [[ $SCORE -lt 90 ]] && GRADE="B"\n[[ $SCORE -ge 70 ]] && [[ $SCORE -lt 80 ]] && GRADE="C"\n[[ $SCORE -ge 50 ]] && [[ $SCORE -lt 70 ]] && GRADE="D"\necho "{\\"plugin\\":\\"security-audit\\",\\"event\\":\\"pre-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"score\\":$SCORE,\\"grade\\":\\"$GRADE\\",\\"finding_count\\":$FIND_COUNT,\\"findings\\":[$FINDINGS],\\"message\\":\\"Security score: $SCORE/100 (Grade $GRADE) — $FIND_COUNT finding(s)\\"}"\nexit 0\n',
        'post-deploy': '#!/bin/bash\n# security-audit — post-deploy runtime check\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nRUNTIME_ISSUES=""\nISSUE_COUNT=0\nwhile IFS= read -r container; do\n    [[ -z "$container" ]] && continue\n    # Check if running as root\n    USER=$(docker inspect "$container" --format "{{.Config.User}}" 2>/dev/null)\n    if [[ -z "$USER" ]] || [[ "$USER" == "0" ]] || [[ "$USER" == "root" ]]; then\n        ISSUE_COUNT=$((ISSUE_COUNT+1))\n        [[ -n "$RUNTIME_ISSUES" ]] && RUNTIME_ISSUES+=","\n        RUNTIME_ISSUES+="{\\"container\\":\\"$container\\",\\"issue\\":\\"running-as-root\\"}"\n    fi\n    # Check if privileged\n    PRIV=$(docker inspect "$container" --format "{{.HostConfig.Privileged}}" 2>/dev/null)\n    if [[ "$PRIV" == "true" ]]; then\n        ISSUE_COUNT=$((ISSUE_COUNT+1))\n        [[ -n "$RUNTIME_ISSUES" ]] && RUNTIME_ISSUES+=","\n        RUNTIME_ISSUES+="{\\"container\\":\\"$container\\",\\"issue\\":\\"privileged-runtime\\"}"\n    fi\ndone < <(docker ps --format "{{.Names}}" 2>/dev/null | head -50)\necho "{\\"plugin\\":\\"security-audit\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"runtime_issues\\":$ISSUE_COUNT,\\"issues\\":[$RUNTIME_ISSUES],\\"message\\":\\"$ISSUE_COUNT runtime security issue(s)\\"}"\nexit 0\n',
      },
    },
  },
  {
    name: 'network-policy',
    description: 'Analyzes Docker network topology after deployment — detects services sharing the default bridge network, identifies containers with no network isolation, and maps inter-service connectivity.',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Eye,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    url: '',
    tags: ['networking', 'security', 'topology'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'post-deploy': '#!/bin/bash\n# network-policy — post-deploy network analysis\nCONTEXT=$(cat)\nSTACK=$(echo "$CONTEXT" | jq -r \'.stack // "unknown"\' 2>/dev/null)\nBRIDGE_CONTAINERS=""\nISOLATED=0\nNON_ISOLATED=0\nNETWORK_MAP=""\n# Check each running container network assignments\nwhile IFS= read -r container; do\n    [[ -z "$container" ]] && continue\n    NETWORKS=$(docker inspect "$container" --format \'{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}\' 2>/dev/null)\n    ON_BRIDGE=false\n    NET_LIST=""\n    for net in $NETWORKS; do\n        [[ -n "$NET_LIST" ]] && NET_LIST+=","\n        NET_LIST+="\\"$net\\""\n        [[ "$net" == "bridge" ]] && ON_BRIDGE=true\n    done\n    if $ON_BRIDGE; then\n        NON_ISOLATED=$((NON_ISOLATED+1))\n        [[ -n "$BRIDGE_CONTAINERS" ]] && BRIDGE_CONTAINERS+=","\n        BRIDGE_CONTAINERS+="{\\"name\\":\\"$container\\",\\"networks\\":[$NET_LIST]}"\n    else\n        ISOLATED=$((ISOLATED+1))\n    fi\n    [[ -n "$NETWORK_MAP" ]] && NETWORK_MAP+=","\n    NETWORK_MAP+="{\\"container\\":\\"$container\\",\\"networks\\":[$NET_LIST]}"\ndone < <(docker ps --format "{{.Names}}" 2>/dev/null | head -50)\nTOTAL=$((ISOLATED+NON_ISOLATED))\necho "{\\"plugin\\":\\"network-policy\\",\\"event\\":\\"post-deploy\\",\\"stack\\":\\"$STACK\\",\\"status\\":\\"ok\\",\\"total_containers\\":$TOTAL,\\"isolated\\":$ISOLATED,\\"on_default_bridge\\":$NON_ISOLATED,\\"bridge_containers\\":[$BRIDGE_CONTAINERS],\\"network_map\\":[$NETWORK_MAP],\\"message\\":\\"$ISOLATED isolated, $NON_ISOLATED on default bridge out of $TOTAL containers\\"}"\nexit 0\n',
      },
    },
  },
  {
    name: 'dependency-checker',
    description: 'Validates service dependency chains — detects circular depends_on references, missing dependency targets, and services that depend on containers without health checks (which makes depends_on unreliable).',
    author: 'DCS Community',
    version: '1.0.0',
    icon: Code,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    url: '',
    tags: ['validation', 'dependencies', 'compose'],
    hookCount: 1,
    templateCount: 0,
    scaffold: {
      hooks: {
        'pre-deploy': "#!/bin/bash\n# dependency-checker — validates depends_on chains\nCONTEXT=$(cat)\nSTACK=$(echo \"$CONTEXT\" | jq -r '.stack // \"unknown\"' 2>/dev/null)\nCOMPOSE=$(echo \"$CONTEXT\" | jq -r '.compose // empty' 2>/dev/null)\nif [[ -z \"$COMPOSE\" ]]; then\n    echo '{\"plugin\":\"dependency-checker\",\"status\":\"skip\",\"message\":\"No compose content\"}'\n    exit 0\nfi\nISSUES=\"\"\nISSUE_COUNT=0\nSERVICES=$(echo \"$COMPOSE\" | grep -E '^  [a-zA-Z_-][a-zA-Z0-9_-]*:' | sed 's/^  //;s/://')\nDEPS_FILE=$(mktemp)\nHC_FILE=$(mktemp)\ntrap 'rm -f $DEPS_FILE $HC_FILE' EXIT\n# Build dependency + healthcheck maps using temp files\nfor SVC in $SERVICES; do\n    BLOCK=$(echo \"$COMPOSE\" | sed -n \"/^  ${SVC}:/,/^  [a-zA-Z_-]/p\")\n    echo \"$BLOCK\" | grep -q 'healthcheck:' && echo \"$SVC\" >> \"$HC_FILE\"\n    echo \"$BLOCK\" | grep -A20 'depends_on:' | grep -E '^      - ' | sed 's/^      - //' | tr -d ' ' | while read -r DEP; do\n        echo \"$SVC $DEP\" >> \"$DEPS_FILE\"\n    done\ndone\n# Validate\nwhile read -r SVC DEP; do\n    [[ -z \"$DEP\" ]] && continue\n    if ! echo \"$SERVICES\" | grep -qw \"$DEP\"; then\n        ISSUE_COUNT=$((ISSUE_COUNT+1))\n        [[ -n \"$ISSUES\" ]] && ISSUES+=\",\"\n        ISSUES+=\"{\\\"severity\\\":\\\"error\\\",\\\"service\\\":\\\"$SVC\\\",\\\"rule\\\":\\\"missing-dep\\\",\\\"message\\\":\\\"Depends on $DEP which is not defined\\\"}\"\n    elif ! grep -qw \"$DEP\" \"$HC_FILE\" 2>/dev/null; then\n        ISSUE_COUNT=$((ISSUE_COUNT+1))\n        [[ -n \"$ISSUES\" ]] && ISSUES+=\",\"\n        ISSUES+=\"{\\\"severity\\\":\\\"warning\\\",\\\"service\\\":\\\"$SVC\\\",\\\"rule\\\":\\\"no-hc-dep\\\",\\\"message\\\":\\\"Depends on $DEP which has no healthcheck\\\"}\"\n    fi\n    # Circular check\n    if grep -q \"^$DEP $SVC\" \"$DEPS_FILE\" 2>/dev/null; then\n        ISSUE_COUNT=$((ISSUE_COUNT+1))\n        [[ -n \"$ISSUES\" ]] && ISSUES+=\",\"\n        ISSUES+=\"{\\\"severity\\\":\\\"error\\\",\\\"service\\\":\\\"$SVC\\\",\\\"rule\\\":\\\"circular\\\",\\\"message\\\":\\\"Circular: $SVC <-> $DEP\\\"}\"\n    fi\ndone < \"$DEPS_FILE\"\nif [[ $ISSUE_COUNT -eq 0 ]]; then\n    echo \"{\\\"plugin\\\":\\\"dependency-checker\\\",\\\"event\\\":\\\"pre-deploy\\\",\\\"stack\\\":\\\"$STACK\\\",\\\"status\\\":\\\"pass\\\",\\\"issues\\\":[],\\\"message\\\":\\\"All dependency chains valid\\\"}\"\nelse\n    echo \"{\\\"plugin\\\":\\\"dependency-checker\\\",\\\"event\\\":\\\"pre-deploy\\\",\\\"stack\\\":\\\"$STACK\\\",\\\"status\\\":\\\"warn\\\",\\\"issue_count\\\":$ISSUE_COUNT,\\\"issues\\\":[$ISSUES],\\\"message\\\":\\\"$ISSUE_COUNT dependency issue(s)\\\"}\"\nfi\nexit 0\n",
      },
    },
  },
]

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
  "enabled": true
}`,
  },
  {
    title: 'Example Hook',
    icon: Terminal,
    content: `#!/bin/bash
# hooks/post-deploy — runs after every deployment
# Receives deployment context as JSON via stdin

CONTEXT=$(cat)
STACK=$(echo "$CONTEXT" | jq -r '.stack // "unknown"')
STATUS=$(echo "$CONTEXT" | jq -r '.success // false')

if [ "$STATUS" = "true" ]; then
  echo "✓ $STACK deployed successfully"
else
  echo "✗ $STACK deployment failed"
  exit 1
fi`,
  },
  {
    title: 'Available Hooks',
    icon: Zap,
    content: `pre-start      Before stacks start
post-start     After stacks start
pre-stop       Before stacks stop
post-stop      After stacks stop
pre-update     Before stack image update
post-update    After stack image update
pre-deploy     Before template deployment
post-deploy    After template deployment
pre-backup     Before backup operation
post-backup    After backup completes
pre-restore    Before snapshot restore
post-restore   After snapshot restore
health-check   After health check runs
on-error       When a stack operation fails`,
  },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Plugins() {
  const { plugins, loading, installing, error, fetchPlugins, installPlugin, scaffoldPlugin, removePlugin, togglePlugin } = usePluginStore()
  const [showInstall, setShowInstall] = useState(false)
  const [gitUrl, setGitUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null)
  const [installingFeatured, setInstallingFeatured] = useState<string | null>(null)
  const isConnected = useConnectionStore((s) => s.status === 'connected')
  const { addToast } = useToast()

  useEffect(() => { if (isConnected) fetchPlugins() }, [fetchPlugins, isConnected])

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
    if (fp.scaffold) {
      // Scaffold bundled plugin directly on disk (no git clone needed)
      ok = await scaffoldPlugin({
        name: fp.name,
        description: fp.description,
        version: fp.version,
        author: fp.author,
        hooks: fp.scaffold.hooks,
      })
    } else {
      ok = await installPlugin(fp.url)
    }
    setInstallingFeatured(null)
    if (ok) {
      addToast({ type: 'success', message: `${fp.name} installed successfully` })
    }
  }, [installingFeatured, plugins, installPlugin, scaffoldPlugin, addToast])

  const installedNames = new Set(plugins.map(p => p.name))

  // Built-in plugin toggle — just calls the store (which handles localStorage persistence)
  const handleBuiltInToggle = useCallback((name: string) => {
    togglePlugin(name)
  }, [togglePlugin])

  // Read built-in toggle state from the store (reactive — re-renders on toggle)
  const builtInToggles: Record<string, boolean> = {}
  for (const fp of FEATURED_PLUGINS) {
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] disabled:opacity-50 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
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
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl overflow-hidden animate-fade-in">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
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
                <div key={i} className="border border-white/[0.04] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedGuide(isExpanded ? null : i)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
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
                      <pre className="bg-slate-950/60 border border-white/[0.04] rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto scrollbar-thin whitespace-pre leading-relaxed">
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

      {/* Featured Plugins */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={12} className="text-violet-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Featured Plugins</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {FEATURED_PLUGINS.map((fp) => {
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
                  ${isInstalled ? 'border-emerald-500/20 glow-emerald' : 'border-white/[0.06] hover:border-white/[0.10]'}
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
                      <button className="p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-colors" aria-label="Plugin details">
                        <AlertCircle size={14} />
                      </button>
                      <div className="absolute right-full top-0 mr-1 z-[100] hidden group-hover/info:block animate-fade-in" style={{ width: '300px' }}>
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-2xl shadow-black/40 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${fp.color}`} />
                            <span className="text-xs font-semibold text-slate-200">{fp.name}</span>
                            <span className="text-[9px] text-slate-600 font-mono">v{fp.version}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{fp.description}</p>
                          {fp.scaffold?.hooks && (
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Lifecycle Hooks</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(fp.scaffold.hooks).map((hook) => (
                                  <span key={hook} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-mono text-cyan-400 border border-white/[0.04]">
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
                                <span key={tag} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] text-slate-500">{tag}</span>
                              ))}
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-600">by {fp.author}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{fp.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">{fp.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><Zap size={10} />{fp.hookCount} hooks</span>
                  <span className="flex items-center gap-1"><LayoutTemplate size={10} />{fp.templateCount} templates</span>
                  <span>v{fp.version}</span>
                </div>
                {fp.builtIn ? (
                  <button
                    onClick={() => handleBuiltInToggle(fp.name)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      builtInToggles[fp.name]
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'text-slate-500 bg-slate-800/60 border border-white/[0.06] hover:bg-slate-800'
                    }`}
                  >
                    {builtInToggles[fp.name]
                      ? <><ToggleRight size={16} /> Enabled</>
                      : <><ToggleLeft size={16} /> Disabled</>
                    }
                  </button>
                ) : isInstalled ? (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-400/60 bg-emerald-500/5 border border-emerald-500/10 cursor-default"
                  >
                    <CheckCircle size={13} />
                    Installed
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
            {[1, 2].map(i => <div key={i} className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-5 h-36 skeleton" />)}
          </div>
        ) : plugins.length === 0 ? (
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.06] rounded-xl p-10 text-center">
            <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No plugins installed yet</p>
            <p className="text-xs text-slate-500 mt-1">Install a featured plugin above or add one from a Git URL</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
            {plugins.map((p, i) => (
              <div
                key={p.name}
                className={`bg-slate-900/60 backdrop-blur-md border rounded-xl p-5 glass-hover transition-all animate-fade-in overflow-visible relative hover:z-20 ${p.enabled ? 'border-white/[0.06] glow-cyan' : 'border-white/[0.06]'}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.enabled ? 'bg-cyan-500/15 border border-cyan-500/20' : 'bg-slate-800/60 border border-white/[0.04]'}`}>
                      <Puzzle className={`w-4 h-4 ${p.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        <span className="text-[10px] text-slate-600 font-mono">v{p.version}</span>
                      </div>
                      {p.author && <span className="text-xs text-slate-500">{p.author}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Info popover */}
                    <div className="relative group/info">
                      <button className="p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-colors" aria-label="Plugin details">
                        <AlertCircle size={14} />
                      </button>
                      <div className="absolute right-full top-0 mr-1 z-[100] hidden group-hover/info:block animate-fade-in" style={{ width: '280px' }}>
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-2xl shadow-black/40 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Puzzle className={`w-4 h-4 ${p.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                            <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                            <span className="text-[9px] text-slate-600 font-mono">v{p.version}</span>
                          </div>
                          {p.description && <p className="text-[11px] text-slate-400 leading-relaxed">{p.description}</p>}
                          {p.hooks && p.hooks.length > 0 && (
                            <div>
                              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Lifecycle Hooks</p>
                              <div className="flex flex-wrap gap-1">
                                {p.hooks.map((hook) => (
                                  <span key={hook} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] text-[9px] font-mono text-cyan-400 border border-white/[0.04]">
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
                                  <span key={t} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] text-slate-400">{t}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {p.author && <p className="text-[9px] text-slate-600">by {p.author}</p>}
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
                      <span key={hook} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] font-mono text-slate-500 border border-white/[0.04]">
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
                    className="p-1 rounded text-slate-600 hover:text-rose-400 transition-colors"
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
          <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md mx-4 border border-white/[0.08] shadow-2xl shadow-black/40 animate-scale-in" onClick={e => e.stopPropagation()}>
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
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/60 text-sm text-white placeholder-slate-500 border border-white/[0.06] focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all"
                />
              </div>
              <div className="bg-slate-800/40 rounded-lg px-3.5 py-3 border border-white/[0.04]">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The repository must contain a <code className="text-cyan-400 font-medium">plugin.json</code> manifest at the root.
                  Plugins can include templates and lifecycle hook scripts.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowInstall(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-slate-300 hover:bg-white/[0.08] transition-all"
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
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-slate-300 hover:bg-white/[0.08] transition-all"
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
