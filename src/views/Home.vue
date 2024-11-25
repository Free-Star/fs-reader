<template>
    <div class="home" @contextmenu.prevent>
      <!-- Header Section -->
      <header class="header">
        <div class="logo">
          <Icon icon="mdi:book-open-page-variant" class="logo-icon" />
          <h1>Fs-reader</h1>
        </div>
        <div class="header-actions">
          <a 
            href="https://1lib.sk"
            target="_blank" 
            rel="noopener noreferrer"
            class="z-library-link"
          >
            <Icon icon="mdi:library" class="library-icon" />
            <span>Z-Library</span>
          </a>
          <input
            type="file"
            ref="fileInput"
            accept=".epub"
            @change="handleFileUpload"
            class="hidden"
          />
          <button class="upload-btn" @click="triggerFileInput">
            <Icon icon="mdi:upload" class="icon" />
            添加新书
          </button>
        </div>
      </header>
  
      <!-- 搜索栏和控制面板 -->
      <div class="control-panel">
        <!-- 搜索栏 -->
        <div class="search-bar">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜索书籍..."
            class="search-input"
          />
        </div>
  
        <!-- 排序与过滤 -->
        <div class="filters">
          <!-- 过滤类别 -->
          <select v-model="selectedGenre" class="filter-select">
            <option value="">所有类别</option>
            <option v-for="genre in genres" :key="genre" :value="genre">
              {{ genre }}
            </option>
          </select>
  
          <!-- 过滤收藏 -->
          <label class="favorite-filter">
            <input type="checkbox" v-model="showFavorites" />
            收藏
          </label>
  
          <!-- 排序选项 -->
          <select v-model="sortOption" class="sort-select">
            <option value="lastRead">最近阅读</option>
            <option value="title">标题</option>
            <option value="author">作者</option>
            <option value="progress">进度</option>
          </select>
        </div>
      </div>
  
      <!-- 阅读统计 -->
      <section class="reading-stats" v-if="books.length">
        <div class="stat-card">
          <Icon icon="mdi:book-open-page-variant" class="stat-icon" />
          <div class="stat-info">
            <h3>{{ totalBooks }}</h3>
            <p>总书籍数</p>
          </div>
        </div>
        <div class="stat-card">
          <Icon icon="mdi:progress-clock" class="stat-icon" />
          <div class="stat-info">
            <h3>{{ totalProgress }}%</h3>
            <p>平均阅读进度</p>
          </div>
        </div>
      </section>
  
      <!-- 书架区域 -->
      <div class="bookshelf" v-if="filteredBooks.length">
        <div class="shelf" v-for="(group, index) in groupedBooks" :key="index">
          <div class="shelf-shadow"></div>
          <div class="books">
            <div v-for="book in group" :key="book.id" class="book" @contextmenu.prevent.stop="showBookPreview(book)">
              <!-- 书脊 -->
              <div class="book-spine" @click="openBook(book.id)">
                <img :src="book.cover || '/default-cover.png'" :alt="book.title" class="spine-cover">
                <div class="spine-info">
                  <span class="title">{{ book.title }}</span>
                  <span class="author">{{ book.author }}</span>
                </div>
              </div>
  
              <!-- 书籍预览 -->
              <div 
                class="book-preview" 
                :class="{ 'preview-fixed': book.id === activeBookId }"
              >
                <div class="preview-header">
                  <h3>{{ book.title }}</h3>
                </div>
                <img :src="book.cover || '/default-cover.png'" :alt="book.title" class="preview-cover">
                <div class="preview-info">
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
                    <button 
                      @click.stop="toggleFavorite(book.id)" 
                      class="action-btn favorite"
                      :class="{ active: book.isFavorite }"
                    >
                      <Icon icon="mdi:heart" />
                      收藏
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
  
      <!-- 空状态 -->
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
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { useBookStore } from '../stores/bookStore'
  import { Icon } from '@iconify/vue'
  import { Book } from '../types/book'
  import epub from 'epubjs'
  
  // 路由和状态管理
  const router = useRouter()
  const bookStore = useBookStore()
  
  // 参考元素
  const fileInput = ref<HTMLInputElement | null>(null)
  const searchQuery = ref('')
  const showDeleteDialog = ref(false)
  const bookToDelete = ref<Book | null>(null)
  
  // 过滤和排序
  const selectedGenre = ref('')
  const showFavorites = ref(false)
  const sortOption = ref('lastRead')
  
  // 添加一个计算属性来确保 books 始终是一个数组
  const books = computed(() => bookStore.books || [])
  
  // 过滤后的书籍
  const filteredBooks = computed(() => {
    let filteredList = books.value.filter(book => 
      book.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  
    // 按类别过滤
    if (selectedGenre.value) {
      filteredList = filteredList.filter(book => book.genre === selectedGenre.value)
    }
  
    // 按收藏状态过滤
    if (showFavorites.value) {
      filteredList = filteredList.filter(book => book.isFavorite)
    }
  
    // 按排序选项排序
    switch (sortOption.value) {
      case 'title':
        filteredList = filteredList.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'author':
        filteredList = filteredList.sort((a, b) => a.author.localeCompare(b.author))
        break
      case 'progress':
        filteredList = filteredList.sort((a, b) => b.progress - a.progress)
        break
      case 'lastRead':
      default:
        filteredList = filteredList.sort((a, b) => b.lastRead - a.lastRead)
        break
    }
  
    return filteredList
  })
  
  // 书架分组逻辑
  const BOOKS_PER_SHELF = 6
  const groupedBooks = computed(() => {
    const books = filteredBooks.value
    const groups = []
    for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
      groups.push(books.slice(i, i + BOOKS_PER_SHELF))
    }
    return groups
  })
  
  // 阅读统计
  const totalBooks = computed(() => books.value.length)
  const totalProgress = computed(() =>
    books.value.length
      ? Math.round(books.value.reduce((acc, book) => acc + book.progress, 0) / books.value.length)
      : 0
  )
  
  // 特色书籍（可根据需求调整）
  const featuredBooks = computed(() =>
    bookStore.books.filter(book => book.isFeatured).slice(0, 6)
  )
  
  // 触发文件上传
  const triggerFileInput = () => {
    fileInput.value?.click()
  }
  
  // 处理文件上传
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
        lastRead: Date.now(),
        genre: metadata.subject || '未知类别', // 假设 epub metadata 有 subject
        isFavorite: false,
        isFeatured: false,
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
  
  // 打开书籍阅读器
  const openBook = (bookId: string) => {
    router.push(`/reader/${bookId}`)
  }
  
  // 确认删除书籍
  const confirmDelete = (book: Book) => {
    bookToDelete.value = book
    showDeleteDialog.value = true
  }
  
  // 删除书籍
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
  
  // 切换收藏状态
  const toggleFavorite = (bookId: string) => {
    bookStore.toggleFavorite(bookId)
  }
  
  // 重试加载书籍
  const retryLoad = async () => {
    await bookStore.loadBooks()
  }
  
  // 添加新的响应式变量
  const activeBookId = ref<string | null>(null)
  
  // 添加新的方法
  const showBookPreview = (book: Book) => {
    // 如果当前书已经激活，则关闭预览
    if (activeBookId.value === book.id) {
      activeBookId.value = null
    } else {
      activeBookId.value = book.id
    }
  }
  
  // 添加点击其他地方关闭预览的处理
  const closePreview = (event: MouseEvent) => {
    // 检查点击是否在预览卡片外
    const target = event.target as HTMLElement
    if (!target.closest('.book-preview') && !target.closest('.book-spine')) {
      activeBookId.value = null
    }
  }
  
  // 在组件挂载时添加点击监听
  onMounted(() => {
    document.addEventListener('click', closePreview)
    bookStore.loadBooks()
  })
  
  // 在组件卸载时移除监听
  onUnmounted(() => {
    document.removeEventListener('click', closePreview)
  })
  </script>
  
  <style scoped lang="scss">
  @use "sass:color";
  
  .home {
    min-height: 100vh;
    background: linear-gradient(to bottom, #f0f2f5, #e6e9ec);
    padding: 2rem;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #333;
    max-width: 1400px;
    margin: 0 auto;
    box-sizing: border-box;
  }
  
  /* Header Section */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 1rem;
  
    .logo {
      display: flex;
      align-items: center;
  
      .logo-icon {
        font-size: 2rem;
        color: #4caf50;
        margin-right: 0.5rem;
      }
  
      h1 {
        font-size: 1.8rem;
        margin: 0;
        color: #2c3e50;
      }
    }
  
    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
  
      .z-library-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.8rem 1.5rem;
        background: #2196F3;
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
  
        &:hover {
          background: #1976D2;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
        }
  
        .library-icon {
          font-size: 1.2rem;
        }
      }
  
      .upload-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.8rem 1.5rem;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
        transition: background-color 0.2s;
  
        &:hover {
          background: color.scale(#4caf50, $lightness: -5%);
        }
  
        .icon {
          font-size: 1.2rem;
        }
      }
    }
  }
  
  /* Control Panel */
  .control-panel {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 1rem;
  
    .search-bar {
      position: relative;
      flex: 1;
      max-width: 400px;
      margin-right: 1rem;
  
      .search-icon {
        position: absolute;
        top: 50%;
        left: 12px;
        transform: translateY(-50%);
        color: #999;
        font-size: 1.2rem;
      }
  
      .search-input {
        width: 100%;
        padding: 0.8rem 0.8rem 0.8rem 3rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 1rem;
        background: white;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  
        &:focus {
          outline: none;
          border-color: #4caf50;
          box-shadow: 0 2px 12px rgba(76, 175, 80, 0.2);
        }
      }
    }
  
    .filters {
      display: flex;
      align-items: center;
      gap: 1rem;
  
      .filter-select,
      .sort-select {
        padding: 0.6rem 1rem;
        border: 1px solid #ddd;
        border-radius: 20px;
        background: #fff;
        transition: border-color 0.2s;
  
        &:focus {
          outline: none;
          border-color: #4caf50;
        }
  
        option {
          font-size: 1rem;
        }
      }
  
      .favorite-filter {
        display: flex;
        align-items: center;
        font-size: 0.9rem;
        color: #666;
  
        input {
          margin-right: 0.3rem;
        }
      }
    }
  }
  
  /* Reading Statistics */
  .reading-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 1rem;
    justify-content: center;
  
    .stat-card {
      display: flex;
      align-items: center;
      padding: 1rem 1.5rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  
      .stat-icon {
        font-size: 2rem;
        color: #4caf50;
        margin-right: 1rem;
      }
  
      .stat-info {
        h3 {
          font-size: 1.5rem;
          margin: 0;
          color: #333;
        }
  
        p {
          font-size: 0.9rem;
          color: #777;
          margin: 0;
        }
      }
    }
  }
  
  /* Bookshelf Section */
  .bookshelf {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }
  
  .shelf {
    margin-bottom: 6rem;
    position: relative;
    perspective: 1200px;
    z-index: 1;
  
    .shelf-shadow {
      height: 30px;
      background: linear-gradient(to right, #d4d8dc, #e4e8ec, #d4d8dc);
      border-radius: 6px;
      position: relative;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  
      &::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -15px;
        height: 15px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.08), transparent);
      }
    }
  
    .books {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: 2.5rem;
      justify-content: flex-start;
      padding: 2rem 0;
    }
  }
  
  .book {
    flex: 0 0 130px;
    position: relative;
    transform-style: preserve-3d;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    margin-right: 0;
    user-select: none; /* 防止文本选中 */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  
    &:hover {
      transform: translateY(-20px) rotateX(15deg);
      z-index: 10;
  
      .book-spine {
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      }
  
      .book-preview:not(.preview-fixed) {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) translateX(20px) translateZ(50px);
      }
    }
  }
  
  .book-spine {
    width: 130px;
    height: 190px;
    background: linear-gradient(45deg, #1a2634, #2c3e50);
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    position: relative;
    transform-origin: left;
    box-shadow: 
      2px 0 8px rgba(0,0,0,0.15),
      inset -1px 0 2px rgba(255,255,255,0.1);
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
      padding: 1.2rem 0.8rem;
      background: linear-gradient(to top, 
        rgba(0,0,0,0.95) 0%,
        rgba(0,0,0,0.7) 50%,
        transparent 100%);
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
    border-radius: 15px;
    box-shadow: 
      0 10px 30px rgba(0,0,0,0.15),
      0 2px 10px rgba(0,0,0,0.1);
    padding: 1.5rem;
    opacity: 0;
    visibility: hidden;
    transform: translateY(30px) translateX(0) translateZ(0);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 100;
    pointer-events: none;
  
    &.preview-fixed {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) translateX(20px) translateZ(50px);
      pointer-events: auto; /* 允许交互 */
    }
  
    .preview-cover {
      width: 100%;
      height: 180px;
      object-fit: contain;
      border-radius: 10px;
      box-shadow: 0 6px 15px rgba(0,0,0,0.1);
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
        background: linear-gradient(to right, #4caf50, #81c784);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
  
      .progress-text {
        font-size: 0.8rem;
        color: #666;
        margin-top: 0.3rem;
      }
    }
  
    .preview-actions {
      display: flex;
      gap: 0.5rem;
    }
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    flex: 1;
    font-size: 0.9rem;
    transition: all 0.3s ease;
  
    .iconify {
      font-size: 1.3rem;
    }
  
    &.read {
      background: #4caf50;
      color: white;
  
      &:hover {
        background: color.scale(#4caf50, $lightness: -5%);
      }
    }
  
    &.favorite {
      background: #ff4081;
      color: white;
  
      &:hover {
        background: color.scale(#ff4081, $lightness: -5%);
      }
  
      &.active {
        background: #e91e63;
      }
    }
  
    &.delete {
      background: #f44336;
      color: white;
  
      &:hover {
        background: color.scale(#f44336, $lightness: -5%);
      }
    }
  
    &:hover {
      transform: translateY(-2px);
    }
  }
  
  .preview-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  /* Empty State Section */
  .empty-state {
    text-align: center;
    padding: 4rem;
    color: #777;
  
    .empty-icon {
      font-size: 4rem;
      color: #ccc;
      margin-bottom: 1rem;
    }
  
    p {
      font-size: 1rem;
      margin-bottom: 1.5rem;
    }
  
    .upload-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.8rem 1.5rem;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
      transition: background-color 0.2s;
  
      &:hover {
        background: color.scale(#4caf50, $lightness: -5%);
      }
    }
  }
  
  /* Dialog Styles */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .dialog {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    min-width: 300px;
  
    h3 {
      margin-top: 0;
      font-size: 1.5rem;
      color: #333;
    }
  
    p {
      margin: 1rem 0;
      color: #666;
    }
  
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
        font-weight: 500;
  
        &:first-child {
          background: #ccc;
          color: #333;
  
          &:hover {
            background: #b3b3b3;
          }
        }
  
        &.delete {
          background: #f44336;
          color: white;
  
          &:hover {
            background: #d32f2f;
          }
        }
      }
    }
  }
  
  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  
    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #4caf50;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
  
    span {
      font-size: 1rem;
      color: #666;
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Error Message */
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
  
  /* Global Hidden Class */
  .hidden {
    display: none;
  }
  
  /* 响应式优化 */
  @media (max-width: 768px) {
    .header-actions {
      flex-wrap: wrap;
      gap: 0.5rem;
      
      .z-library-link,
      .upload-btn {
        width: 100%;
        justify-content: center;
      }
    }

    .shelf .books {
      gap: 1.5rem;
      justify-content: center;
    }
  }
  </style>
  