// =============================================================================
// Auth Store — Secure local authentication with PBKDF2 key derivation, salt,
// rate-limited login attempts, and "remember me" session support
// =============================================================================

import { create } from 'zustand'
import { apiClient } from '../api/client'
import { authLogout } from '../api/endpoints'
import { useSettingsStore } from './settingsStore'
import { useConnectionStore } from './connectionStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserAccount {
  username: string
  /** PBKDF2-derived key (hex). Falls back to SHA-256 for legacy accounts. */
  passwordHash: string
  /** Random 128-bit salt (hex). Present only for PBKDF2 accounts. */
  salt?: string
  /** Hash algorithm version: 1 = SHA-256 (legacy), 2 = PBKDF2-SHA256 */
  hashVersion?: number
  createdAt: string
  lastLoginAt?: string
}

interface SessionData {
  username: string
  expiresAt: number
  /** Random session token for validation */
  token: string
}

interface LoginAttempt {
  count: number
  lastAttempt: number
  lockedUntil: number
}

const SESSION_KEY = 'auth-session'
const LOCKOUT_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 60 * 1000 // 1 minute lockout after 5 failed attempts
const PBKDF2_ITERATIONS = 100_000

// ---------------------------------------------------------------------------
// Crypto helpers — PBKDF2 with salt (Web Crypto API, zero dependencies)
// ---------------------------------------------------------------------------

/** Check if Web Crypto API is available (requires HTTPS or localhost) */
const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof crypto.getRandomValues === 'function'

