// =============================================================================
// Addresses and networks, for the Allowlist tab: parse the way the API does
// (no leading zeros, "::" once, an optional dotted tail), test whether one
// network covers another, and tell how wide a network is. Pure functions, no
// React, so they can be checked on their own.
// =============================================================================

export interface Net {
  family: 4 | 6
  /** the address with the host bits zeroed: 4 or 16 bytes */
  bytes: number[]
  prefix: number
}

function v4Bytes(s: string): number[] | null {
  const m = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.exec(s)
  if (!m) return null
  const b = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  return b.every((n) => n <= 255) ? b : null
}

function v6Bytes(input: string): number[] | null {
  let a = input.toLowerCase()
  if (!/^[0-9a-f:.]+$/.test(a) || !a.includes(':') || a.includes(':::')) return null
  const tail = /^(.*:)([0-9.]+)$/.exec(a)
  if (tail && tail[2].includes('.')) {
    const v4 = v4Bytes(tail[2])
    if (!v4) return null
    a = `${tail[1]}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }
  let groups: string[]
  if (a.includes('::')) {
    const parts = a.split('::')
    if (parts.length !== 2) return null
    const head = parts[0] ? parts[0].split(':') : []
    const rest = parts[1] ? parts[1].split(':') : []
    if (head.length + rest.length > 7) return null
    groups = [...head, ...Array<string>(8 - head.length - rest.length).fill('0'), ...rest]
  } else {
    groups = a.split(':')
    if (groups.length !== 8) return null
  }
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    const n = parseInt(g, 16)
    out.push(n >> 8, n & 255)
  }
  return out
}

/** an address ("203.0.113.7", "2001:db8::1") or a network ("203.0.113.0/24"); null when the API would say "Not an IP address or network" */
export function parseNet(input: string): Net | null {
  const t = input.trim()
  if (!t || t.length > 64) return null
  const parts = t.split('/')
  if (parts.length > 2) return null
  const [addr, bits] = parts
  if (bits !== undefined && !/^(0|[1-9]\d{0,2})$/.test(bits)) return null
  const v4 = v4Bytes(addr)
  const bytes = v4 ?? v6Bytes(addr)
  if (!bytes) return null
  const family = v4 ? 4 : 6
  const max = family === 4 ? 32 : 128
  const prefix = bits === undefined ? max : Number(bits)
  if (prefix > max) return null
  const masked = bytes.map((b, i) => {
    const keep = Math.max(0, Math.min(8, prefix - i * 8))
    return keep >= 8 ? b : keep === 0 ? 0 : b & ((0xff << (8 - keep)) & 0xff)
  })
  return { family, bytes: masked, prefix }
}

/** does network a contain everything in b (an address or a smaller network)? same family only */
export function netCovers(a: Net, b: Net): boolean {
  if (a.family !== b.family || a.prefix > b.prefix) return false
  for (let i = 0; i < a.bytes.length; i++) {
    const keep = Math.max(0, Math.min(8, a.prefix - i * 8))
    if (keep === 0) break
    if (((a.bytes[i] ^ b.bytes[i]) >> (8 - keep)) !== 0) return false
  }
  return true
}

export function netSame(a: Net, b: Net): boolean {
  return a.family === b.family && a.prefix === b.prefix && a.bytes.every((x, i) => x === b.bytes[i])
}

export function isSingle(n: Net): boolean {
  return n.prefix === (n.family === 4 ? 32 : 128)
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).split('').map((d) => SUP[Number(d)]).join('')

/** "1 address", "256 addresses", "16,777,216 addresses", "2⁶⁴ addresses" */
export function addressCount(n: Net): string {
  const bits = (n.family === 4 ? 32 : 128) - n.prefix
  if (bits === 0) return '1 address'
  if (bits <= 40) return `${(2 ** bits).toLocaleString('en-US')} addresses`
  return `2${sup(bits)} addresses`
}

const parse = (s: string): Net => parseNet(s) as Net
const PRIVATE_NETS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16', '100.64.0.0/10', '0.0.0.0/8', 'fc00::/7', 'fe80::/10', '::1/128', '::/128'].map(parse)

/** on a private, loopback, link-local or shared address range: Traefik trusts those and DCS refuses to ban them */
export function isPrivateNet(n: Net): boolean {
  return PRIVATE_NETS.some((p) => netCovers(p, n))
}

/** wider than a /16 (IPv4) or a /48 (IPv6): worth a second look before it is allowed */
export function isWideNet(n: Net): boolean {
  return n.family === 4 ? n.prefix < 16 : n.prefix < 48
}

/** what the API turns down as "far too wide": IPv4 wider than a /8, and ::/0 */
export function apiRefusesNet(n: Net): boolean {
  return n.family === 4 ? n.prefix < 8 : n.prefix === 0
}
