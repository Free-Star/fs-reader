<template>
  <div :class="['app-container', themeClass]" @contextmenu.prevent>
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <router-link 
        to="/" 
        class="sidebar-header"
        @click="resetFilters" 
      >
        <div class="logo">
          <Icon icon="mdi:book-open-page-variant" class="logo-icon" />
          <h1>Fs-reader</h1>
        </div>
      </router-link>
      <nav class="sidebar-nav">
        <a 
          href="https://1lib.sk"
          target="_blank" 
          rel="noopener noreferrer"
          class="nav-link"
        >
          <Icon icon="mdi:library" class="nav-icon" />
          <span>Z-Library</span>
        </a>
        <div class="divider"></div>
        <a 
          href="#favorites" 
          @click.prevent="filterFavorites" 
          class="nav-link"
        >
          <Icon icon="mdi:heart" class="nav-icon" />
          <span>我的收藏</span>
        </a>
        <div class="divider"></div>
        <button class="nav-link upload-btn" @click="triggerFileInput">
          <Icon icon="mdi:upload" class="nav-icon" />
          <span>上传书籍</span>
        </button>
        <input
          type="file"
          ref="fileInput"
          accept=".epub"
          @change="handleFileUpload"
          class="hidden"
        />
      </nav>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
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

        <!-- 设置按钮，仅显示图标 -->
        <button class="settings-icon-btn" @click="toggleSettings" title="设置">
          <Icon icon="mdi:cog" class="settings-icon" />
        </button>
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
            <div 
              v-for="book in group" 
              :key="book.id" 
              class="book" 
              @contextmenu.prevent.stop="showBookPreview(book)"
            >
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
        <p>{{ showFavorites ? '暂无收藏书籍' : '书架空空如也' }}</p>
        <button v-if="!showFavorites" class="upload-btn" @click="triggerFileInput">
          添加第一本书
        </button>
      </div>

      <!-- 设置对话框 -->
      <div v-if="showSettings" class="dialog-overlay" @click="toggleSettings">
        <div class="dialog" @click.stop>
          <h3>设置</h3>
          <div class="settings-section">
            <label for="theme-select">主题色:</label>
            <select v-model="selectedTheme" id="theme-select" @change="applyTheme">
              <option v-for="theme in themes" :key="theme.value" :value="theme.value">
                {{ theme.name }}
              </option>
            </select>
          </div>
          <div class="dialog-actions">
            <button @click="toggleSettings">关闭</button>
          </div>
        </div>
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useBookStore } from '../stores/bookStore'
import { Icon } from '@iconify/vue'
import { Book } from '../types/book'
import epub from 'epubjs'
import Cookies from 'js-cookie'

// 路由和状态管理
const router = useRouter()
const bookStore = useBookStore()

// 参考元素
const fileInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const showDeleteDialog = ref(false)
const bookToDelete = ref<Book | null>(null)
const showSettings = ref(false)

// 主题
const themes = [
  { name: '默认', value: 'default' },
  { name: '蓝色渐变', value: 'blue-gradient' },
  { name: '紫色渐变', value: 'purple-gradient' },
  { name: '橙色渐变', value: 'orange-gradient' },
]
const selectedTheme = ref<string>('default')

// 从Cookies中读取主题设置
const savedTheme = Cookies.get('theme')
if (savedTheme && themes.some(theme => theme.value === savedTheme)) {
  selectedTheme.value = savedTheme
} else {
  selectedTheme.value = 'default'
}

// 应用主题
const applyTheme = () => {
  Cookies.set('theme', selectedTheme.value, { expires: 365 })
}

// 计算主题类
const themeClass = computed(() => {
  return selectedTheme.value
})

// 添加一个计算属性来确保 books 始终是一个数组
const books = computed(() => bookStore.books || [])

// 添加收藏状态变量
const showFavorites = ref(false)

// 修改过滤后的书籍计算属性
const filteredBooks = computed(() => {
  let filtered = books.value.filter(book => 
    book.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
  
  // 如果显示收藏，则只显示收藏的书籍
  if (showFavorites.value) {
    filtered = filtered.filter(book => book.isFavorite)
  }
  
  return filtered
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
      console.warn('获取封面失败:', e)
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
    console.error('处理 epub 文件时出错:', error)
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

// 活动书籍ID
const activeBookId = ref<string | null>(null)

// 显示书籍预览
const showBookPreview = (book: Book) => {
  if (activeBookId.value === book.id) {
    activeBookId.value = null
  } else {
    activeBookId.value = book.id
  }
}

// 修改过滤收藏书籍的方法
const filterFavorites = () => {
  showFavorites.value = true  // 只设置为 true，不再切换
  searchQuery.value = ''
}

// 切换设置对话框
const toggleSettings = () => {
  showSettings.value = !showSettings.value
}

// 监听主题变化并应用
watch(selectedTheme, (newTheme) => {
  applyTheme()
})

// 点击其他地方关闭预览
const closePreview = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.book-preview') && !target.closest('.book-spine')) {
    activeBookId.value = null
  }
}

// 组件挂载时添加点击监听
onMounted(() => {
  document.addEventListener('click', closePreview)
  bookStore.loadBooks()
})

// 组件卸载时移除点击监听
onUnmounted(() => {
  document.removeEventListener('click', closePreview)
})

// 在 script setup 部分添加重置过滤器的方法
const resetFilters = () => {
  showFavorites.value = false
  activeBookId.value = null
  searchQuery.value = ''
}
</script>

<style scoped lang="scss">
@use "sass:color";

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden; /* 防止滚动条 */
}

