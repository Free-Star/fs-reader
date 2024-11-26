export interface Annotation {
  id: string
  cfi: string
  text: string
  note?: string
  color: string
  createdAt: number
}

export interface Book {
  id: string
  title: string
  author: string
  cover: string
  progress: number
  lastRead?: number
  genre?: string
  isFavorite: boolean
  isFeatured: boolean
  file: string
  currentCfi?: string
  currentChapter?: number
  currentPage?: number
  totalPages?: number
  annotations?: Annotation[]
} 