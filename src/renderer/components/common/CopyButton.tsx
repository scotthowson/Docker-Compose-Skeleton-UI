import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

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
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center justify-center
        rounded p-0.5
        text-slate-500 hover:text-slate-300
        hover:bg-white/5
        transition-all duration-150
        ${className}
      `}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check size={size} className="text-emerald-400" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  )
}
