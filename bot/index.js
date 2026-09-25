// =============================================================================
// DCS Discord bot — slash commands for a Docker Compose Skeleton server
// =============================================================================
// Separate from notifications (those go out through the webhook the API
// posts to). This bot signs in to the DCS API with its own user and answers
// commands: /status, /usage, /containers, /container, /stack, /stacks,
// /updates, /health. Commands that change state are limited to Discord user
// IDs listed in DISCORD_ADMIN_IDS.
// =============================================================================

import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js'

const env = (k, d = '') => (process.env[k] ?? d).trim()
const TOKEN = env('DISCORD_BOT_TOKEN')
const GUILD = env('DISCORD_GUILD_ID')
const API = env('DCS_API_URL', 'http://host.docker.internal:9876').replace(/\/$/, '')
const USER = env('DCS_BOT_USERNAME')
const PASS = env('DCS_BOT_PASSWORD')
const ADMINS = new Set(env('DISCORD_ADMIN_IDS').split(/[,\s]+/).filter(Boolean))
const NAME = env('DCS_SERVER_NAME', 'DCS')
const DASHBOARD = env('DCS_DASHBOARD_URL')

if (!TOKEN || !USER || !PASS) {
  console.error('DISCORD_BOT_TOKEN, DCS_BOT_USERNAME and DCS_BOT_PASSWORD are required')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// DCS API client: one session, renewed on 401
// ---------------------------------------------------------------------------
let apiToken = ''
async function login() {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.token) throw new Error(d.message || `login failed (${r.status})`)
  apiToken = d.token
}
async function api(method, path, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!apiToken) await login()
    const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    if (r.status === 401 && attempt === 0) { apiToken = ''; continue }
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.message || `${method} ${path} → ${r.status}`)
    return d
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const COLOR = { ok: 0x34d399, warn: 0xf59e0b, bad: 0xf43f5e, info: 0x22d3ee }
const embed = (title, color = COLOR.info) => {
  const e = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp().setFooter({ text: `${NAME} · DCS Manager` })
  if (DASHBOARD) e.setURL(DASHBOARD)
  return e
}
const bar = (pct, width = 14) => { const n = Math.round(Math.max(0, Math.min(100, pct)) / 100 * width); return '█'.repeat(n) + '░'.repeat(width - n) }
const uptime = (s) => { if (!s || s <= 0) return '—'; const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m` }
const code = (s) => '`' + String(s ?? '').replace(/`/g, "'") + '`'
const isAdmin = (i) => ADMINS.size === 0 ? false : ADMINS.has(i.user.id)
const deny = (i) => i.reply({ content: 'That command changes the server; your Discord account is not in DISCORD_ADMIN_IDS.', flags: MessageFlags.Ephemeral })

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Server overview: containers, stacks, images, load, memory, disk'),
  new SlashCommandBuilder().setName('usage').setDescription('CPU, memory, swap and disk right now'),
  new SlashCommandBuilder().setName('health').setDescription('Which containers are unhealthy, stopped or restarting'),
  new SlashCommandBuilder().setName('containers').setDescription('Every container with its state').addStringOption((o) => o.setName('filter').setDescription('Only names containing this')),
  new SlashCommandBuilder().setName('stacks').setDescription('Every stack and how many containers run'),
  new SlashCommandBuilder().setName('updates').setDescription('Images with a newer version available'),
  new SlashCommandBuilder().setName('container').setDescription('Act on one container')
    .addStringOption((o) => o.setName('name').setDescription('Container name').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
      { name: 'info', value: 'info' }, { name: 'logs', value: 'logs' }, { name: 'start', value: 'start' }, { name: 'stop', value: 'stop' }, { name: 'restart', value: 'restart' }, { name: 'recreate', value: 'recreate' })),
  new SlashCommandBuilder().setName('stack').setDescription('Act on one stack')
    .addStringOption((o) => o.setName('name').setDescription('Stack name').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('action').setDescription('What to do').setRequired(true).addChoices(
      { name: 'info', value: 'info' }, { name: 'start', value: 'start' }, { name: 'stop', value: 'stop' }, { name: 'restart', value: 'restart' }, { name: 'update', value: 'update' })),
].map((c) => c.toJSON())

async function registerCommands(appId) {
  const rest = new REST().setToken(TOKEN)
  if (GUILD) await rest.put(Routes.applicationGuildCommands(appId, GUILD), { body: commands })
  else await rest.put(Routes.applicationCommands(appId), { body: commands })
  console.log(`registered ${commands.length} commands${GUILD ? ` in guild ${GUILD}` : ' globally'}`)
}

