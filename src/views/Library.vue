<template>
  <div class="library">
    <header class="header">
      <h1>我的书架</h1>
      <div class="header-actions">
        <input
          type="file"
          ref="fileInput"
          accept=".epub"
          @change="handleFileUpload"
          class="hidden"
        >
        <button class="upload-btn" @click="triggerFileInput">
          <Icon icon="mdi:upload" class="icon" />
          添加新书
        </button>
      </div>
    </header>

    <div class="search-bar">
      <Icon icon="mdi:magnify" class="search-icon" />
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="搜索书籍..."
        class="search-input"
      >
    </div>

    <div class="bookshelf" v-if="filteredBooks.length">
      <div class="shelf" v-for="(group, index) in groupedBooks" :key="index">
        <div class="shelf-shadow"></div>
        <div class="books">
          <div v-for="book in group" :key="book.id" class="book">
            <div class="book-spine" @click="openBook(book.id)">
              <img :src="book.cover || '/default-cover.png'" :alt="book.title" class="spine-cover">
              <div class="spine-info">
                <span class="title">{{ book.title }}</span>
                <span class="author">{{ book.author }}</span>
              </div>
            </div>
            <div class="book-preview">
              <img :src="book.cover || '/default-cover.png'" :alt="book.title" class="preview-cover">
              <div class="preview-info">
                <h3>{{ book.title }}</h3>
                <p>{{ book.author }}</p>
                <div class="progress-bar">
                  <div :style="{ width: book.progress + '%' }" class="progress"></div>
                  <span class="progress-text">{{ book.progress }}%</span>
                </div>
                <div class="preview-actions">
                  <button @click="openBook(book.id)" class="action-btn read">
                    <Icon icon="mdi:book-open-variant" />
                    继续阅读
                  </button>
                  <button @click="confirmDelete(book)" class="action-btn delete">
                    <Icon icon="mdi:delete" />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <Icon icon="mdi:bookshelf" class="empty-icon" />
      <p>书架空空如也</p>
      <button class="upload-btn" @click="triggerFileInput">添加第一本书</button>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click="showDeleteDialog = false">
      <div class="dialog" @click.stop>
        <h3>确认删除</h3>
        <p>确定要删除《{{ bookToDelete?.title }}》吗？</p>
        <div class="dialog-actions">
          <button @click="showDeleteDialog = false">取消</button>
          <button @click="deleteBook" class="delete">删除</button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="bookStore.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="bookStore.error" class="error-message">
      {{ bookStore.error }}
      <button @click="retryLoad">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '../stores/bookStore'
import { Icon } from '@iconify/vue'
import { Book } from '../types/book'
import epub from 'epubjs'

const router = useRouter()
const bookStore = useBookStore()
const fileInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const showDeleteDialog = ref(false)
const bookToDelete = ref<Book | null>(null)

const filteredBooks = computed(() => {
  return bookStore.books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  try {
    // 检查文件大小
    if (file.size > 100 * 1024 * 1024) { // 100MB
      throw new Error('文件太大，请选择小于100MB的文件')
    }

    const arrayBuffer = await file.arrayBuffer()
    const book = epub(arrayBuffer)
    await book.ready
    
    const metadata = await book.loaded.metadata
    let coverBase64 = null
    
    try {
      // 获取封面并转换为 base64
      const coverUrl = await book.coverUrl()
      if (coverUrl) {
        const coverResponse = await fetch(coverUrl)
        const coverBlob = await coverResponse.blob()
        coverBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(coverBlob)
        })
      }
    } catch (e) {
      console.warn('Failed to load cover:', e)
    }

    const reader = new FileReader()
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(file)
    })

    const newBook: Book = {
      id: Date.now().toString(),
      title: metadata.title || file.name.replace('.epub', ''),
      author: metadata.creator || '未知作者',
      cover: coverBase64 || '/default-cover.png',
      progress: 0,
      currentChapter: 0,
      currentCfi: '',
      file: fileBase64
    }

    await bookStore.addBook(newBook)
    target.value = ''
  } catch (error) {
    console.error('Error processing epub:', error)
    alert(error instanceof Error ? error.message : '处理电子书时出错，请确保文件格式正确')
  }
}

const openBook = (bookId: string) => {
  router.push(`/reader/${bookId}`)
}

const confirmDelete = (book: Book) => {
  bookToDelete.value = book
  showDeleteDialog.value = true
}

const deleteBook = async () => {
  if (bookToDelete.value) {
    try {
      await bookStore.removeBook(bookToDelete.value.id)
      showDeleteDialog.value = false
      bookToDelete.value = null
    } catch (error) {
      alert('删除书籍失败，请重试')
    }
  }
}

// 添加书架分组逻辑
const BOOKS_PER_SHELF = 6

const groupedBooks = computed(() => {
  const books = filteredBooks.value
  const groups = []
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    groups.push(books.slice(i, i + BOOKS_PER_SHELF))
  }
  return groups
})

