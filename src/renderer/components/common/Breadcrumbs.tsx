import { ChevronRight, Home } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { pageTitles } from '../../constants/pageTitles'
import type { PageId } from '../../../shared/types'

export interface BreadcrumbSegment {
  label: string
  page?: PageId
}

interface BreadcrumbsProps {
  segments?: BreadcrumbSegment[]
}

export default function Breadcrumbs({ segments }: BreadcrumbsProps) {
  const currentPage = useSettingsStore((s) => s.currentPage)
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage)

  const crumbs: BreadcrumbSegment[] = [
    { label: 'Home', page: 'dashboard' },
  ]

  if (currentPage !== 'dashboard') {
    crumbs.push({ label: pageTitles[currentPage] || currentPage })
  }

  if (segments) {
    crumbs.push(...segments)
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-slate-500 animate-fade-in">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const isClickable = !!crumb.page && !isLast

        return (
          <span key={i} className="flex items-center gap-1">
            {i === 0 && <Home size={11} className="text-slate-500 mr-0.5" />}
            {isClickable ? (
              <button
                onClick={() => setCurrentPage(crumb.page!)}
                className="hover:text-slate-300 transition-colors"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={isLast ? 'text-slate-300 font-medium' : ''}>
                {crumb.label}
              </span>
            )}
            {!isLast && <ChevronRight size={10} className="text-slate-700" />}
          </span>
        )
      })}
    </nav>
  )
}
