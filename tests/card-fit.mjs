#!/usr/bin/env node
// =============================================================================
// card-fit — does every dashboard card use the height it is given? Each card is put alone on the dashboard at its default height and at a tall one (what a person does when
// they drag its corner in edit mode), and the card is measured:
//   stops short   a list or panel that scrolls (there is more to show) but ends well above the bottom of the card
//   fixed cap     a scrolling list with a max-height in pixels: it would stop there however tall the card is, even if the lab's short lists never reach it
//   void          a chart or picture is the last thing in a tall card and stops more than 30 % of the card above its bottom (it did not scale). Text that is simply complete may leave room: not a fault.
// Plugin cards (sandboxed frames) are measured inside their frame. A card with nothing to show (an empty state) is centred by design and is not judged for a void.
//
// Run it against the lab (tests/lab/lab.sh start), never against a real server:
//   PUPPETEER_DIR=/tmp/dcs-ui-sweep node tests/card-fit.mjs           (CARDS=routes-dns,health-summary narrows it; SHOTS=/dir keeps a picture of every tall card)
// Env: UI (http://localhost:3021), API (http://127.0.0.1:41921), LAB_USER, LAB_PASS, CHROME (/usr/bin/google-chrome), PLUGINS=plugin:name:card,... (extra cards to measure).
// Exit status: 0 when every card passed.
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(process.env.PUPPETEER_DIR ? path.join(path.resolve(process.env.PUPPETEER_DIR), 'package.json') : import.meta.url)
const puppeteer = require('puppeteer-core')
const UI = process.env.UI || 'http://localhost:3021', API = process.env.API || 'http://127.0.0.1:41921'
const USER = process.env.LAB_USER || 'lab', PASS = process.env.LAB_PASS || 'Lab-Only-Pass-123'
const CHROME = process.env.CHROME || '/usr/bin/google-chrome'
const SHOTS = process.env.SHOTS || ''
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// the cards and their sizes, from the registry itself
const reg = fs.readFileSync(path.join(HERE, '../src/renderer/components/dashboard/cardRegistry.ts'), 'utf8')
const cards = [...reg.matchAll(/\{ id: '([a-z-]+)',[^}]*?defaultW: (\d+),\s*defaultH: (\d+),\s*minW: (\d+),\s*minH: (\d+),\s*maxW: (\d+),\s*maxH: (\d+)/g)]
  .map((m) => ({ id: m[1], w: +m[2], h: +m[3], minH: +m[5], maxH: +m[7] }))
for (const p of (process.env.PLUGINS || '').split(',').filter(Boolean)) cards.push({ id: p, w: 12, h: 6, minH: 2, maxH: 16 })
const only = (process.env.CARDS || '').split(',').filter(Boolean)
const list = only.length ? cards.filter((c) => only.includes(c.id)) : cards
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], defaultViewport: { width: 1440, height: 1500 } })
const server = API.replace(/[^a-z0-9]/gi, '_')

// runs inside a document (the dashboard or a plugin card's frame): the scrollers that end short of `limit`, the scrollers with a fixed cap, and where the VISIBLE content ends
function probe(rootSel, limit) {
  const root = document.querySelector(rootSel) || document.body
  const all = [root, ...root.querySelectorAll('*')]
  const short = [], capped = []
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '.' + String(e.className).split(' ').filter((c) => c && !c.startsWith('scrollbar')).slice(0, 2).join('.')
  for (const e of all) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const scrolls = /(auto|scroll)/.test(cs.overflowY)
    if (scrolls && cs.maxHeight !== 'none' && parseFloat(cs.maxHeight) > 0 && !/%|vh/.test(cs.maxHeight) && e.clientHeight > 20) capped.push({ el: name(e), max: cs.maxHeight })
    if (scrolls && e.scrollHeight > e.clientHeight + 6 && e.clientHeight > 20) {
      const r = e.getBoundingClientRect(); const gap = Math.round(limit - r.bottom)
      if (gap > 30) short.push({ el: name(e), height: Math.round(r.height), gap })
    }
  }
  // where the content ends: the lowest visible LEAF (text, a chart, an image, an input); frames that merely stretch to the card do not count
  let bottom = 0, lowestIsChart = false
  const media = /^(svg|canvas|img|iframe|video|textarea|input|button|select)$/i
  for (const e of root.querySelectorAll('*')) {
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue
    if (e.closest('svg') && !/^svg$/i.test(e.tagName)) continue
    const leaf = media.test(e.tagName) || (e.children.length === 0 && (e.textContent || '').trim() !== '')
    if (!leaf) continue
    const r = e.getBoundingClientRect(); if (r.height > 0 && r.width > 0 && r.bottom <= limit + 16 && r.bottom >= bottom) { bottom = r.bottom; lowestIsChart = /^(svg|canvas|img)$/i.test(e.tagName) && r.height > 60 }
  }
  return { short, capped, contentBottom: Math.round(bottom), lowestIsChart }
}

