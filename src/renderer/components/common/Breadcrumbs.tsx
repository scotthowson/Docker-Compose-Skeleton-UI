import { ChevronRight, Home } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { pageLabel } from '../../constants/pageTitles'
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

  // the first crumb is the dashboard under its own name (with the house icon); the page you are on is the last
  const crumbs: BreadcrumbSegment[] = [
    { label: pageLabel('dashboard'), page: 'dashboard' },
  ]

  if (currentPage !== 'dashboard') {
    crumbs.push({ label: pageLabel(currentPage) })
  }

  if (segments) {
    crumbs.push(...segments)
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-slate-500 animate-fade-in">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const isClickable = !!crumb.page && !isLast

        return (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i === 0 && <Home size={12} className="text-slate-500 mr-0.5" />}
            {isClickable ? (
              <button
                onClick={() => setCurrentPage(crumb.page!)}
                className="hover:text-slate-300 transition-colors"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={isLast ? 'text-slate-300 font-medium' : ''} aria-current={isLast ? 'page' : undefined}>
                {crumb.label}
              </span>
            )}
            {!isLast && <ChevronRight size={11} className="text-slate-700" />}
          </span>
        )
      })}
    </nav>
  )
}
