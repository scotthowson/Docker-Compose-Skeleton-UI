// =============================================================================
// PluginFrame — sandboxed plugin card frames with the API message bridge
// =============================================================================

import React, { useEffect, useRef, useState } from 'react'
import { apiClient } from '../../api/client'

// Injected ahead of every plugin card. The card runs sandboxed at a null
// origin, so it can neither reach the API nor hold a session; instead any
// fetch("/path") (or window.dcs.fetch) is relayed to the dashboard, which
// performs the GET with the signed-in session and posts the JSON back.
const PLUGIN_BRIDGE = `<script>(function(){var n=0,p={};window.addEventListener('message',function(e){var m=e.data;if(!m||m.type!=='dcs-api-response'||!p[m.id])return;var r=p[m.id];delete p[m.id];r({ok:!!m.ok,status:m.status||0,json:function(){return Promise.resolve(m.data)},text:function(){return Promise.resolve(JSON.stringify(m.data))}})});function bridge(path){return new Promise(function(res){var id=++n;p[id]=res;parent.postMessage({type:'dcs-api-request',id:id,path:path},'*')})}window.dcs={fetch:bridge};window.__DCS_TOKEN='';var f=window.fetch;window.fetch=function(u,o){var s=typeof u==='string'?u:(u&&u.url)||'';if(/^\\/(?!\\/)/.test(s))return bridge(s);return f.apply(this,arguments)};})();</script>`

/** Plugin card iframe — fetches HTML from API and renders it from a blob URL */
export function PluginCardFrame({ pluginName, cardName, title, refreshInterval = 0 }: { pluginName: string; cardName: string; title: string; refreshInterval?: number }) {
  const [src, setSrc] = useState<string>('')
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    apiClient.get<{ html: string }>(`/plugins/${pluginName}/cards/${cardName}`)
      .then((res) => {
        if (cancelled) return
        // Blob URL has null origin — CSP of parent page does NOT apply
        // Scripts execute freely inside blob URL iframes
        const blob = new Blob([PLUGIN_BRIDGE + res.html], { type: 'text/html' })
        setSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
        setError(false)
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [pluginName, cardName, tick])

  // Cards that declare a refresh interval are reloaded on that cadence
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return
    const timer = setInterval(() => setTick((n) => n + 1), Math.max(10, refreshInterval) * 1000)
    return () => clearInterval(timer)
  }, [refreshInterval])

  // Answer the card's data requests with the dashboard's own session (GET only)
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow
      if (!win || e.source !== win) return
      const msg = e.data as { type?: string; id?: number; path?: string } | null
      if (!msg || msg.type !== 'dcs-api-request' || typeof msg.path !== 'string') return
      const path = msg.path.replace(/^\/api(?=\/)/, '')
      if (!path.startsWith('/') || path.includes('..')) {
        win.postMessage({ type: 'dcs-api-response', id: msg.id, ok: false, status: 400, data: { error: 'Only API paths like /routes are allowed' } }, '*')
        return
      }
      try {
        const data = await apiClient.get<unknown>(path)
        win.postMessage({ type: 'dcs-api-response', id: msg.id, ok: true, status: 200, data }, '*')
      } catch (err) {
        const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500
        win.postMessage({ type: 'dcs-api-response', id: msg.id, ok: false, status, data: { error: err instanceof Error ? err.message : 'request failed' } }, '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '12px', color: '#f87171' }}>Failed to load card</span>
      </div>
    )
  }

  if (!src) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '20px', height: '20px', border: '2px solid rgba(139,92,246,0.3)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      // SECURITY: Sandbox plugin iframes — allow scripts (for dynamic cards) but block
      // top-navigation, forms, popups, and same-origin access to parent window.
      // This prevents malicious plugins from accessing the parent app's DOM, cookies, or auth tokens.
      sandbox="allow-scripts"
      // @ts-ignore — allowtransparency is a valid HTML attribute but not in React types
      allowtransparency="true"
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', display: 'block', background: 'transparent' }}
    />
  )
}

/**
 * Renders card HTML (with the bridge prepended) from a blob URL in a sandboxed
 * frame and answers the card's data requests with the dashboard's session.
 */
export function HtmlCardFrame({ html, title }: { html: string; title: string }) {
  const [src, setSrc] = useState<string>('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const blob = new Blob([PLUGIN_BRIDGE + html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [html])

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow
      if (!win || e.source !== win) return
      const msg = e.data as { type?: string; id?: number; path?: string } | null
      if (!msg || msg.type !== 'dcs-api-request' || typeof msg.path !== 'string') return
      const path = msg.path.replace(/^\/api(?=\/)/, '')
      if (!path.startsWith('/') || path.includes('..')) {
        win.postMessage({ type: 'dcs-api-response', id: msg.id, ok: false, status: 400, data: { error: 'Only API paths like /routes are allowed' } }, '*')
        return
      }
      try {
        const data = await apiClient.get<unknown>(path)
        win.postMessage({ type: 'dcs-api-response', id: msg.id, ok: true, status: 200, data }, '*')
      } catch (err) {
        const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500
        win.postMessage({ type: 'dcs-api-response', id: msg.id, ok: false, status, data: { error: err instanceof Error ? err.message : 'request failed' } }, '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!src) return null
  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      sandbox="allow-scripts"
      // @ts-ignore — allowtransparency is a valid HTML attribute but not in React types
      allowtransparency="true"
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', display: 'block', background: 'transparent' }}
    />
  )
}
