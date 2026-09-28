// =============================================================================
// cssSanitize — the one filter every stylesheet a person writes goes through
// (Settings → Custom CSS, and a theme's extra css). Nothing that loads or runs
// anything survives: @import (external stylesheets), expression() (IE script),
// -moz-binding (XBL), javascript: and url() with an external scheme. data: URLs
// stay so inline images keep working. The server applies the same rules.
// =============================================================================

export interface SanitizedCss {
  css: string
  /** the constructs that were cut out, in plain words, for the person to see */
  stripped: string[]
}

interface Rule {
  label: string
  pattern: RegExp
  replacement: string
}

const RULES: Rule[] = [
  { label: '@import', pattern: /@import\b[^;]*/gi, replacement: '/* @import blocked */' },
  { label: 'expression()', pattern: /expression\s*\(/gi, replacement: '/* expression blocked */(' },
  { label: '-moz-binding', pattern: /-moz-binding\s*:/gi, replacement: '/* -moz-binding blocked */:' },
  { label: 'javascript:', pattern: /javascript\s*:/gi, replacement: '/* javascript: blocked */:' },
  // url() with an external scheme (http, https, protocol-relative); data: is allowed
  { label: 'external url()', pattern: /url\s*\(\s*(['"]?)\s*(?:https?:|\/\/)/gi, replacement: 'url($1data:blocked' },
]

export function sanitizeCss(input: string | null | undefined): SanitizedCss {
  let css = input || ''
  const stripped: string[] = []
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    if (!rule.pattern.test(css)) continue
    rule.pattern.lastIndex = 0
    css = css.replace(rule.pattern, rule.replacement)
    stripped.push(rule.label)
  }
  return { css, stripped }
}

/** the note the studio and the custom CSS editor show under their textarea */
export const CSS_SANITIZE_NOTE = '@import, expression(), -moz-binding, javascript: and url() with an http(s) address are removed before the CSS is applied; data: URLs are fine.'
