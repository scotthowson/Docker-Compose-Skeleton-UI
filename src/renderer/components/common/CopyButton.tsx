import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import Hint from './Hint'

interface CopyButtonProps {
  text: string
  className?: string
  size?: number
}

export function CopyButton({ text, className = '', size = 12 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => { /* refused by the browser: the button simply does not turn green */ })
  }, [text])

  return (
    <Hint label={copied ? 'Copied' : 'Copy to clipboard'}>
      <button
        type="button"
        onClick={handleCopy}
        className={`
          inline-flex items-center justify-center
          h-6 w-6 rounded
          text-slate-500 hover:text-slate-300
          hover:bg-white/5
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
          ${className}
        `}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        {copied ? (
          <Check size={size} className="text-emerald-400" />
        ) : (
          <Copy size={size} />
        )}
      </button>
    </Hint>
  )
}
