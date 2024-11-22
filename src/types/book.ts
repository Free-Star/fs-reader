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
  cover?: string
  file: string
  genre?: string
  progress: number
  currentPage: number
  totalPages: number
  currentCfi: string
  lastRead?: number
  isFavorite?: boolean
  isFeatured?: boolean
  annotations: Annotation[]
} 