const handlers = {
  async status(i) {
    const s = await api('GET', '/status')
    const d = s.docker || {}, sys = s.system || {}
    const mem = sys.memory_mb ? Math.round((sys.memory_mb.total - sys.memory_mb.available) / sys.memory_mb.total * 100) : null
    const e = embed(`${s.hostname || NAME} — status`, (d.containers?.stopped ?? 0) > 0 ? COLOR.warn : COLOR.ok)
      .addFields(
        { name: 'Containers', value: `${d.containers?.running ?? '?'} running · ${d.containers?.stopped ?? 0} stopped`, inline: true },
        { name: 'Stacks', value: `${d.stacks?.running ?? d.stacks ?? '?'}${d.stacks?.total ? ` / ${d.stacks.total}` : ''}`, inline: true },
        { name: 'Images', value: String(d.images ?? '?'), inline: true },
        { name: 'Load', value: (sys.load_average || []).map((n) => Number(n).toFixed(2)).join(' · ') || '—', inline: true },
        { name: 'Memory', value: mem == null ? '—' : `${bar(mem)} ${mem}%`, inline: true },
        { name: 'Disk', value: sys.disk ? `${sys.disk.used} / ${sys.disk.total} (${sys.disk.percent})` : '—', inline: true },
        { name: 'Uptime', value: uptime(s.uptime_seconds), inline: true },
      )
    await i.reply({ embeds: [e] })
  },
  async usage(i) {
    const s = await api('GET', '/status')
    const sys = s.system || {}
    const cpu = Math.min(100, Math.round(((sys.load_average || [0])[0] / (sys.cpu_count || 1)) * 100))
    const mem = sys.memory_mb ? Math.round((sys.memory_mb.total - sys.memory_mb.available) / sys.memory_mb.total * 100) : 0
    const swap = sys.swap_mb?.total ? Math.round((sys.swap_mb.total - sys.swap_mb.free) / sys.swap_mb.total * 100) : null
    const disk = parseInt(String(sys.disk?.percent || '0'), 10) || 0
    const worst = Math.max(cpu, mem, disk)
    const e = embed(`${s.hostname || NAME} — usage`, worst > 90 ? COLOR.bad : worst > 75 ? COLOR.warn : COLOR.ok).setDescription(
      [`**CPU**   ${bar(cpu)} ${cpu}%  (${sys.cpu_count || '?'} cores, load ${(sys.load_average || []).map((n) => Number(n).toFixed(2)).join(' / ')})`,
       `**Memory** ${bar(mem)} ${mem}%  (${sys.memory_mb ? `${Math.round((sys.memory_mb.total - sys.memory_mb.available) / 1024 * 10) / 10} / ${Math.round(sys.memory_mb.total / 1024 * 10) / 10} GB` : '—'})`,
       swap != null ? `**Swap**  ${bar(swap)} ${swap}%` : null,
       `**Disk**  ${bar(disk)} ${disk}%  (${sys.disk?.used || '?'} of ${sys.disk?.total || '?'})`].filter(Boolean).join('\n'))
    await i.reply({ embeds: [e] })
  },
  async health(i) {
    const h = await api('GET', '/health')
    const bad = (h.containers || []).filter((c) => c.status && c.status !== 'healthy' && c.status !== 'running')
    const e = embed(`Health — ${h.status || 'unknown'}`, bad.length ? COLOR.bad : COLOR.ok)
    e.addFields({ name: 'Summary', value: `${h.summary?.healthy ?? '?'} healthy · ${h.summary?.unhealthy ?? 0} unhealthy · ${h.summary?.stopped ?? 0} stopped`, inline: false })
    if (bad.length) e.addFields({ name: 'Needs attention', value: bad.slice(0, 15).map((c) => `${code(c.name)} — ${c.status}${c.message ? ` (${c.message})` : ''}`).join('\n') })
    await i.reply({ embeds: [e] })
  },
  async containers(i) {
    const f = (i.options.getString('filter') || '').toLowerCase()
    const r = await api('GET', '/containers')
    const list = (r.containers || []).filter((c) => !f || c.name.toLowerCase().includes(f)).sort((a, b) => a.name.localeCompare(b.name))
    const lines = list.slice(0, 40).map((c) => `${c.state === 'running' ? (c.health === 'unhealthy' ? '🟠' : '🟢') : '⚫'} ${code(c.name)} ${c.state}${c.health && c.health !== 'none' ? ` · ${c.health}` : ''}${c.state === 'running' ? ` · ${uptime(c.uptime_seconds)}` : ''}`)
    const e = embed(`Containers (${list.length}${f ? ` matching "${f}"` : ''})`).setDescription(lines.join('\n') || 'None')
    if (list.length > 40) e.setFooter({ text: `${list.length - 40} more not shown · ${NAME}` })
    await i.reply({ embeds: [e] })
  },
  async stacks(i) {
    const r = await api('GET', '/stacks')
    const lines = (r.stacks || []).map((s) => `${s.status === 'running' ? '🟢' : '⚫'} ${code(s.name)} ${s.status === 'running' ? `${s.running_containers} running` : 'stopped'}`)
    await i.reply({ embeds: [embed(`Stacks (${(r.stacks || []).length})`).setDescription(lines.join('\n') || 'None')] })
  },
  async updates(i) {
    const r = await api('GET', '/images/check-updates')
    const upd = (r.images || []).filter((im) => im.update_available === true)
    const stale = (r.images || []).filter((im) => im.staleness === 'stale' && im.update_available !== true)
    const e = embed(`Image updates — ${upd.length} available`, upd.length ? COLOR.warn : COLOR.ok)
    if (upd.length) e.addFields({ name: 'Newer version published', value: upd.slice(0, 20).map((im) => `⬆️ ${code(im.image)}${im.containers && im.containers !== '-' ? ` → ${im.containers}` : ''}`).join('\n') })
    if (stale.length) e.addFields({ name: 'Older than 30 days', value: stale.slice(0, 15).map((im) => `🕒 ${code(im.image)} (${im.age_days}d)`).join('\n') })
    if (r.registry_checked_at) e.setFooter({ text: `Registry checked ${new Date(r.registry_checked_at).toLocaleString()} · ${NAME}` })
    await i.reply({ embeds: [e] })
  },
  async container(i) {
    const name = i.options.getString('name'), action = i.options.getString('action')
    if (action === 'info') {
      const c = await api('GET', `/containers/${encodeURIComponent(name)}`)
      const e = embed(code(c.name), c.state === 'running' ? (c.health === 'unhealthy' ? COLOR.bad : COLOR.ok) : COLOR.warn).addFields(
        { name: 'State', value: `${c.state}${c.health && c.health !== 'none' ? ` · ${c.health}` : ''}`, inline: true },
        { name: 'Uptime', value: uptime(c.uptime_seconds), inline: true },
        { name: 'Image', value: code(c.image), inline: false },
        { name: 'Ports', value: c.ports || '—', inline: false },
        { name: 'Stack', value: c.compose_project ? `${c.compose_project} / ${c.compose_service}` : 'not Compose-managed', inline: true },
        { name: 'Restart policy', value: c.restart_policy || '—', inline: true })
      return i.reply({ embeds: [e] })
    }
    if (action === 'logs') {
      const r = await api('GET', `/containers/${encodeURIComponent(name)}/logs?lines=40`)
      const text = (r.logs || r.output || '').toString().split('\n').slice(-40).join('\n').slice(-1800)
      return i.reply({ content: `Last lines of ${code(name)}:\n\`\`\`\n${text || '(empty)'}\n\`\`\``, flags: MessageFlags.Ephemeral })
    }
    if (!isAdmin(i)) return deny(i)
    await i.deferReply()
    const r = await api('POST', `/containers/${encodeURIComponent(name)}/${action}`)
    await i.editReply({ embeds: [embed(`${code(name)} — ${action}`, r.success ? COLOR.ok : COLOR.bad).setDescription(r.success ? `Done.` : `Failed: ${(r.output || '').slice(0, 900) || 'see the dashboard'}`)] })
  },
  async stack(i) {
    const name = i.options.getString('name'), action = i.options.getString('action')
    if (action === 'info') {
      const s = await api('GET', `/stacks/${encodeURIComponent(name)}`)
      const lines = (s.services || []).map((svc) => `${svc.state === 'running' ? '🟢' : '⚫'} ${code(svc.name || svc.service)} ${svc.state || ''}${svc.health && svc.health !== 'none' ? ` · ${svc.health}` : ''}`)
      return i.reply({ embeds: [embed(`Stack ${code(name)} — ${s.status}`, s.status === 'running' ? COLOR.ok : COLOR.warn).setDescription(lines.join('\n') || `${s.running_containers ?? 0} running`)] })
    }
    if (!isAdmin(i)) return deny(i)
    await i.deferReply()
    const r = await api('POST', `/stacks/${encodeURIComponent(name)}/${action}`)
    await i.editReply({ embeds: [embed(`Stack ${code(name)} — ${action}`, r.success ? COLOR.ok : COLOR.bad).setDescription(r.success ? 'Done.' : `Failed: ${(r.output || r.message || '').toString().slice(0, 900) || 'see the dashboard'}`)] })
  },
}

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] })
client.once('ready', async (c) => {
  console.log(`signed in to Discord as ${c.user.tag}`)
  try { await login(); console.log(`signed in to DCS at ${API} as ${USER}`) } catch (e) { console.error('DCS login failed:', e.message) }
  try { await registerCommands(c.user.id) } catch (e) { console.error('command registration failed:', e.message) }
  c.user.setActivity(`${NAME} · /status`)
})
client.on('interactionCreate', async (i) => {
  try {
    if (i.isAutocomplete()) {
      const focused = i.options.getFocused().toLowerCase()
      const names = i.commandName === 'stack'
        ? ((await api('GET', '/stacks')).stacks || []).map((s) => s.name)
        : ((await api('GET', '/containers')).containers || []).map((c) => c.name)
      return i.respond(names.filter((n) => n.toLowerCase().includes(focused)).slice(0, 25).map((n) => ({ name: n, value: n })))
    }
    if (!i.isChatInputCommand()) return
    const h = handlers[i.commandName]
    if (!h) return
    await h(i)
  } catch (e) {
    console.error(`${i.commandName || 'interaction'} failed:`, e.message)
    const msg = { content: `Something went wrong: ${e.message}`, flags: MessageFlags.Ephemeral }
    try { if (i.deferred || i.replied) await i.editReply(msg); else await i.reply(msg) } catch { /* nothing more to do */ }
  }
})
client.login(TOKEN)
