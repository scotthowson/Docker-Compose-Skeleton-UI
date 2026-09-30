import fs from 'fs'
import path from 'path'

/**
 * What must not travel with a copy of Chromium's profile: the caches it rebuilds by itself, and the
 * sockets and links a running instance leaves behind (a copy would fail on them).
 */
const LEFT_BEHIND = /^(Singleton(Lock|Socket|Cookie)|Cache|Code Cache|GPUCache|DawnCache|GrShaderCache|ShaderCache|Crashpad|blob_storage)$/i

/**
 * true when the folder holds nothing a person made: it does not exist, or it has neither the settings
 * file of electron-store (config.json) nor Chromium's Local Storage (the sign-in and the profile live there).
 */
export function holdsNoUserData(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) return false
    return !fs.existsSync(path.join(dir, 'config.json')) && !fs.existsSync(path.join(dir, 'Local Storage'))
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ENOENT'
  }
}

/**
 * Carry the data folder of an earlier name of the app over to `target`, once: only when `target` holds
 * nothing yet, from the first of `earlier` that has something, and the earlier folder stays where it is
 * (going back to an older version keeps working). Returns the folder it came from, or null when nothing was done.
 */
export function migrateUserData(target: string, earlier: string[]): string | null {
  if (!holdsNoUserData(target)) return null
  for (const from of earlier) {
    if (path.resolve(from) === path.resolve(target)) continue
    let hasData = false
    try {
      hasData = fs.statSync(from).isDirectory() && !holdsNoUserData(from)
    } catch {
      hasData = false
    }
    if (!hasData) continue
    fs.mkdirSync(target, { recursive: true })
    fs.cpSync(from, target, { recursive: true, filter: (src) => !LEFT_BEHIND.test(path.basename(src)) })
    fs.writeFileSync(path.join(target, 'moved-from.txt'), `${from}\n${new Date().toISOString()}\n`)
    return from
  }
  return null
}
