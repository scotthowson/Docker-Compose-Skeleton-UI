// =============================================================================
// useComposeLinter — Real-time client-side Docker Compose linter
// Parses YAML structure and applies 12 lint rules with line-level diagnostics
// =============================================================================

import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LintDiagnostic {
  line: number
  severity: 'error' | 'warning' | 'info'
  message: string
  rule: string
  fix?: string
}

interface ParsedService {
  name: string
  startLine: number
  endLine: number
  image?: { value: string; line: number }
  ports: { raw: string; host: number; container: number; bindAddress?: string; line: number }[]
  restart?: { value: string; line: number }
  privileged?: { value: boolean; line: number }
  healthcheck?: { line: number }
  networkMode?: { value: string; line: number }
  memLimit?: { line: number }
  deployLimits?: { line: number }
  envVars: { name: string; line: number }[]
  volumes: { raw: string; line: number }[]
  capAdd: { value: string; line: number }[]
  user?: { line: number }
  logging?: { line: number }
  readOnly?: { line: number }
  tmpfs?: { line: number }
  securityOpt: { value: string; line: number }[]
  labels: { key: string; line: number }[]
  depends?: { line: number }
  build?: { line: number }
  containerName?: { value: string; line: number }
}

// ---------------------------------------------------------------------------
// YAML-ish parser for docker-compose files
// Not a full YAML parser — optimized for compose structure
// ---------------------------------------------------------------------------

function parseComposeServices(content: string): {
  services: ParsedService[]
  topLevelKeys: { key: string; line: number }[]
} {
  const lines = content.split('\n')
  const services: ParsedService[] = []
  const topLevelKeys: { key: string; line: number }[] = []

  let inServices = false
  let currentService: ParsedService | null = null
  let currentKey = '' // Track nested keys within a service
  let servicesIndent = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue

    // Top-level key (no indent)
    if (indent === 0 && trimmed.includes(':')) {
      const key = trimmed.split(':')[0].trim()
      topLevelKeys.push({ key, line: i + 1 })

      if (key === 'services') {
        inServices = true
        servicesIndent = 0
        continue
      } else {
        // Leaving services block
        if (inServices && currentService) {
          currentService.endLine = i
          services.push(currentService)
          currentService = null
        }
        inServices = false
      }
      continue
    }

    if (!inServices) continue

    // Service name (typically 2-space indent under services)
    if (indent === 2 && trimmed.includes(':') && !trimmed.startsWith('-')) {
      // Save previous service
      if (currentService) {
        currentService.endLine = i
        services.push(currentService)
      }

      const name = trimmed.split(':')[0].trim()
      currentService = {
        name,
        startLine: i + 1,
        endLine: i + 1,
        ports: [],
        envVars: [],
        volumes: [],
        capAdd: [],
        securityOpt: [],
        labels: [],
      }
      currentKey = ''
      continue
    }

    if (!currentService) continue

    // Service-level key (typically 4-space indent)
    if (indent === 4 && trimmed.includes(':') && !trimmed.startsWith('-')) {
      const keyPart = trimmed.split(':')[0].trim()
      const valuePart = trimmed.slice(trimmed.indexOf(':') + 1).trim()
      currentKey = keyPart

      switch (keyPart) {
        case 'image':
          currentService.image = { value: valuePart, line: i + 1 }
          break
        case 'restart':
          currentService.restart = { value: valuePart, line: i + 1 }
          break
        case 'privileged':
          currentService.privileged = { value: valuePart === 'true', line: i + 1 }
          break
        case 'healthcheck':
          currentService.healthcheck = { line: i + 1 }
          break
        case 'network_mode':
          currentService.networkMode = { value: valuePart, line: i + 1 }
          break
        case 'mem_limit':
        case 'memswap_limit':
          currentService.memLimit = { line: i + 1 }
          break
        case 'shm_size':
          currentService.memLimit = { line: i + 1 }
          break
        case 'user':
          currentService.user = { line: i + 1 }
          break
        case 'logging':
          currentService.logging = { line: i + 1 }
          break
        case 'read_only':
          currentService.readOnly = { line: i + 1 }
          break
        case 'tmpfs':
          currentService.tmpfs = { line: i + 1 }
          break
        case 'depends_on':
          currentService.depends = { line: i + 1 }
          break
        case 'build':
          currentService.build = { line: i + 1 }
          break
        case 'container_name':
          currentService.containerName = { value: valuePart, line: i + 1 }
          break
      }
      continue
    }

    // Nested under deploy.resources.limits
    if (currentKey === 'deploy' || trimmed.startsWith('resources:') || trimmed.startsWith('limits:')) {
      if (trimmed.startsWith('memory:') || trimmed.startsWith('cpus:')) {
        currentService.deployLimits = { line: i + 1 }
      }
    }

    // List items under ports/environment/volumes/cap_add
    if (trimmed.startsWith('-')) {
      const val = trimmed.slice(1).trim().replace(/['"]/g, '')

      if (currentKey === 'ports') {
        // Handle formats: "80:80", "8080:80", "127.0.0.1:80:80", "80:80/tcp", "80"
        const portMatch = val.match(/^(?:(\d+\.\d+\.\d+\.\d+):)?(\d+):(\d+)(?:\/\w+)?$/)
        if (portMatch) {
          currentService.ports.push({
            raw: val,
            host: parseInt(portMatch[2]),
            container: parseInt(portMatch[3]),
            bindAddress: portMatch[1] || undefined,
            line: i + 1,
          })
        }
      } else if (currentKey === 'environment') {
        // Direct value: - KEY=value
        const envMatch = val.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
        if (envMatch) {
          currentService.envVars.push({ name: envMatch[1], line: i + 1 })
        }
      } else if (currentKey === 'volumes') {
        currentService.volumes.push({ raw: val, line: i + 1 })
      } else if (currentKey === 'cap_add') {
        currentService.capAdd.push({ value: val, line: i + 1 })
      } else if (currentKey === 'security_opt') {
        currentService.securityOpt.push({ value: val, line: i + 1 })
      } else if (currentKey === 'labels') {
        const labelMatch = val.match(/^([^=]+)=/)
        if (labelMatch) currentService.labels.push({ key: labelMatch[1].trim(), line: i + 1 })
      }
    }

    // Detect ${VAR} references anywhere in the service
    const varRefs = trimmed.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)
    for (const match of varRefs) {
      currentService.envVars.push({ name: match[1], line: i + 1 })
    }
  }

  // Finalize last service
  if (currentService) {
    currentService.endLine = lines.length
    services.push(currentService)
  }

  return { services, topLevelKeys }
}

