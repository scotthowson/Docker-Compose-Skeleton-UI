import { create } from 'zustand'
import { ImageInfo } from '../../shared/types'

interface ImageState {
  images: ImageInfo[]
  loading: boolean
  setImages: (images: ImageInfo[]) => void
  setLoading: (loading: boolean) => void
  staleCount: () => number
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: [],
  loading: false,

  setImages: (images) => set({ images }),
  setLoading: (loading) => set({ loading }),
  staleCount: () => get().images.filter((img) => img.staleness === 'stale').length,
}))