// 组件挂载时加载数据
onMounted(() => {
  bookStore.loadBooks()
})

// 使用 store 中的方法
const addBook = (book: Book) => {
  bookStore.addBook(book)
}

const removeBook = (index: number) => {
  bookStore.removeBook(index)
}

// 添加重试方法
const retryLoad = async () => {
  await bookStore.loadBooks()
}

const updateProgress = async (bookId: string, progress: number, currentChapter: number, currentCfi: string) => {
  const book = bookStore.books.find(b => b.id === bookId)
  if (book) {
    book.progress = progress
    book.currentChapter = currentChapter
    book.currentCfi = currentCfi
    await bookStore.updateBook(book)
  }
}
</script>

<style scoped lang="scss">
@use "sass:color";

.library {
  min-height: 100vh;
  background: linear-gradient(to bottom, #f0f2f5, #e6e9ec);
  padding: 2rem;
}

.header {
  max-width: 1200px;
  margin: 0 auto 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h1 {
    font-size: 2rem;
    color: #2c3e50;
  }
}

.search-bar {
  max-width: 1200px;
  margin: 0 auto 3rem;
  position: relative;
  
  .search-input {
    width: 100%;
    padding: 1rem 1rem 1rem 3rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    
    &:focus {
      outline: none;
      box-shadow: 0 2px 12px rgba(76, 175, 80, 0.2);
    }
  }
}

.bookshelf {
  max-width: 1200px;
  margin: 0 auto;
}

.shelf {
  margin-bottom: 4rem;
  position: relative;
  perspective: 1000px;
  
  .shelf-shadow {
    height: 24px;
    background: linear-gradient(to right, #c4c8cc, #d4d8dc, #c4c8cc);
    border-radius: 4px;
    position: relative;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    
    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -12px;
      height: 12px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.08), transparent);
    }
  }
  
  .books {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    justify-content: flex-start;
    padding: 1.5rem 0;
  }
}

.book {
  flex: 0 0 140px;
  position: relative;
  transform-style: preserve-3d;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  margin-right: 1rem;
  
  &:hover {
    transform: translateY(-15px) rotateX(12deg);
    
    .book-spine {
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    
    .book-preview {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) translateX(20px) translateZ(50px);
    }
  }
}

.book-spine {
  width: 140px;
  height: 200px;
  background: linear-gradient(to right, #1a2634, #2c3e50);
  border-radius: 3px;
  padding: 0;
  cursor: pointer;
  position: relative;
  transform-origin: left;
  box-shadow: 2px 0 8px rgba(0,0,0,0.15);
  transition: all 0.3s ease;
  overflow: hidden;
  
  .spine-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 2px;
    opacity: 0.9;
    transition: opacity 0.3s;
    
    &:hover {
      opacity: 1;
    }
  }
  
  .spine-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem 0.5rem;
    background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.3), transparent);
    color: white;
    
    .title {
      font-size: 0.9rem;
      font-weight: bold;
      display: block;
      margin-bottom: 0.3rem;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    
    .author {
      font-size: 0.8rem;
      opacity: 0.9;
      text-shadow: 0 1px 1px rgba(0,0,0,0.3);
    }
  }
}

.book-preview {
  position: absolute;
  top: -20px;
  left: 100%;
  width: 280px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
  padding: 1.2rem;
  opacity: 0;
  visibility: hidden;
  transform: translateY(30px) translateX(0) translateZ(0);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  
  .preview-cover {
    width: 100%;
    height: 180px;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    background: #f5f5f5;
  }
  
  .preview-info {
    padding: 1.2rem 0;
    
    h3 {
      margin: 0;
      font-size: 1.3rem;
      color: #1a2634;
    }
    
    p {
      margin: 0.7rem 0;
      color: #666;
      font-size: 0.95rem;
    }
  }
  
  .progress-bar {
    height: 6px;
    background: #eee;
    border-radius: 3px;
    margin: 1rem 0;
    overflow: hidden;
    
    .progress {
      height: 100%;
      background: linear-gradient(to right, #4CAF50, #81C784);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
  }
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &.read {
    background: #4CAF50;
    color: white;
    
    &:hover {
      background: color.scale(#4CAF50, $lightness: -5%);
    }
  }
  
  &.delete {
    background: #dc3545;
    color: white;
    
    &:hover {
      background: color.scale(#dc3545, $lightness: -5%);
    }
  }
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  transition: background-color 0.2s;
  
  &:hover {
    background: color.scale(#4CAF50, $lightness: -5%);
  }
}

.hidden {
  display: none;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  min-width: 300px;
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    
    button {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      
      &.delete {
        background: #f44336;
        color: white;
      }
    }
  }
}

.empty-state {
  text-align: center;
  padding: 4rem;
  
  .empty-icon {
    font-size: 4rem;
    color: #ccc;
  }
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background: #ffebee;
  color: #c62828;
  padding: 1rem;
  margin: 1rem auto;
  max-width: 1200px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  button {
    background: #c62828;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: #b71c1c;
    }
  }
}
</style> 