/** Generate a random 128-bit salt as hex string */
function generateSalt(): string {
  if (hasCrypto) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Fallback: Math.random (less secure, but functional over HTTP)
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/** Generate a random session token */
function generateToken(): string {
  if (hasCrypto) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/** Derive a key from password + salt using PBKDF2-SHA256 (100k iterations) */
async function deriveKey(password: string, salt: string): Promise<string> {
  if (!hasCrypto) {
    // Fallback: simple hash (server does real PBKDF2 anyway)
    return simpleHash(salt + password)
  }
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const saltBytes = new Uint8Array(salt.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Legacy SHA-256 hash (for backwards compatibility with v1 accounts) */
async function sha256Hash(password: string): Promise<string> {
  if (!hasCrypto) {
    return simpleHash(password)
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Simple string hash fallback when crypto.subtle is unavailable (HTTP context) */
function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(16).padStart(16, '0') + Math.abs(h * 31).toString(16).padStart(16, '0')
}

/** Hash a password with the appropriate algorithm */
async function hashPassword(password: string, salt: string): Promise<string> {
  return deriveKey(password, salt)
}

/** Verify a password against a stored account (handles both v1 and v2) */
async function verifyPassword(password: string, account: UserAccount): Promise<boolean> {
  if (account.hashVersion === 2 && account.salt) {
    // PBKDF2 account
    const derived = await deriveKey(password, account.salt)
    return derived === account.passwordHash
  }
  // Legacy SHA-256 account (v1 or missing version)
  const hash = await sha256Hash(password)
  return hash === account.passwordHash
}

// ---------------------------------------------------------------------------
// Dynamic session duration — reads from settingsStore at call time
// ---------------------------------------------------------------------------

function getSessionDurationMs(): number {
  try {
    const { sessionDurationMinutes } = useSettingsStore.getState()
    if (sessionDurationMinutes <= 0) return 0 // indefinite
    return sessionDurationMinutes * 60 * 1000
  } catch {
    return 4 * 60 * 60 * 1000 // fallback: 4 hours
  }
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function getAccounts(): Promise<UserAccount[]> {
  if (window.electronAPI) {
    const accounts = await window.electronAPI.getSetting('userAccounts')
    return (accounts as UserAccount[]) ?? []
  }
  try {
    const raw = localStorage.getItem('userAccounts')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveAccounts(accounts: UserAccount[]): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.setSetting('userAccounts', accounts)
  } else {
    localStorage.setItem('userAccounts', JSON.stringify(accounts))
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

function getPersistedSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session: SessionData = JSON.parse(raw)
    // expiresAt === 0 means indefinite session — never expires
    if (session.expiresAt !== 0 && Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

function setPersistedSession(username: string): void {
  const durationMs = getSessionDurationMs()
  const session: SessionData = {
    username,
    expiresAt: durationMs === 0 ? 0 : Date.now() + durationMs,
    token: generateToken(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearPersistedSession(): void {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem('currentUser')
}

function getActiveSession(): string | null {
  const tabSession = sessionStorage.getItem('currentUser')
  if (tabSession) return tabSession

  const persisted = getPersistedSession()
  if (persisted) {
    sessionStorage.setItem('currentUser', persisted.username)
    return persisted.username
  }
  return null
}

// ---------------------------------------------------------------------------
// Rate limiting for login attempts
// ---------------------------------------------------------------------------

function getLoginAttempts(): LoginAttempt {
  try {
    const raw = sessionStorage.getItem('login-attempts')
    return raw ? JSON.parse(raw) : { count: 0, lastAttempt: 0, lockedUntil: 0 }
  } catch {
    return { count: 0, lastAttempt: 0, lockedUntil: 0 }
  }
}

function recordFailedAttempt(): LoginAttempt {
  const attempts = getLoginAttempts()
  attempts.count += 1
  attempts.lastAttempt = Date.now()
  if (attempts.count >= LOCKOUT_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
  }
  sessionStorage.setItem('login-attempts', JSON.stringify(attempts))
  return attempts
}

function resetLoginAttempts(): void {
  sessionStorage.removeItem('login-attempts')
}

function isLockedOut(): { locked: boolean; remainingMs: number } {
  const attempts = getLoginAttempts()
  if (attempts.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: attempts.lockedUntil - Date.now() }
  }
  // If lockout expired, reset counter
  if (attempts.count >= LOCKOUT_ATTEMPTS) {
    resetLoginAttempts()
  }
  return { locked: false, remainingMs: 0 }
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

const USER_ROLE_KEY_PREFIX = 'user-role-'

/** Persist user role to localStorage (per-user, survives app restarts) */
function persistUserRole(username: string | null, role: 'admin' | 'user' | null): void {
  if (!username) return
  const key = `${USER_ROLE_KEY_PREFIX}${username}`
  if (role) {
    localStorage.setItem(key, role)
  } else {
    localStorage.removeItem(key)
  }
}

/** Restore user role from localStorage */
function getPersistedUserRole(username: string | null): 'admin' | 'user' | null {
  if (!username) return null
  try {
    const r = localStorage.getItem(`${USER_ROLE_KEY_PREFIX}${username}`)
    return r === 'admin' || r === 'user' ? r : null
  } catch {
    return null
  }
}

/**
 * Determine the default role for a user based on account creation order.
 * First account = admin (the setup/initial user), all others = user.
 * This is the final fallback when no server-provided or persisted role exists.
 */
function determineDefaultRole(username: string, accounts: UserAccount[]): 'admin' | 'user' {
  if (accounts.length === 0) return 'admin'
  return accounts[0].username.toLowerCase() === username.toLowerCase() ? 'admin' : 'user'
}

const API_TOKEN_KEY = 'api-auth-token'

/** Persist API token to localStorage */
function persistApiToken(token: string | null): void {
  if (token) {
    // Store token with timestamp for client-side expiry validation
    localStorage.setItem(API_TOKEN_KEY, JSON.stringify({ token, storedAt: Date.now() }))
  } else {
    localStorage.removeItem(API_TOKEN_KEY)
  }
}

/** Restore API token from localStorage with expiry check */
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours — client-side safety net

function getPersistedApiToken(): string | null {
  try {
    const raw = localStorage.getItem(API_TOKEN_KEY)
    if (!raw) return null
    // Handle legacy format (plain string token)
    if (!raw.startsWith('{')) return raw
    const { token, storedAt } = JSON.parse(raw)
    // Reject tokens older than 24h on client side
    if (storedAt && Date.now() - storedAt > TOKEN_MAX_AGE_MS) {
      localStorage.removeItem(API_TOKEN_KEY)
      return null
    }
    return token
  } catch {
    return null
  }
}

interface AuthState {
  isAuthenticated: boolean
  currentUser: string | null
  /** User role from server auth: 'admin' or 'user' */
  userRole: 'admin' | 'user' | null
  hasAccount: boolean
  loading: boolean
  initialized: boolean
  error: string | null
  /** Bearer token for server API authentication */
  apiToken: string | null

  checkAccountExists: () => Promise<void>
  register: (username: string, password: string) => Promise<boolean>
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
  /** Set the API Bearer token (from server auth) */
  setApiToken: (token: string | null) => void
  /** Set the user role (from server auth response). Pass username explicitly
   *  when calling before login/register has set currentUser in the store. */
  setUserRole: (role: 'admin' | 'user' | null, forUsername?: string) => void
  /** Change password for the current user */
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  /** Delete account */
  deleteAccount: (password: string) => Promise<boolean>
}

// Restore API token on startup
const _initialApiToken = getPersistedApiToken()
if (_initialApiToken) {
  apiClient.setAuthToken(_initialApiToken)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!getActiveSession(),
  currentUser: getActiveSession(),
  userRole: getPersistedUserRole(getActiveSession()),
  hasAccount: false,
  loading: true,
  initialized: false,
  error: null,
  apiToken: _initialApiToken,

  checkAccountExists: async () => {
    if (!get().initialized) {
      set({ loading: true })
    }
    const accounts = await getAccounts()
    const session = getActiveSession()

    // Resolve role: persisted > default by account order.
    // Automatically persists the result so this migration runs only once.
    let role = getPersistedUserRole(session)
    if (session && !role) {
      role = determineDefaultRole(session, accounts)
      persistUserRole(session, role)
    }

    set({
      hasAccount: accounts.length > 0,
      isAuthenticated: !!session,
      currentUser: session,
      userRole: role,
      loading: false,
      initialized: true,
    })
  },

  register: async (username: string, password: string) => {
    set({ error: null })

    if (!username.trim() || !password.trim()) {
      set({ error: 'Username and password are required' })
      return false
    }

    if (password.length < 8) {
      set({ error: 'Password must be at least 8 characters' })
      return false
    }

    // Password strength check
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      set({ error: 'Password must contain at least one uppercase letter and one number' })
      return false
    }

    const accounts = await getAccounts()
    const exists = accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())
    if (exists) {
      set({ error: 'An account with this username already exists' })
      return false
    }

    // Generate salt and derive key with PBKDF2
    const salt = generateSalt()
    const passwordHash = await hashPassword(password, salt)
    const newAccount: UserAccount = {
      username: username.trim(),
      passwordHash,
      salt,
      hashVersion: 2,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }

    const isFirstAccount = accounts.length === 0
    accounts.push(newAccount)
    await saveAccounts(accounts)

    // Auto-login after registration
    sessionStorage.setItem('currentUser', newAccount.username)
    setPersistedSession(newAccount.username)

    // Default role if server auth hasn't set one yet:
    // First account ever = admin, subsequent accounts = user
    const currentRole = get().userRole
    const effectiveRole = currentRole || (isFirstAccount ? 'admin' : 'user')
    persistUserRole(newAccount.username, effectiveRole)

    set({
      isAuthenticated: true,
      currentUser: newAccount.username,
      hasAccount: true,
      userRole: effectiveRole,
    })
    return true
  },

  login: async (username: string, password: string, rememberMe: boolean) => {
    set({ error: null })

    // Check rate limiting
    const lockout = isLockedOut()
    if (lockout.locked) {
      const seconds = Math.ceil(lockout.remainingMs / 1000)
      set({ error: `Too many failed attempts. Try again in ${seconds}s` })
      return false
    }

    if (!username.trim() || !password.trim()) {
      set({ error: 'Username and password are required' })
      return false
    }

    const accounts = await getAccounts()
    const account = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase())

    if (!account) {
      recordFailedAttempt()
      set({ error: 'Invalid username or password' })
      return false
    }

    const valid = await verifyPassword(password, account)
    if (!valid) {
      const attempts = recordFailedAttempt()
      const remaining = LOCKOUT_ATTEMPTS - attempts.count
      if (remaining > 0 && remaining <= 2) {
        set({ error: `Invalid password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining` })
      } else {
        set({ error: 'Invalid username or password' })
      }
      return false
    }

    // Successful login — reset lockout counter
    resetLoginAttempts()

    // Auto-upgrade legacy SHA-256 accounts to PBKDF2
    if (!account.hashVersion || account.hashVersion < 2) {
      const salt = generateSalt()
      account.passwordHash = await hashPassword(password, salt)
      account.salt = salt
      account.hashVersion = 2
      await saveAccounts(accounts)
    }

    // Update last login timestamp
    account.lastLoginAt = new Date().toISOString()
    await saveAccounts(accounts)

    // Set sessions
    sessionStorage.setItem('currentUser', account.username)
    if (rememberMe) {
      setPersistedSession(account.username)
    } else {
      clearPersistedSession()
      sessionStorage.setItem('currentUser', account.username)
    }

    // Restore role: server-provided > persisted > default by account order.
    // Persist the resolved role so it survives logout/restart cycles.
    const serverRole = get().userRole
    const persistedRole = getPersistedUserRole(account.username)
    const effectiveRole = serverRole || persistedRole || determineDefaultRole(account.username, accounts)
    if (!persistedRole || (serverRole && serverRole !== persistedRole)) {
      persistUserRole(account.username, effectiveRole)
    }

    set({
      isAuthenticated: true,
      currentUser: account.username,
      userRole: effectiveRole,
    })
    return true
  },

  setApiToken: (token: string | null) => {
    apiClient.setAuthToken(token)
    persistApiToken(token)
    set({ apiToken: token })
  },

  setUserRole: (role: 'admin' | 'user' | null, forUsername?: string) => {
    persistUserRole(forUsername || get().currentUser, role)
    set({ userRole: role })
  },

  logout: async () => {
    // ── SYNCHRONOUS cleanup first — prevents api-auth-expired race ──
    // Setting isAuthenticated=false immediately ensures that any 401
    // responses from in-flight requests won't trigger a second logout.
    set({
      isAuthenticated: false,
      currentUser: null,
      userRole: null,
      apiToken: null,
      error: null,
    })
    clearPersistedSession()
    persistApiToken(null)

    // Reset navigation to dashboard so the next user doesn't land
    // on an admin-only or context-specific page
    useSettingsStore.getState().setCurrentPage('dashboard')

    // Stop heartbeat, reconnect timers, and all polling
    useConnectionStore.getState().disconnect()

    // SECURITY: Clear API tokens from stored server profiles to prevent token reuse
    try {
      const raw = localStorage.getItem('dcs-servers')
      if (raw) {
        const data = JSON.parse(raw)
        if (data?.servers) {
          data.servers = data.servers.map((s: Record<string, unknown>) => ({ ...s, apiToken: null }))
          localStorage.setItem('dcs-servers', JSON.stringify(data))
        }
      }
    } catch { /* ignore parse errors */ }

    // ── ASYNC: best-effort server-side token invalidation ──
    // apiClient still has the token briefly for this call
    try {
      await authLogout()
    } catch {
      // Network error or server unreachable — local logout already done
    }
    apiClient.setAuthToken(null)
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    set({ error: null })
    const { currentUser } = get()
    if (!currentUser) {
      set({ error: 'Not logged in' })
      return false
    }

    if (newPassword.length < 8) {
      set({ error: 'New password must be at least 8 characters' })
      return false
    }

    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      set({ error: 'Password must contain at least one uppercase letter and one number' })
      return false
    }

    const accounts = await getAccounts()
    const account = accounts.find((a) => a.username.toLowerCase() === currentUser.toLowerCase())
    if (!account) {
      set({ error: 'Account not found' })
      return false
    }

    const valid = await verifyPassword(currentPassword, account)
    if (!valid) {
      set({ error: 'Current password is incorrect' })
      return false
    }

    // Re-hash with new PBKDF2 salt
    const salt = generateSalt()
    account.passwordHash = await hashPassword(newPassword, salt)
    account.salt = salt
    account.hashVersion = 2
    await saveAccounts(accounts)

    set({ error: null })
    return true
  },

  deleteAccount: async (password: string) => {
    set({ error: null })
    const { currentUser } = get()
    if (!currentUser) {
      set({ error: 'Not logged in' })
      return false
    }

    const accounts = await getAccounts()
    const accountIdx = accounts.findIndex((a) => a.username.toLowerCase() === currentUser.toLowerCase())
    if (accountIdx === -1) {
      set({ error: 'Account not found' })
      return false
    }

    const valid = await verifyPassword(password, accounts[accountIdx])
    if (!valid) {
      set({ error: 'Password is incorrect' })
      return false
    }

    // Prevent deleting the last admin account
    // Role is stored per-user in localStorage, not on the account object
    const deletingUsername = accounts[accountIdx].username
    const deletingRole = getPersistedUserRole(deletingUsername) || determineDefaultRole(deletingUsername, accounts)
    if (deletingRole === 'admin') {
      const otherAdmins = accounts.filter((a, i) => {
        if (i === accountIdx) return false
        const role = getPersistedUserRole(a.username) || determineDefaultRole(a.username, accounts)
        return role === 'admin'
      })
      if (otherAdmins.length === 0) {
        set({ error: 'Cannot delete the only admin account. Create another admin first.' })
        return false
      }
    }

    accounts.splice(accountIdx, 1)
    await saveAccounts(accounts)

    // Clean up per-user profile, role, and session
    const deletedUser = get().currentUser
    if (deletedUser) {
      localStorage.removeItem(`user-profile-${deletedUser}`)
      localStorage.removeItem(`${USER_ROLE_KEY_PREFIX}${deletedUser}`)
    }
    localStorage.removeItem('user-profile') // legacy key
    clearPersistedSession()

    set({
      isAuthenticated: false,
      currentUser: null,
      hasAccount: accounts.length > 0,
    })
    return true
  },

  clearError: () => set({ error: null }),
}))

// Listen for API auth expiry (dispatched by ApiClient on 401)
// Guard: only act if the user is still authenticated — prevents duplicate
// logouts from stale in-flight requests during manual sign-out.
window.addEventListener('api-auth-expired', () => {
  const { isAuthenticated } = useAuthStore.getState()
  if (isAuthenticated) {
    // This is a genuine server-side token expiry (not a manual logout)
    useAuthStore.getState().logout()
    // Show expiry notice AFTER logout sets isAuthenticated=false,
    // so subsequent api-auth-expired events are no-ops.
    useAuthStore.setState({ error: 'Session expired — please sign in again' })
  }
})