.app-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  font-family: 'Arial', sans-serif;
  transition: background 0.3s, color 0.3s;
}

/* 主题样式 */
.default {
  --primary-color: #4caf50;
  --primary-hover-color: #43a047; /* 稍微深一点 */
  --secondary-color: #fff;
  --background-color: #f9f9f9;
  --text-color: #333;
}

.blue-gradient {
  --primary-color: #2196F3;
  --primary-hover-color: #1976D2; /* 深蓝 */
  --secondary-color: #fff;
  --background-color: #e3f2fd;
  --text-color: #333;
}

.purple-gradient {
  --primary-color: #9c27b0;
  --primary-hover-color: #7b1fa2; /* 深紫 */
  --secondary-color: #fff;
  --background-color: #f3e5f5;
  --text-color: #333;
}

.orange-gradient {
  --primary-color: #ff9800;
  --primary-hover-color: #fb8c00; /* 深橙 */
  --secondary-color: #fff;
  --background-color: #fff3e0;
  --text-color: #333;
}

/* 侧边栏 */
.sidebar {
  width: 220px;
  background: var(--secondary-color);
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  transition: background 0.3s;
  overflow: hidden; /* 防止内部元素溢出 */

  .sidebar-header {
    margin-bottom: 2rem;
    text-decoration: none; /* 去掉链接下划线 */

    .logo {
      display: flex;
      align-items: center;

      .logo-icon {
        font-size: 1.8rem;
        color: var(--primary-color);
        margin-right: 0.5rem;
      }

      h1 {
        font-size: 1.4rem;
        color: var(--text-color);
      }
    }
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.6rem 1rem;
      background: transparent;
      color: var(--text-color);
      text-decoration: none;
      border-radius: 6px;
      font-size: 1rem;
      transition: background 0.3s, color 0.3s;

      &:hover {
        background: #f0f0f0;
        color: var(--primary-color);
      }

      .nav-icon {
        font-size: 1.2rem;
        color: inherit;
      }

      &.upload-btn {
        background: var(--primary-color);
        color: var(--secondary-color);
        justify-content: center;

        &:hover {
          background: var(--primary-hover-color);
        }
      }
    }

    /* 分割线样式 */
    .divider {
      height: 1px;
      background: #e0e0e0;
      margin: 0.5rem 0;
    }
  }
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: auto;
  background: var(--background-color);
  color: var(--text-color);
  transition: background 0.3s, color 0.3s;
}

/* 搜索栏和控制面板 */
.control-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;

  .search-bar {
    position: relative;
    flex: 1;
    max-width: 300px;

    .search-icon {
      position: absolute;
      top: 50%;
      left: 10px;
      transform: translateY(-50%);
      color: #999;
      font-size: 1rem;
    }

    .search-input {
      width: 100%;
      padding: 0.6rem 0.6rem 0.6rem 2.5rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 0.95rem;
      background: #fff;
      transition: border-color 0.3s;

      &:focus {
        outline: none;
        border-color: var(--primary-color);
      }
    }
  }

  /* 设置按钮样式 */
  .settings-icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: background 0.3s;

    &:hover {
      background: #f0f0f0;
    }

    .settings-icon {
      font-size: 1.5rem;
      color: var(--text-color);
    }
  }
}

/* 阅读统计 */
.reading-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;

  .stat-card {
    display: flex;
    align-items: center;
    padding: 0.8rem 1rem;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);

    .stat-icon {
      font-size: 1.5rem;
      color: var(--primary-color);
      margin-right: 0.5rem;
    }

    .stat-info {
      h3 {
        font-size: 1.2rem;
        color: var(--text-color);
      }

      p {
        font-size: 0.8rem;
        color: #777;
      }
    }
  }
}

/* 书架区域 */
.bookshelf {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto; /* 改为 auto */
}

