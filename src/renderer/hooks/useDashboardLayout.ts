// =============================================================================
// useDashboardLayout — Layout state, persistence (server + localStorage), drag
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DashboardCard, DashboardLayout } from '../../shared/types'
import { getDefaultLayout, GRID_COLS } from '../components/dashboard/cardRegistry'
import { useAuthStore } from '../stores/authStore'

const STORAGE_KEY_PREFIX = 'dashboard-layout-'

function getStorageKey(): string {
  const user = useAuthStore.getState().currentUser || 'default'
  return `${STORAGE_KEY_PREFIX}${user}`
}

const CURRENT_VERSION = 9

/** Read layout from localStorage (auto-migrates old versions) */
function loadFromCache(): DashboardLayout | null {
  try {
    const raw = localStorage.getItem(getStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardLayout
    // Discard old versions or malformed layouts
    if (!parsed.version || parsed.version < CURRENT_VERSION) return null
    // Validate cards have x,y,w,h fields (v9+ uses free placement)
    if (parsed.cards?.length > 0 && typeof parsed.cards[0].x !== 'number') return null
    return parsed
  } catch {}
  return null
}

/** Write layout to localStorage */
function saveToCache(layout: DashboardLayout): void {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(layout))
  } catch {}
}

/** Save layout to server (fire-and-forget) */
async function saveToServer(layout: DashboardLayout): Promise<void> {
  try {
    const { apiClient } = await import('../api/client')
    await apiClient.post('/settings/dashboard', { layout })
  } catch {
    // Server save failed — localStorage cache is the fallback
  }
}

/** Fetch layout from server */
async function fetchFromServer(): Promise<DashboardLayout | null> {
  try {
    const { apiClient } = await import('../api/client')
    const res = await apiClient.get<{ layout: DashboardLayout }>('/settings/dashboard')
    return res.layout
  } catch {
    return null
  }
}

let nextSpecialId = Date.now()

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(() => {
    return loadFromCache() || getDefaultLayout()
  })
  const [editMode, setEditMode] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const layoutRef = useRef(layout)
  const savedLayoutRef = useRef(layout)  // snapshot before edit mode
  layoutRef.current = layout

  // On mount: fetch from server in background (server wins if newer)
  // Skip if user is actively editing to prevent overwriting their changes
  const editModeRef = useRef(false)
  editModeRef.current = editMode

  useEffect(() => {
    fetchFromServer().then((serverLayout) => {
      if (editModeRef.current) return // don't overwrite active edits
      if (serverLayout && serverLayout.version >= layoutRef.current.version) {
        setLayout(serverLayout)
        saveToCache(serverLayout)
      }
    })
  }, [])

  /** Get visible cards sorted by position (top-to-bottom, left-to-right) */
  const visibleCards = layout.cards
    .filter((c) => c.visible)
    .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)

  /** Get all cards sorted by position */
  const allCards = [...layout.cards].sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)

  /** Save layout (to both localStorage and server) */
  const persistLayout = useCallback((newLayout: DashboardLayout) => {
    setLayout(newLayout)
    saveToCache(newLayout)
    saveToServer(newLayout)
  }, [])

  /** Toggle card visibility (live edit, not persisted until Save) */
  const toggleCard = useCallback((id: string) => {
    setLayout((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === id ? { ...c, visible: !c.visible } : c,
      ),
    }))
  }, [])

  /** Check if placing a card at (x,y,w,h) would overlap any other visible card */
  const wouldOverlap = (cards: DashboardCard[], skipId: string, x: number, y: number, w: number, h: number): boolean => {
    for (const other of cards) {
      if (other.id === skipId || !other.visible) continue
      // Rectangle intersection check
      if (x < other.x + other.w && x + w > other.x &&
          y < other.y + other.h && y + h > other.y) {
        return true
      }
    }
    return false
  }

  /** Resize card — blocked if it would overlap another card */
  const resizeCard = useCallback((id: string, w: number, h: number) => {
    setLayout((prev) => {
      const card = prev.cards.find((c) => c.id === id)
      if (!card) return prev
      if (wouldOverlap(prev.cards, id, card.x, card.y, w, h)) return prev
      return { ...prev, cards: prev.cards.map((c) => c.id === id ? { ...c, w, h } : c) }
    })
  }, [])

  /** Move card — blocked if it would overlap another card */
  const moveCard = useCallback((id: string, x: number, y: number) => {
    setLayout((prev) => {
      const card = prev.cards.find((c) => c.id === id)
      if (!card) return prev
      if (wouldOverlap(prev.cards, id, x, y, card.w, card.h)) return prev
      return { ...prev, cards: prev.cards.map((c) => c.id === id ? { ...c, x, y } : c) }
    })
  }, [])

  /** Add spacer or divider at the bottom of the layout */
  const addSpecial = useCallback((type: 'spacer' | 'divider') => {
    setLayout((prev) => {
      const id = `${type}-${++nextSpecialId}`
      const visibleCards = prev.cards.filter((c) => c.visible)
      const maxY = Math.max(...visibleCards.map((c) => c.y + c.h), 0)
      const newCard: DashboardCard = {
        id,
        visible: true,
        x: 0,
        y: maxY,
        w: type === 'divider' ? GRID_COLS : 6,
        h: type === 'divider' ? 1 : 2,
      }
      return { ...prev, cards: [...prev.cards, newCard] }
    })
  }, [])

  /** Enter edit mode — snapshot current layout for discard */
  const enterEditMode = useCallback(() => {
    savedLayoutRef.current = layoutRef.current
    setEditMode(true)
  }, [])

  /** Save and exit edit mode — persist to cache + server */
  const exitEditMode = useCallback(() => {
    setEditMode(false)
    persistLayout(layoutRef.current)
  }, [persistLayout])

  /** Discard changes — restore snapshot from before edit mode */
  const discardEdit = useCallback(() => {
    setEditMode(false)
    setLayout(savedLayoutRef.current)
  }, [])

  /** Reset to default layout (stays in edit mode so user can review) */
  const resetLayout = useCallback(() => {
    setLayout(getDefaultLayout())
  }, [])

  /** Add a plugin card to the layout at the bottom */
  const addPluginCard = useCallback((id: string, w: number, h: number) => {
    setLayout((prev) => {
      // Don't add if already exists
      if (prev.cards.some((c) => c.id === id)) return prev
      const visCards = prev.cards.filter((c) => c.visible)
      const maxY = Math.max(...visCards.map((c) => c.y + c.h), 0)
      const newCard: DashboardCard = { id, visible: true, x: 0, y: maxY, w, h }
      return { ...prev, cards: [...prev.cards, newCard] }
    })
  }, [])

  return {
    layout,
    visibleCards,
    allCards,
    editMode,
    dragIndex,
    setDragIndex,
    enterEditMode,
    exitEditMode,
    toggleCard,
    resizeCard,
    moveCard,
    resetLayout,
    addSpecial,
    addPluginCard,
    discardEdit,
    labels: layout.labels || {},
    setLabel: useCallback((id: string, title: string) => {
      setLayout((prev) => ({
        ...prev,
        labels: { ...(prev.labels || {}), [id]: title },
      }))
    }, []),
  }
}