async function measure(page, id) {
  const cell = await page.evaluateHandle(() => document.querySelector('.dashboard-grid > div:not([aria-hidden])'))
  const c = cell.asElement(); if (!c) return null
  const box = await c.boundingBox()
  const out = await page.evaluate((limitPad) => {
    const cell = document.querySelector('.dashboard-grid > div:not([aria-hidden])'), r = cell.getBoundingClientRect()
    const body = cell.querySelector('.dash-card-body') || cell, iframe = cell.querySelector('iframe')
    const text = (cell.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    return { cell: Math.round(r.height), bottom: Math.round(r.bottom), limit: Math.round(r.bottom - limitPad), iframe: !!iframe, empty: !!cell.querySelector('.flex-1.justify-center.text-center'), text, scrollH: body.firstElementChild ? body.firstElementChild.scrollHeight : 0, clientH: body.firstElementChild ? body.firstElementChild.clientHeight : 0 }
  }, 16)
  let p
  if (out.iframe) {
    const fr = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith('blob:'))
    const ifr = await c.$('iframe'); const ib = await ifr.boundingBox()
    p = fr ? await fr.evaluate(probe, 'body', ib.height - 4) : { short: [], contentBottom: 0 }
    p.contentBottom = p.contentBottom  // inside the frame
    out.frameH = Math.round(ib.height)
  } else {
    p = await page.evaluate(probe, '.dashboard-grid > div:not([aria-hidden]) .dash-card-body', out.limit)
  }
  out.short = p.short; out.capped = p.capped; out.contentBottom = p.contentBottom; out.chart = p.lowestIsChart
  out.void = out.iframe ? Math.max(0, (out.frameH || 0) - p.contentBottom) : Math.max(0, out.bottom - 16 - p.contentBottom)
  out.box = box
  return out
}

let failures = 0
const rows = []
for (const card of list) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage()
  await page.evaluateOnNewDocument((api) => { localStorage.setItem('app-settings', JSON.stringify({ serverUrl: api, theme: 'dark' })); localStorage.setItem('onboarding_complete', 'true'); localStorage.setItem('dcs-prefs-at-' + 'lab', String(Date.now() + 864e5)) }, API)
  await page.goto(UI, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="Enter password"]', { timeout: 60000 })
  await page.type('input[placeholder="Enter username"]', USER); await page.type('input[placeholder="Enter password"]', PASS); await page.keyboard.press('Enter')
  await page.waitForSelector('main', { timeout: 30000 })
  for (const [label, h] of [['default', card.h], ['tall', Math.min(card.maxH, card.h + 8)]]) {
    if (label === 'tall' && h <= card.h + 2) continue   // a card that cannot grow much has nothing more to prove
    await page.evaluate((server, user, id, w, h) => { localStorage.setItem(`dashboard-layout-${server}-${user}`, JSON.stringify({ version: 9, updated_at: Date.now() + 864e5, cards: [{ id, visible: true, x: 0, y: 0, w, h }] })) }, server, USER, card.id, card.w, h)
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('.dashboard-grid > div', { timeout: 30000 }); await sleep(3200)
    const m = await measure(page, card.id)
    if (!m) { rows.push({ id: card.id, label, error: 'the card did not render' }); failures++; continue }
    const problems = []
    for (const s of m.short) problems.push(`stops short: ${s.el} scrolls but ends ${s.gap} px above the bottom of the card`)
    for (const c of m.capped) problems.push(`fixed cap: ${c.el} has max-height ${c.max}, so a long list stops there however tall the card is`)
    if (label === 'tall' && m.chart && !m.short.length && m.void > m.cell * 0.3) problems.push(`void: a chart or picture ends ${m.void} px above the bottom of a ${m.cell} px card and did not grow with it`)
    rows.push({ id: card.id, label, cell: m.cell, void: m.void, short: m.short.length, problems })
    failures += problems.length
    if (SHOTS && label === 'tall') { const cell = await page.$('.dashboard-grid > div:not([aria-hidden])'); if (cell) await cell.screenshot({ path: path.join(SHOTS, `${card.id.replace(/[:]/g, '_')}-tall.png`) }) }
  }
  await ctx.close()
  const mine = rows.filter((r) => r.id === card.id)
  console.log(`${mine.every((r) => !r.problems || !r.problems.length) ? '✓' : '✗'} ${card.id.padEnd(34)} ${mine.map((r) => r.error ? `${r.label}: ${r.error}` : `${r.label} ${r.cell}px (void ${r.void})`).join('  ·  ')}`)
  for (const r of mine) for (const p of r.problems || []) console.log(`      ${r.label}: ${p}`)
}
await browser.close()
console.log(`\n${list.length} cards · failures: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
