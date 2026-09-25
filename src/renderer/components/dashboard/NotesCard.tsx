// =============================================================================
// NotesCard — a scratchpad that lives on the dashboard (saved with the layout)
// =============================================================================

import React, { useEffect, useState } from 'react'
import { StickyNote, Pencil, Check, X } from 'lucide-react'
import { CardHeader, CardEmpty, type CardCommonProps } from './cardShared'

interface NotesConfig { text: string }

const URL_RE = /(https?:\/\/[^\s<]+)/g

/** Inline: **bold**, `code` and links. Rendered as elements, never as HTML. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  parts.forEach((part, i) => {
    if (!part) return
    if (part.startsWith('**') && part.endsWith('**')) { out.push(<strong key={`${key}-b${i}`} className="text-slate-100">{part.slice(2, -2)}</strong>); return }
    if (part.startsWith('`') && part.endsWith('`')) { out.push(<code key={`${key}-c${i}`} className="px-1 rounded bg-white/10 text-cyan-300 text-[11px]">{part.slice(1, -1)}</code>); return }
    part.split(URL_RE).forEach((seg, j) => {
      if (!seg) return
      if (/^https?:\/\//.test(seg)) out.push(<a key={`${key}-l${i}-${j}`} href={seg} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">{seg}</a>)
      else out.push(<React.Fragment key={`${key}-t${i}-${j}`}>{seg}</React.Fragment>)
    })
  })
  return out
}

function Rendered({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let list: React.ReactNode[] = []
  const flush = () => { if (list.length) { nodes.push(<ul key={`ul-${nodes.length}`} className="list-disc pl-4 space-y-0.5 my-1">{list}</ul>); list = [] } }
  lines.forEach((line, i) => {
    const key = `l${i}`
    // Tasks: "[ ] thing" or "- [x] thing" (checked before bullets so the dash is not a bullet)
    const task = /^\s*(?:[-*] )?\[([ xX])\] (.*)$/.exec(line)
    if (task) {
      flush()
      const done = task[1] !== ' '
      nodes.push(<div key={key} className={`flex items-start gap-1.5 ${done ? 'text-slate-500 line-through' : ''}`}><span className={`mt-1 h-3 w-3 rounded border shrink-0 ${done ? 'bg-emerald-500/60 border-emerald-500/60' : 'border-white/30'}`} /><span>{inline(task[2], key)}</span></div>)
      return
    }
    if (/^\s*[-*] /.test(line)) { list.push(<li key={key}>{inline(line.replace(/^\s*[-*] /, ''), key)}</li>); return }
    flush()
    if (/^### /.test(line)) { nodes.push(<h4 key={key} className="text-xs font-semibold text-slate-200 mt-2">{inline(line.slice(4), key)}</h4>); return }
    if (/^## /.test(line)) { nodes.push(<h3 key={key} className="text-sm font-semibold text-slate-100 mt-2">{inline(line.slice(3), key)}</h3>); return }
    if (/^# /.test(line)) { nodes.push(<h2 key={key} className="text-base font-bold text-slate-100 mt-1">{inline(line.slice(2), key)}</h2>); return }
    if (!line.trim()) { nodes.push(<div key={key} className="h-2" />); return }
    nodes.push(<p key={key}>{inline(line, key)}</p>)
  })
  flush()
  return <div className="text-xs text-slate-300 leading-relaxed">{nodes}</div>
}

export default function NotesCard({ cardConfig, onSaveConfig, dashboardEditMode }: CardCommonProps) {
  const text = typeof (cardConfig as NotesConfig | undefined)?.text === 'string' ? (cardConfig as NotesConfig).text : ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!editing) setDraft(text) }, [text, editing])
  const canEdit = !!onSaveConfig && !dashboardEditMode

  const save = async () => {
    setSaving(true)
    try { await onSaveConfig?.({ text: draft }); setEditing(false) } finally { setSaving(false) }
  }

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <CardHeader
        icon={<StickyNote size={15} />}
        title="Notes"
        right={canEdit ? (editing ? (
          <>
            <button onClick={() => { setDraft(text); setEditing(false) }} className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors" title="Discard"><X size={13} /></button>
            <button onClick={save} disabled={saving} className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50" title="Save (Ctrl+Enter)"><Check size={13} /></button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors" title="Edit notes"><Pencil size={13} /></button>
        )) : undefined}
      />
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void save(); if (e.key === 'Escape') { setDraft(text); setEditing(false) } }}
          placeholder={'# Title\n- a bullet\n[ ] a task\n**bold**, `code`, links…'}
          spellCheck={false}
          className="flex-1 min-h-[6rem] w-full resize-none rounded-lg bg-slate-950/60 border border-white/10 p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
        />
      ) : text.trim() ? (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1" onDoubleClick={canEdit ? () => setEditing(true) : undefined}>
          <Rendered text={text} />
        </div>
      ) : (
        <CardEmpty icon={<StickyNote size={22} />} title="Nothing here yet" hint="Reminders, IPs, the things you keep looking up." action={canEdit ? <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Write a note</button> : undefined} />
      )}
    </div>
  )
}
