// =============================================================================
// SortableTh — a table column header that sorts. The header cell carries
// aria-sort and holds a real <button>, so a column can be sorted from the
// keyboard and a screen reader says which column is sorted and which way; a
// header made with `<th onClick>` could be reached with a mouse only.
//
//   <SortableTh label="Name" active={sort.key === 'name'} direction={sort.direction} onSort={() => handleSort('name')} />
//   <SortableTh label="Size" align="right" active={…} direction={…} onSort={…} />
//
// `className` is for the cell: a width, or the class that hides the column on a phone.
// Write the label in sentence case ("Created"): the header shows it in capitals.
// =============================================================================

import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

export type SortDirection = 'asc' | 'desc'

interface SortableThProps {
  label: string
  /** this column is the one the table is sorted by */
  active: boolean
  direction: SortDirection
  onSort: () => void
  align?: 'left' | 'center' | 'right'
  className?: string
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const
const JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const

export default function SortableTh({ label, active, direction, onSort, align = 'left', className = '' }: SortableThProps) {
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-0 text-xs font-semibold uppercase tracking-wider ${ALIGN[align]} ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={`flex w-full items-center gap-1 ${JUSTIFY[align]} rounded py-3 uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${active ? 'text-slate-200' : 'text-slate-400 hover:text-slate-200'}`}
      >
        {label}
        {active
          ? (direction === 'asc' ? <ChevronUp className="h-3 w-3 text-emerald-400" aria-hidden="true" /> : <ChevronDown className="h-3 w-3 text-emerald-400" aria-hidden="true" />)
          : <ChevronsUpDown className="h-3 w-3 text-slate-500" aria-hidden="true" />}
      </button>
    </th>
  )
}
