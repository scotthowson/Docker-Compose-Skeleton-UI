#!/usr/bin/env node
// =============================================================================
// signin-plain-password — an admin hands out a plain password (the server asks for 8 characters
// and nothing more: no uppercase letter, no number) and the person must be able to sign in with it
// on a device that has never seen them, and on a second one; a wrong password is still refused.
//
// Until 4.0.2 the app made its local copy of the account (used for the app lock when offline) with the
// rules of "choosing a password", so such a person was refused at their very first sign-in with
// "Password must contain at least one uppercase letter and one number", although the server had let them in.
//
// Run it against the lab (tests/lab/lab.sh start), never against a real server:
//   PUPPETEER_DIR=/tmp/dcs-ui-sweep node tests/signin-plain-password.mjs
// Env: UI (http://localhost:3021), API (http://127.0.0.1:41921), LAB_USER, LAB_PASS, CHROME (/usr/bin/google-chrome).
// Exit status: 0 when every check passed.
// =============================================================================

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(process.env.PUPPETEER_DIR ? path.join(path.resolve(process.env.PUPPETEER_DIR), 'package.json') : import.meta.url)
const puppeteer = require('puppeteer-core')

const UI = process.env.UI || 'http://localhost:3021'
const API = process.env.API || 'http://127.0.0.1:41921'
const ADMIN = process.env.LAB_USER || 'lab'
const ADMIN_PASS = process.env.LAB_PASS || 'Lab-Only-Pass-123'
const CHROME = process.env.CHROME || '/usr/bin/google-chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const USER = `plain-${Date.now().toString(36)}`
const PLAIN = 'plainpassword' // lowercase only, 13 characters
let failures = 0
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++ }

async function api(method, route, body, token) {
  const res = await fetch(API + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const login = await api('POST', '/auth/login', { username: ADMIN, password: ADMIN_PASS })
if (!login.body.token) { console.error(`cannot sign in to the lab as ${ADMIN}: ${JSON.stringify(login.body)}`); process.exit(2) }
const created = await api('POST', '/auth/users', { username: USER, password: PLAIN, role: 'user' }, login.body.token)
check(created.status === 200, `the admin creates ${USER} with the plain password (HTTP ${created.status})`)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], defaultViewport: { width: 1280, height: 800 } })
async function signIn(pass) {
  const ctx = await browser.createBrowserContext() // a device that has never seen this person
  const page = await ctx.newPage()
  await page.evaluateOnNewDocument((api) => { localStorage.setItem('app-settings', JSON.stringify({ serverUrl: api, theme: 'dark' })); localStorage.setItem('onboarding_complete', 'true') }, API)
  await page.goto(UI, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[placeholder="Enter password"]', { timeout: 60000 })
  await page.type('input[placeholder="Enter username"]', USER)
  await page.type('input[placeholder="Enter password"]', pass)
  await page.keyboard.press('Enter')
  for (let i = 0; i < 60; i++) {
    await sleep(250)
    if (await page.$('main')) { await ctx.close(); return { ok: true, message: '' } }
    const message = await page.evaluate(() => [...document.querySelectorAll('[role="alert"], .text-rose-400')].map((e) => (e.textContent || '').trim()).filter(Boolean).join(' | '))
    if (message) { await ctx.close(); return { ok: false, message } }
  }
  await ctx.close()
  return { ok: false, message: 'neither the app nor an error appeared' }
}

const first = await signIn(PLAIN)
check(first.ok, `first sign-in on a new device${first.ok ? '' : `: ${first.message}`}`)
const second = await signIn(PLAIN)
check(second.ok, `sign-in on a second device${second.ok ? '' : `: ${second.message}`}`)
const wrong = await signIn(`${PLAIN}-wrong`)
check(!wrong.ok && /invalid username or password/i.test(wrong.message), `a wrong password is refused by the server (${wrong.message || 'no message'})`)

await browser.close()
console.log(failures === 0 ? '\nfailures: 0' : `\nfailures: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