.shelf {
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;

  .shelf-shadow {
    height: 10px;
    background: #e0e0e0;
    border-radius: 5px;
    margin-bottom: 1rem;
  }

  .books {
    display: flex;
    gap: 1rem;
    flex-wrap: nowrap; /* 防止换行 */
    overflow: visible; /* 允许溢出 */
    position: relative; /* 为绝对定位的预览卡片提供参考 */
  }
}

.book {
  width: 120px;
  position: relative;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
  z-index: 1;

  &:hover {
    transform: scale(1.05);
    z-index: 10;

    .book-preview:not(.preview-fixed) {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
  }
}

.book-spine {
  width: 100%;
  height: 180px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;

  .spine-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s;

    &:hover {
      opacity: 0.9;
    }
  }

  .spine-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.5rem;
    background: rgba(0,0,0,0.6);
    color: #fff;
    font-size: 0.8rem;

    .title {
      display: block;
      font-weight: bold;
      margin-bottom: 0.2rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .author {
      display: block;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.book-preview {
  position: absolute;
  top: 0;
  left: 130%;
  width: 200px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  padding: 0.8rem;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s;
  z-index: 200; /* 提升 z-index */

  &.preview-fixed {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .preview-header {
    font-size: 1rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
    color: #333;
  }

  .preview-cover {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .preview-info {
    font-size: 0.85rem;
    color: #555;
    margin-bottom: 0.5rem;

    p {
      margin-bottom: 0.3rem;
    }
  }

  .progress-bar {
    position: relative;
    height: 5px;
    background: #e0e0e0;
    border-radius: 3px;
    margin-bottom: 0.5rem;

    .progress {
      height: 100%;
      background: var(--primary-color);
      border-radius: 3px;
      transition: width 0.3s;
    }

    .progress-text {
      position: absolute;
      top: -20px;
      right: 0;
      font-size: 0.75rem;
      color: #777;
    }
  }

  .preview-actions {
    display: flex;
    gap: 0.5rem;

    .action-btn {
      flex: 1;
      padding: 0.4rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      transition: background 0.3s;

      &.read {
        background: var(--primary-color);
        color: var(--secondary-color);

        &:hover {
          background: var(--primary-hover-color);
        }
      }

      &.favorite {
        background: #ff4081;
        color: var(--secondary-color);

        &:hover {
          background: #e73370; /* 可根据需要调整 */
        }

        &.active {
          background: #e91e63;
        }
      }

      &.delete {
        background: #f44336;
        color: var(--secondary-color);

        &:hover {
          background: #d32f2f; /* 可根据需要调整 */
        }
      }
    }
  }
}

/* 设置对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  padding: 1.5rem;
  border-radius: 6px;
  width: 300px;

  h3 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    color: var(--text-color);
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin-bottom: 1.5rem;

    label {
      font-size: 0.95rem;
      color: var(--text-color);
    }

    select {
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 0.95rem;
      background: #fff;
      transition: border-color 0.3s;

      &:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      option {
        font-size: 0.95rem;
      }
    }
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;

    button {
      padding: 0.4rem 0.8rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.3s;

      &:first-child {
        background: #ccc;
        color: var(--text-color);

        &:hover {
          background: #b3b3b3;
        }
      }

      &:last-child {
        background: var(--primary-color);
        color: var(--secondary-color);

        &:hover {
          background: var(--primary-hover-color);
        }
      }
    }
  }
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #ccc;
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 0.5rem;
  }

  span {
    font-size: 0.9rem;
    color: #555;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 错误提示 */
.error-message {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffebee;
  color: #c62828;
  padding: 0.8rem 1rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  button {
    background: #c62828;
    color: #fff;
    border: none;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background 0.3s;

    &:hover {
      background: #b71c1c;
    }
  }
}

/* 全局隐藏类 */
.hidden {
  display: none;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #777;

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: var(--primary-color);
    color: var(--secondary-color);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.3s;

    &:hover {
      background: var(--primary-hover-color);
    }
  }
}

/* 书架优化 */
.bookshelf .shelf .books {
  justify-content: flex-start;
}

/* 确保预览卡片在最上层 */
.book-preview {
  z-index: 200;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    padding: 1rem;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .sidebar-nav {
    flex-direction: row;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .sidebar-header {
    flex: 1;
    justify-content: center;
    text-align: center;
  }

  .main-content {
    padding: 1rem;
  }

  .control-panel {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .search-bar {
    max-width: 100%;
  }

  .bookshelf .books {
    justify-content: center;
    gap: 1rem;
  }

  .book-preview {
    left: 110%;
    width: 180px;
  }

  /* 调整侧边栏内按钮样式以适应横向排列 */
  .sidebar-nav .nav-link {
    flex: 1;
    justify-content: center;
  }

  .divider {
    display: none; /* 在移动设备上隐藏分割线 */
  }
}
</style>
