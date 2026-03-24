// =============================================================================
// Table — Sortable data table with glass styling
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  emptyMessage?: string
}

type SortDirection = 'asc' | 'desc' | null

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc != null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function Table<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        // Cycle: asc -> desc -> none
        if (sortDirection === 'asc') {
          setSortDirection('desc')
        } else if (sortDirection === 'desc') {
          setSortKey(null)
          setSortDirection(null)
        }
      } else {
        setSortKey(key)
        setSortDirection('asc')
      }
    },
    [sortKey, sortDirection],
  )

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data

    return [...data].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey)
      const bVal = getNestedValue(b, sortKey)

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      // String comparison
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      const result = aStr.localeCompare(bStr)
      return sortDirection === 'asc' ? result : -result
    })
  }, [data, sortKey, sortDirection])

  const renderSortIcon = (key: string, sortable?: boolean) => {
    if (!sortable) return null

    if (sortKey !== key || sortDirection === null) {
      return <ChevronsUpDown size={14} className="text-slate-500" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp size={14} className="text-emerald-400" />
    }
    return <ChevronDown size={14} className="text-emerald-400" />
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto scrollbar-thin rounded-xl border border-white/5">
      <table className="w-full text-sm text-left">
        {/* Header */}
        <thead>
          <tr className="bg-white/5 border-b border-white/5">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`
                  px-4 py-3
                  text-xs font-semibold uppercase tracking-wider text-slate-400
                  ${col.sortable ? 'cursor-pointer select-none hover:text-slate-200 transition-colors' : ''}
                `}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1.5">
                  <span>{col.header}</span>
                  {renderSortIcon(col.key, col.sortable)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {sortedData.map((item, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`
                border-b border-white/[0.03] last:border-b-0
                ${rowIndex % 2 === 1 ? 'bg-white/[0.015]' : 'bg-transparent'}
                ${onRowClick ? 'cursor-pointer hover:bg-white/5 transition-colors duration-150' : ''}
              `}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-300">
                  {col.render
                    ? col.render(item)
                    : (String(getNestedValue(item, col.key) ?? '--'))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
