import { defineStore } from 'pinia'
import type { Book } from '../types/book'

const DB_NAME = 'ebookDB'
const DB_VERSION = 1
const STORE_NAME = 'books'

// 添加类型安全的 Promise 包装函数
const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

export const useBookStore = defineStore('book', {
  state: () => ({
    books: [] as Book[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    recentBooks: (state) => {
      return [...state.books]
        .sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0))
        .slice(0, 12)
    },
    
    featuredBooks: (state) => {
      return state.books.filter(book => book.isFeatured).slice(0, 6)
    }
  },

  actions: {
    async loadBooks() {
      this.loading = true
      this.error = null
      
      try {
        const db = await openDB()
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const books = await promisifyRequest<Book[]>(store.getAll())
        this.books = books.map(book => ({
          ...book,
          annotations: book.annotations || []
        }))
      } catch (error) {
        this.error = '加载书籍失败'
        console.error('加载书籍失败:', error)
      } finally {
        this.loading = false
      }
    },
    
    async addBook(book: Book) {
      this.loading = true
      this.error = null
      
      try {
        const newBook = {
          ...book,
          progress: 0,
          currentChapter: 0,
          currentCfi: '',
          currentPage: 0,
          totalPages: 0,
          lastRead: Date.now(),
          annotations: []
        }
        
        const db = await openDB()
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        await promisifyRequest(store.put(JSON.parse(JSON.stringify(newBook))))
        this.books.push(newBook)
      } catch (error) {
        this.error = '添加书籍失败'
        console.error('添加书籍失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateBook(updatedBook: Book) {
      this.loading = true
      this.error = null
      
      try {
        const db = await openDB()
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        
        // 深拷贝对象以确保可以被序列化
        const bookToStore = JSON.parse(JSON.stringify({
          ...updatedBook,
          annotations: updatedBook.annotations || []
        }))
        
        await promisifyRequest(store.put(bookToStore))
        
        const index = this.books.findIndex(book => book.id === updatedBook.id)
        if (index !== -1) {
          this.books[index] = bookToStore
        }
      } catch (error) {
        this.error = '更新书籍失败'
        console.error('更新书籍失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async removeBook(bookId: string) {
      this.loading = true
      this.error = null
      
      try {
        const db = await openDB()
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        await promisifyRequest(store.delete(bookId))
        
        const index = this.books.findIndex(book => book.id === bookId)
        if (index > -1) {
          this.books.splice(index, 1)
        }
      } catch (error) {
        this.error = '删除书籍失败'
        console.error('删除书籍失败:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async toggleFavorite(bookId: string) {
      const book = this.books.find(b => b.id === bookId)
      if (book) {
        const updatedBook = {
          ...book,
          isFavorite: !book.isFavorite
        }
        await this.updateBook(updatedBook)
      }
    }
  }
})