// ---------------------------------------------------------------------------
// Lint Rules
// ---------------------------------------------------------------------------

function lintCompose(content: string, envKeys?: Set<string>): LintDiagnostic[] {
  if (!content.trim()) return []

  const diagnostics: LintDiagnostic[] = []
  const { services, topLevelKeys } = parseComposeServices(content)

  // ── Rule: deprecated-version ──
  const versionKey = topLevelKeys.find((k) => k.key === 'version')
  if (versionKey) {
    diagnostics.push({
      line: versionKey.line,
      severity: 'info',
      message: 'The top-level "version" key is deprecated in Compose v2+ and can be removed.',
      rule: 'deprecated-version',
      fix: 'Remove the version key — Docker Compose v2 ignores it.',
    })
  }

  // ── Rule: no-services ──
  if (services.length === 0 && content.trim().length > 10) {
    diagnostics.push({
      line: 1,
      severity: 'error',
      message: 'No services defined. A compose file must have a "services:" section.',
      rule: 'no-services',
    })
    return diagnostics
  }

  // Port conflict detection (across all services)
  const portMap = new Map<number, { service: string; line: number }[]>()

  for (const svc of services) {
    // Collect ports for cross-service conflict check
    for (const port of svc.ports) {
      const existing = portMap.get(port.host) || []
      existing.push({ service: svc.name, line: port.line })
      portMap.set(port.host, existing)
    }

    // ── Rule: no-restart-policy ──
    if (!svc.restart) {
      diagnostics.push({
        line: svc.startLine,
        severity: 'warning',
        message: `Service "${svc.name}" has no restart policy. Containers won't auto-restart after crashes or reboots.`,
        rule: 'no-restart-policy',
        fix: 'Add: restart: unless-stopped',
      })
    }

    // ── Rule: privileged-container ──
    if (svc.privileged?.value) {
      diagnostics.push({
        line: svc.privileged.line,
        severity: 'warning',
        message: `Service "${svc.name}" runs in privileged mode. This grants full host access and is a security risk.`,
        rule: 'privileged-container',
        fix: 'Use specific capabilities via cap_add instead of privileged: true.',
      })
    }

    // ── Rule: latest-tag ──
    if (svc.image) {
      const img = svc.image.value
      if (img && !img.includes(':')) {
        diagnostics.push({
          line: svc.image.line,
          severity: 'info',
          message: `Service "${svc.name}" uses image "${img}" without a tag. This defaults to :latest which may cause unexpected updates.`,
          rule: 'latest-tag',
          fix: `Pin to a specific version: ${img}:<version>`,
        })
      } else if (img.endsWith(':latest')) {
        diagnostics.push({
          line: svc.image.line,
          severity: 'info',
          message: `Service "${svc.name}" uses the :latest tag. Consider pinning to a specific version for reproducibility.`,
          rule: 'latest-tag',
          fix: `Pin to a specific version instead of :latest`,
        })
      }
    }

    // ── Rule: no-healthcheck ──
    if (!svc.healthcheck && svc.ports.length > 0) {
      diagnostics.push({
        line: svc.startLine,
        severity: 'info',
        message: `Service "${svc.name}" exposes ports but has no healthcheck. Docker can't determine if the service is actually healthy.`,
        rule: 'no-healthcheck',
        fix: 'Add a healthcheck block to enable health monitoring.',
      })
    }

    // ── Rule: host-network ──
    if (svc.networkMode?.value === 'host') {
      diagnostics.push({
        line: svc.networkMode.line,
        severity: 'warning',
        message: `Service "${svc.name}" uses host network mode. This bypasses Docker network isolation.`,
        rule: 'host-network',
      })
    }

    // ── Rule: no-resource-limits ──
    if (!svc.memLimit && !svc.deployLimits) {
      diagnostics.push({
        line: svc.startLine,
        severity: 'info',
        message: `Service "${svc.name}" has no memory limits. A runaway container could consume all system memory.`,
        rule: 'no-resource-limits',
        fix: 'Add mem_limit or deploy.resources.limits.memory.',
      })
    }

    // ── Rule: cap-add-all ──
    const hasCapAll = svc.capAdd.find((c) => c.value === 'ALL')
    if (hasCapAll) {
      diagnostics.push({
        line: hasCapAll.line,
        severity: 'warning',
        message: `Service "${svc.name}" grants ALL Linux capabilities. This is equivalent to privileged mode.`,
        rule: 'cap-add-all',
        fix: 'Grant only the specific capabilities needed.',
      })
    }

    // ── Rule: env-undefined ──
    if (envKeys) {
      // Common variables inherited from root .env or system — skip these
      const INHERITED_VARS = new Set([
        'TZ', 'PUID', 'PGID', 'DOCKER_HOST', 'COMPOSE_PROJECT_NAME',
        'APP_DATA_DIR', 'PROXY_DOMAIN', 'SERVER_NAME', 'NTFY_URL',
        'HOME', 'USER', 'PATH', 'HOSTNAME', 'LANG',
      ])
      for (const envVar of svc.envVars) {
        if (envVar.name.startsWith('$')) continue // Skip malformed
        if (INHERITED_VARS.has(envVar.name)) continue // Skip common inherited vars
        if (!envKeys.has(envVar.name)) {
          diagnostics.push({
            line: envVar.line,
            severity: 'warning',
            message: `Variable \${${envVar.name}} is referenced but not defined in this stack's .env file.`,
            rule: 'env-undefined',
            fix: `Add ${envVar.name}=<value> to the .env file, or verify it's set in the root .env.`,
          })
        }
      }
    }

    // ── Rule: duplicate-port (within same service) ──
    const seenPorts = new Set<number>()
    for (const port of svc.ports) {
      if (seenPorts.has(port.host)) {
        diagnostics.push({
          line: port.line,
          severity: 'error',
          message: `Port ${port.host} is mapped twice in service "${svc.name}".`,
          rule: 'duplicate-port',
        })
      }
      seenPorts.add(port.host)
    }

    // ── Rule: unbound-port ──
    for (const port of svc.ports) {
      if (!port.bindAddress) {
        diagnostics.push({
          line: port.line,
          severity: 'warning',
          message: `Service "${svc.name}": Port ${port.host}:${port.container} is exposed on all interfaces (0.0.0.0). This makes the service accessible from any network.`,
          rule: 'unbound-port',
          fix: `Bind to localhost: 127.0.0.1:${port.host}:${port.container}`,
        })
      }
    }

    // ── Rule: no-user ──
    if (!svc.user && svc.privileged?.value !== true) {
      diagnostics.push({
        line: svc.startLine,
        severity: 'info',
        message: `Service "${svc.name}" runs as root (no user: directive). Consider running as a non-root user for security.`,
        rule: 'no-user',
        fix: 'Add: user: "1000:1000" (or use PUID/PGID)',
      })
    }

    // ── Rule: no-logging ──
    if (!svc.logging) {
      diagnostics.push({
        line: svc.startLine,
        severity: 'info',
        message: `Service "${svc.name}" has no logging driver configured. Logs will use the default driver and may grow unbounded.`,
        rule: 'no-logging',
        fix: 'Add logging with max-size: logging: { driver: json-file, options: { max-size: 10m, max-file: 3 } }',
      })
    }

    // ── Rule: build-in-production ──
    if (svc.build) {
      diagnostics.push({
        line: svc.build.line,
        severity: 'warning',
        message: `Service "${svc.name}" uses "build:" which rebuilds from source. In production, use pre-built images instead.`,
        rule: 'build-in-production',
        fix: 'Replace build: with image: pointing to a pre-built registry image.',
      })
    }

    // ── Rule: container-name ──
    if (svc.containerName) {
      diagnostics.push({
        line: svc.containerName.line,
        severity: 'info',
        message: `Service "${svc.name}" has a fixed container_name. This prevents scaling and may cause name conflicts.`,
        rule: 'fixed-container-name',
        fix: 'Remove container_name to let Compose generate unique names.',
      })
    }

    // ── Rule: volume-host-path ──
    for (const vol of svc.volumes) {
      if (vol.raw.startsWith('/') && vol.raw.includes(':')) {
        const hostPath = vol.raw.split(':')[0]
        if (hostPath === '/' || hostPath === '/etc' || hostPath === '/var' || hostPath === '/usr') {
          diagnostics.push({
            line: vol.line,
            severity: 'warning',
            message: `Service "${svc.name}" mounts critical system path "${hostPath}". This is a security risk.`,
            rule: 'sensitive-mount',
            fix: 'Mount only specific subdirectories instead of system root paths.',
          })
        }
      }
      // Docker socket mount
      if (vol.raw.includes('/var/run/docker.sock')) {
        diagnostics.push({
          line: vol.line,
          severity: 'warning',
          message: `Service "${svc.name}" mounts the Docker socket. This grants full control over the Docker daemon.`,
          rule: 'docker-socket-mount',
          fix: 'Use a Docker socket proxy (like tecnativa/docker-socket-proxy) to limit access.',
        })
      }
    }
  }

  // ── Rule: port-conflict (across services) ──
  for (const [port, users] of portMap) {
    if (users.length > 1) {
      for (const user of users) {
        const others = users.filter((u) => u.service !== user.service).map((u) => u.service)
        if (others.length > 0) {
          diagnostics.push({
            line: user.line,
            severity: 'error',
            message: `Port ${port} conflicts — also used by ${others.join(', ')}. Only one service can bind to a host port.`,
            rule: 'port-conflict',
            fix: 'Change the host port for one of the conflicting services.',
          })
        }
      }
    }
  }

  // Sort by line number, then severity (error > warning > info)
  const severityOrder = { error: 0, warning: 1, info: 2 }
  diagnostics.sort((a, b) => a.line - b.line || severityOrder[a.severity] - severityOrder[b.severity])

  // Deduplicate (same line + same rule)
  const seen = new Set<string>()
  return diagnostics.filter((d) => {
    const key = `${d.line}:${d.rule}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------
// Env Validator
// ---------------------------------------------------------------------------

export interface EnvDiagnostic {
  line: number
  severity: 'error' | 'warning' | 'info'
  message: string
  rule: string
}

function lintEnv(envContent: string, composeContent?: string): EnvDiagnostic[] {
  if (!envContent.trim()) return []

  const diagnostics: EnvDiagnostic[] = []
  const lines = envContent.split('\n')
  const definedKeys = new Set<string>()
  const keyLines = new Map<string, number[]>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) {
      diagnostics.push({
        line: i + 1,
        severity: 'error',
        message: 'Invalid line — expected KEY=VALUE format.',
        rule: 'invalid-format',
      })
      continue
    }

    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1)

    // Validate key format
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      diagnostics.push({
        line: i + 1,
        severity: 'error',
        message: `Invalid key "${key}" — must start with a letter/underscore and contain only alphanumeric/underscore.`,
        rule: 'invalid-key',
      })
      continue
    }

    // Track duplicates
    const existing = keyLines.get(key) || []
    existing.push(i + 1)
    keyLines.set(key, existing)
    definedKeys.add(key)

    // Empty value warning
    if (!value.trim()) {
      diagnostics.push({
        line: i + 1,
        severity: 'warning',
        message: `Variable "${key}" has an empty value.`,
        rule: 'empty-value',
      })
    }

    // Sensitive value exposure
    const sensitive = /^(password|secret|token|api_key|private_key|db_pass)/i
    if (sensitive.test(key) && value.trim() && !value.includes('${')) {
      diagnostics.push({
        line: i + 1,
        severity: 'info',
        message: `"${key}" appears to contain a sensitive value. Consider using Docker secrets or a vault.`,
        rule: 'sensitive-value',
      })
    }
  }

  // Duplicate key detection
  for (const [key, lineNums] of keyLines) {
    if (lineNums.length > 1) {
      for (const ln of lineNums.slice(1)) {
        diagnostics.push({
          line: ln,
          severity: 'warning',
          message: `Duplicate key "${key}" — also defined on line ${lineNums[0]}. The last value wins.`,
          rule: 'duplicate-key',
        })
      }
    }
  }

  // Cross-reference with compose file — find unused variables
  if (composeContent) {
    for (const key of definedKeys) {
      // Check if the key is referenced anywhere in compose (as ${KEY} or $KEY)
      if (!composeContent.includes(`\${${key}}`) && !composeContent.includes(`$${key}`)) {
        const ln = keyLines.get(key)?.[0] ?? 1
        diagnostics.push({
          line: ln,
          severity: 'info',
          message: `Variable "${key}" is defined but not referenced in the compose file.`,
          rule: 'unused-variable',
        })
      }
    }
  }

  diagnostics.sort((a, b) => a.line - b.line)
  return diagnostics
}

// ---------------------------------------------------------------------------
// React Hooks
// ---------------------------------------------------------------------------

/** Real-time compose linter hook — runs on every content change */
export function useComposeLinter(content: string | undefined, envContent?: string) {
  return useMemo(() => {
    if (!content) return { diagnostics: [], counts: { errors: 0, warnings: 0, info: 0 } }

    const envKeys = envContent
      ? new Set(
          envContent.split('\n')
            .filter((l) => l.trim() && !l.trim().startsWith('#'))
            .map((l) => l.split('=')[0]?.trim())
            .filter(Boolean),
        )
      : undefined

    const diagnostics = lintCompose(content, envKeys)
    const counts = {
      errors: diagnostics.filter((d) => d.severity === 'error').length,
      warnings: diagnostics.filter((d) => d.severity === 'warning').length,
      info: diagnostics.filter((d) => d.severity === 'info').length,
    }

    return { diagnostics, counts }
  }, [content, envContent])
}

/** Real-time env validator hook */
export function useEnvLinter(envContent: string | undefined, composeContent?: string) {
  return useMemo(() => {
    if (!envContent) return { diagnostics: [], counts: { errors: 0, warnings: 0, info: 0 } }

    const diagnostics = lintEnv(envContent, composeContent)
    const counts = {
      errors: diagnostics.filter((d) => d.severity === 'error').length,
      warnings: diagnostics.filter((d) => d.severity === 'warning').length,
      info: diagnostics.filter((d) => d.severity === 'info').length,
    }

    return { diagnostics, counts }
  }, [envContent, composeContent])
}

// Re-export for direct use
export { lintCompose, lintEnv }
