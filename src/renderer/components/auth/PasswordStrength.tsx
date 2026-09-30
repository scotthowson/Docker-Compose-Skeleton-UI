// =============================================================================
// PasswordStrength — the five-bar meter under a new password (the sign-in
// screen's invite registration and the setup wizard's admin account). Weak is
// rose, Fair amber, from Good on emerald.
// =============================================================================

export function getPasswordStrength(pw: string): { score: number; label: string; color: string; text: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-400' }
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-400' }
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-emerald-500/60', text: 'text-emerald-400' }
  if (score <= 4) return { score: 4, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-400' }
  return { score: 5, label: 'Excellent', color: 'bg-emerald-400', text: 'text-emerald-400' }
}

export default function PasswordStrengthMeter({ password, className = '' }: { password: string; className?: string }) {
  const strength = getPasswordStrength(password)
  return (
    <div className={`space-y-1 animate-fade-in ${className}`}>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${level <= strength.score ? strength.color : 'bg-slate-800'}`}
          />
        ))}
      </div>
      <p className={`text-[10px] ${strength.text}`}>Password strength: {strength.label}</p>
    </div>
  )
}
