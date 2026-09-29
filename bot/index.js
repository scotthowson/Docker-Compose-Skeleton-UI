// =============================================================================
// DCS Discord bot — slash commands for a DCS Orchestrator server
// =============================================================================
// Separate from notifications (those go out through the webhook the API posts
// to). This bot signs in to the DCS API with its own user and answers slash
// commands with embeds and buttons. Commands that change the server are
// limited to the Discord user IDs in DISCORD_ADMIN_IDS and the role IDs in
// DISCORD_ADMIN_ROLE_IDS, and every destructive one asks for confirmation.
// Setup guide: docs/DISCORD.md in the DCS repository.
// =============================================================================

import { Client, GatewayIntentBits, REST, Routes, MessageFlags, Events, ActivityType } from 'discord.js'
import { createApi, ApiError } from './lib/api.js'
import { definitions, handlers, handleButton, autocomplete, presence, ADMIN_COMMANDS } from './lib/commands.js'
import { takeConfirmation, peekConfirmation } from './lib/components.js'
import { embed, result, COLORS } from './lib/format.js'

const env = (k, d = '') => (process.env[k] ?? d).trim()
const list = (k) => new Set(env(k).split(/[,\s]+/).filter(Boolean))
const TOKEN = env('DISCORD_BOT_TOKEN')
const GUILD = env('DISCORD_GUILD_ID')
const ADMINS = list('DISCORD_ADMIN_IDS')
const ADMIN_ROLES = list('DISCORD_ADMIN_ROLE_IDS')
const CHANNELS = list('DISCORD_CHANNEL_IDS')
const NAME = env('DCS_SERVER_NAME', 'DCS')
const DASHBOARD = env('DCS_DASHBOARD_URL').replace(/\/$/, '')
const API_URL = env('DCS_API_URL', 'http://host.docker.internal:9876')
const USER = env('DCS_BOT_USERNAME')
const PASS = env('DCS_BOT_PASSWORD')

const log = (...a) => console.log(new Date().toISOString(), ...a)
if (!TOKEN || !USER || !PASS) {
  console.error('DISCORD_BOT_TOKEN, DCS_BOT_USERNAME and DCS_BOT_PASSWORD are required (see docs/DISCORD.md)')
  process.exit(1)
}
if (!ADMINS.size && !ADMIN_ROLES.size) log('no DISCORD_ADMIN_IDS or DISCORD_ADMIN_ROLE_IDS set: the bot answers read-only commands only')

const api = createApi({ baseUrl: API_URL, username: USER, password: PASS, log })
let version = ''

function isAdmin(i) {
  if (ADMINS.has(i.user.id)) return true
  if (ADMIN_ROLES.size && i.member?.roles?.cache) return i.member.roles.cache.some((r) => ADMIN_ROLES.has(r.id))
  return false
}
const ctxFor = (i) => ({ api, server: NAME, dashboard: DASHBOARD, version, isAdmin: () => isAdmin(i), log })

async function registerCommands(appId) {
  const rest = new REST().setToken(TOKEN)
  if (GUILD) await rest.put(Routes.applicationGuildCommands(appId, GUILD), { body: definitions })
  else await rest.put(Routes.applicationCommands(appId), { body: definitions })
  log(`registered ${definitions.length} commands${GUILD ? ` in guild ${GUILD}` : ' globally (allow up to an hour to appear)'}`)
}

// ---------------------------------------------------------------------------
// Discord client
// ---------------------------------------------------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] })

async function refreshPresence() {
  if (!client.user) return
  try {
    const p = await presence(ctxFor({ user: { id: '' } }))
    client.user.setPresence({ activities: [{ name: p.text, type: ActivityType.Watching }], status: p.status })
  } catch (e) {
    client.user.setPresence({ activities: [{ name: 'DCS unreachable · /status', type: ActivityType.Watching }], status: 'idle' })
  }
}

client.once(Events.ClientReady ?? 'ready', async (c) => {
  log(`signed in to Discord as ${c.user.tag}`)
  try { await api.login(); version = await api.version() } catch (e) { console.error('DCS login failed:', e.message) }
  try { await registerCommands(c.user.id) } catch (e) { console.error('command registration failed:', e.message) }
  await refreshPresence()
  setInterval(refreshPresence, 60000)
})

client.on(Events.InteractionCreate, async (i) => {
  const ctx = ctxFor(i)
  try {
    // The bot lives in the channels you list (DISCORD_CHANNEL_IDS); elsewhere it stays quiet
    const allowedHere = !CHANNELS.size || CHANNELS.has(i.channelId)
    if (i.isAutocomplete()) return await (allowedHere ? autocomplete(ctx, i) : i.respond([]))
    if (i.isButton()) {
      if (!allowedHere) return i.reply({ content: `I only work in ${[...CHANNELS].map((c) => `<#${c}>`).join(', ')}.`, flags: MessageFlags.Ephemeral })
      const [kind, id] = i.customId.split(':')
      if (kind === 'confirm' || kind === 'cancel') {
        const pending = peekConfirmation(id)
        if (!pending) return i.update({ embeds: [embed(ctx, { description: '⌛ That confirmation expired. Run the command again.', color: COLORS.slate })], components: [] })
        if (pending.userId !== i.user.id) return i.reply({ content: 'Only the person who asked can confirm this.', flags: MessageFlags.Ephemeral })
        const p = takeConfirmation(id)
        if (kind === 'cancel') return i.update({ embeds: [embed(ctx, { description: '❎ Cancelled, nothing changed.', color: COLORS.slate })], components: [] })
        await i.update({ embeds: [embed(ctx, { description: `⏳ ${p.label}…`, color: COLORS.info })], components: [] })
        return await p.run(i)
      }
      version = await api.version().catch(() => version)
      return await handleButton(ctx, i)
    }
    if (!i.isChatInputCommand()) return
    if (!allowedHere) {
      return i.reply({ content: `I only answer in ${[...CHANNELS].map((c) => `<#${c}>`).join(', ')} — run that there.`, flags: MessageFlags.Ephemeral })
    }
    const h = handlers[i.commandName]
    if (!h) return
    version = await api.version().catch(() => version)
    log(`/${i.commandName} by ${i.user.tag}${ADMIN_COMMANDS.has(i.commandName) ? (isAdmin(i) ? ' (admin)' : ' (denied)') : ''}`)
    await h(ctx, i)
  } catch (e) {
    const friendly = e instanceof ApiError ? e.message : `Something went wrong: ${e.message}`
    console.error(`${i.commandName || i.customId || 'interaction'} failed:`, e.stack || e.message)
    const payload = { embeds: [result(ctx, false, friendly)], components: [] }
    try {
      if (i.isAutocomplete?.()) return
      if (i.deferred || i.replied) await i.editReply(payload)
      else await i.reply({ ...payload, flags: MessageFlags.Ephemeral })
    } catch { /* nothing more to do */ }
  }
})

process.on('unhandledRejection', (e) => console.error('unhandled:', e?.stack || e))
client.login(TOKEN)
