// =============================================================================
// FloatingSaveBar — Reusable floating save indicator with discard/save actions
// =============================================================================
// Shows at bottom of viewport when hasChanges is true. Smooth animation,
// click-through wrapper, consistent styling across all pages.
// =============================================================================

import { Loader2 } from 'lucide-react'

interface FloatingSaveBarProps {
  hasChanges: boolean
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
  saveLabel?: string
  savingLabel?: string
  message?: string
}

export function FloatingSaveBar({
  hasChanges,
  onSave,
  onDiscard,
  saving = false,
  saveLabel = 'Save',
  savingLabel = 'Saving...',
  message = 'You have unsaved changes',
}: FloatingSaveBarProps) {
  if (!hasChanges) return null

  return (
    <div className="fixed bottom-6 inset-x-0 z-[100] flex justify-center pointer-events-none animate-fade-in-up">
      <div className="flex items-center gap-3 rounded-xl bg-slate-800/95 backdrop-blur-lg border border-white/10 px-5 py-3 shadow-2xl shadow-black/40 pointer-events-auto">
        <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-sm text-slate-300">{message}</span>
        <button
          onClick={onDiscard}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
        >
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  )
}
