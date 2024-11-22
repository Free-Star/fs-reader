<template>
    <div class="reader">
      <!-- 左侧工具栏 -->
      <div class="reader-sidebar">
        <div class="sidebar-top">
          <button class="tool-btn" @click="goBack">
            <Icon icon="mdi:arrow-left" />
            <span>返回</span>
          </button>
          <button class="tool-btn" @click="toggleToc">
            <Icon icon="mdi:table-of-contents" />
            <span>目录</span>
          </button>
          <button class="tool-btn" @click="toggleReadingMode">
            <Icon :icon="readingMode === 'scroll' ? 'mdi:book-open-page-variant' : 'mdi:format-pilcrow'" />
            <span>{{ readingMode === 'scroll' ? '分页' : '滚动' }}</span>
          </button>
          <!-- 新增高亮模式切换按钮 -->
          <button class="tool-btn" @click="toggleHighlightMode">
            <Icon :icon="isHighlightMode ? 'mdi:highlight-off' : 'mdi:highlight'" />
            <span>{{ isHighlightMode ? '关闭高亮' : '高亮' }}</span>
          </button>
        </div>
  
        <div class="sidebar-middle">
          <button class="tool-btn" @click="prevPage">
            <Icon icon="mdi:chevron-up" />
          </button>
          <div class="progress-info">
            <div class="progress-circle" @wheel.prevent="handleProgressWheel" @click="handleProgressClick">
              <svg viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#eee"
                  stroke-width="2"
                />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#4CAF50"
                  stroke-width="2"
                  :stroke-dasharray="`${progress}, 100`"
                />
                <circle
                  class="progress-handle"
                  :cx="handlePosition.x"
                  :cy="handlePosition.y"
                  r="2"
                  pointer-events="none"
                />
              </svg>
              <span>{{ progress }}%</span>
            </div>
            <div class="page-info">
              {{ currentPage + 1 }}/{{ totalPages || '-' }}
            </div>
          </div>
          <button class="tool-btn" @click="nextPage">
            <Icon icon="mdi:chevron-down" />
          </button>
        </div>
  
        <div class="sidebar-bottom">
          <div class="font-size-controls">
            <button class="tool-btn" @click="decreaseFontSize">
              <Icon icon="mdi:format-font-size-decrease" />
            </button>
            <span class="font-size">{{ fontSize }}px</span>
            <button class="tool-btn" @click="increaseFontSize">
              <Icon icon="mdi:format-font-size-increase" />
            </button>
          </div>
          <select v-model="theme" class="theme-select">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="sepia">护眼</option>
          </select>
          <!-- 添加笔记按钮到工具栏 -->
          <button class="tool-btn animate-btn" @click="toggleNotes">
            <Icon icon="mdi:notebook" />
            <span>笔记</span>
          </button>
        </div>
      </div>
  
      <!-- 主阅读区域 -->
      <div class="reader-main">
        <!-- 目录侧边栏 -->
        <transition name="slide">
          <div class="toc-panel" v-if="showToc">
            <div class="toc-header">
              <h3>目录</h3>
              <button @click="toggleToc">
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div class="toc-content">
              <div 
                v-for="item in navigation" 
                :key="item.href"
                class="toc-item"
                :style="{ paddingLeft: item.level * 20 + 'px' }"
                @click="jumpToChapter(item.href)"
              >
                {{ item.label }}
              </div>
            </div>
          </div>
        </transition>
  
        <!-- 阅读容器 -->
        <div class="reader-container" ref="readerContainer"></div>
  
        <!-- 新增右侧笔记栏 -->
        <transition name="slide">
          <div class="notes-panel" v-if="showNotes">
            <div class="notes-header">
              <h3>笔记和标注</h3>
              <button @click="toggleNotes">
                <Icon icon="mdi:close" />
              </button>
            </div>
            
            <div class="notes-content">
              <div class="annotations-list">
                <div
                  v-for="annotation in sortedAnnotations"
                  :key="annotation.id"
                  class="annotation-item"
                  @click="jumpToAnnotation(annotation)"
                >
                  <div class="annotation-header">
                    <div 
                      class="color-indicator"
                      :style="{ backgroundColor: annotation.color }"
                    ></div>
                    <span class="timestamp">{{ formatDate(annotation.createdAt) }}</span>
                    <div class="actions">
                      <button @click.stop="editNote(annotation)">
                        <Icon icon="mdi:pencil" />
                      </button>
                      <button @click.stop="removeAnnotation(annotation)">
                        <Icon icon="mdi:delete" />
                      </button>
                    </div>
                  </div>
                  <div class="annotation-text" :style="{ borderColor: annotation.color }">
                    {{ annotation.text }}
                  </div>
                  <div v-if="annotation.note" class="annotation-note">
                    {{ annotation.note }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
  
        <!-- 笔记编辑对话框 -->
        <transition name="fade">
          <div v-if="showNoteDialog" class="note-dialog-overlay" @click="closeNoteDialog">
            <div class="note-dialog" @click.stop>
              <h3>添加笔记</h3>
              <div class="highlighted-text">{{ currentAnnotation?.text }}</div>
              <textarea
                v-model="noteText"
                placeholder="输入笔记..."
                rows="4"
              ></textarea>
              <div class="dialog-buttons">
                <button @click="closeNoteDialog">取消</button>
                <button @click="saveNote" class="primary">保存</button>
              </div>
            </div>
          </div>
        </transition>
  
        <!-- 在 template 部分添加选择工具栏 -->
        <transition name="fade">
          <div 
            v-if="selectionToolbar.show" 
            class="selection-toolbar"
            :style="{
              left: `${selectionToolbar.x}px`,
              top: `${selectionToolbar.y}px`
            }"
          >
            <div class="toolbar-colors">
              <button
                v-for="color in highlightColors"
                :key="color"
                class="color-btn"
                :style="{ backgroundColor: color }"
                :class="{ active: currentHighlightColor === color }"
                @click="setHighlightColor(color)"
              ></button>
            </div>
            <div class="toolbar-actions">
              <button @click="saveHighlight" title="添加高亮">
                <Icon icon="mdi:marker" />
              </button>
              <button @click="addNoteDirectly" title="添加笔记">
                <Icon icon="mdi:note-plus" />
              </button>
              <button @click="clearSelection" title="取消">
                <Icon icon="mdi:close" />
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </template>
  
  <style scoped lang="scss">
  :root {
    --primary-color: #4caf50; /* 示例主色 */
    --primary-color-dark: #43a047; /* 深色版本 */
  }
  
  .reader {
    height: 100vh;
    display: flex;
    background: #fafafa;
  }
  
  .reader-sidebar {
    width: 80px;
    background: white;
    border-right: 1px solid #eee;
    display: flex;
    flex-direction: column;
    padding: 1rem 0;
    transition: width 0.3s;
  
    .sidebar-top,
    .sidebar-middle,
    .sidebar-bottom {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 1rem 0;
    }
  
    .sidebar-middle {
      flex: 1;
      justify-content: center;
    }
  
    .progress-circle {
      position: relative;
      width: 50px;
      height: 50px;
      cursor: ns-resize;
  
      svg {
        transform: rotate(-90deg);
  
        path {
          transition: stroke-dasharray 0.2s, stroke 0.2s;
        }
  
        .progress-handle {
          fill: #4CAF50;
          stroke: white;
          stroke-width: 1;
          filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.3));
          pointer-events: none;
        }
      }
  
      span {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 0.8rem;
        font-weight: 500;
        pointer-events: none;
        user-select: none;
      }
  
      &:hover {
        svg path:nth-child(2) {
          stroke: #45a049;
        }
      }
    }
  
    .tool-btn {
      width: 50px;
      height: 50px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.3rem;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 8px;
      color: #666;
      transition: all 0.3s;
  
      span {
        font-size: 0.7rem;
        opacity: 0;
        transition: opacity 0.3s;
        white-space: nowrap;
      }
  
      &:hover {
        background: #f5f5f5;
        color: var(--primary-color);
  
        span {
          opacity: 1;
        }
      }
    }
  
    .animate-btn {
      animation: pulse 2s infinite;
    }
  
    @keyframes pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
      }
      70% {
        transform: scale(1.1);
        box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
      }
    }
  
    .font-size-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
  
      .font-size {
        font-size: 0.8rem;
        color: #666;
      }
    }
  
    .theme-select {
      width: 60px;
      padding: 0.3rem;
      border: 1px solid #eee;
      border-radius: 4px;
      font-size: 0.8rem;
      transition: border-color 0.3s;
  
      &:focus {
        outline: none;
        border-color: var(--primary-color);
      }
    }
  }
  
  .reader-main {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  .toc-panel {
    position: absolute;
    left: 80px;
    top: 0;
    bottom: 0;
    width: 300px;
    background: white;
    transform: translateX(-380px);
    transition: transform 0.3s;
    z-index: 100;
    border-right: 1px solid #eee;
  
    &.show {
      transform: translateX(0);
    }
  
    .toc-header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #eee;
  
      h3 {
        margin: 0;
        font-size: 1.2rem;
        color: var(--primary-color);
      }
  
      button {
        border: none;
        background: none;
        cursor: pointer;
        padding: 0.5rem;
        transition: color 0.3s;
  
        &:hover {
          color: var(--primary-color);
        }
      }
    }
  
    .toc-content {
      overflow-y: auto;
      height: calc(100% - 60px);
  
      .toc-item {
        padding: 0.8rem 1rem;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
        color: #333;
  
        &:hover {
          background: #f5f5f5;
          color: var(--primary-color);
        }
      }
    }
  }
  
  .reader-container {
    height: 100%;
    padding: 0 20px;
    transition: background-color 0.3s;
  
    :deep(.epub-container) {
      height: 100% !important;
      margin: 0 auto;
      transition: background-color 0.3s;
  
      iframe {
        transition: background-color 0.3s;
  
        &::-webkit-scrollbar {
          display: none;
        }
        scrollbar-width: none;
        -ms-overflow-style: none;
        scroll-behavior: smooth;
      }
    }
  }
  
  // 在 style 部分添加全局滚动条样式
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  
  .progress-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  
    .page-info {
      font-size: 0.8rem;
      color: #666;
      white-space: nowrap;
    }
  }
  
  .notes-panel {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 300px;
    background: white;
    transform: translateX(300px);
    transition: transform 0.3s;
    z-index: 100;
    border-left: 1px solid #eee;
    display: flex;
    flex-direction: column;
    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
  
    &.show {
      transform: translateX(0);
    }
  
    .notes-header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #eee;
  
      h3 {
        margin: 0;
        font-size: 1.2rem;
        color: var(--primary-color);
      }
  
      button {
        border: none;
        background: none;
        cursor: pointer;
        padding: 0.5rem;
        transition: color 0.3s;
  
        &:hover {
          color: var(--primary-color);
        }
      }
    }
  
    .notes-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      background: #fafafa;
    }
  
    .annotations-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  
    .annotation-item {
      padding: 1rem;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: background 0.3s, transform 0.2s;
  
      &:hover {
        background: #f5f5f5;
        transform: translateY(-2px);
      }
  
      .annotation-header {
        display: flex;
        align-items: center;
        margin-bottom: 0.5rem;
  
        .color-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 0.5rem;
        }
  
        .timestamp {
          font-size: 0.8rem;
          color: #666;
        }
  
        .actions {
          margin-left: auto;
          display: flex;
          gap: 0.5rem;
  
          button {
            background: none;
            border: none;
            cursor: pointer;
            color: #666;
            transition: color 0.3s;
  
            &:hover {
              color: var(--primary-color);
            }
          }
        }
      }
  
      .annotation-text {
        padding: 0.5rem;
        border-left: 3px solid;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        color: #333;
      }
  
      .annotation-note {
        font-size: 0.9rem;
        color: #666;
        padding: 0.5rem;
        background: #f9f9f9;
        border-radius: 4px;
      }
    }
  }
  
  .note-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .note-dialog {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transition: transform 0.3s, opacity 0.3s;
  
    h3 {
      margin-top: 0;
      color: var(--primary-color);
    }
  
    .highlighted-text {
      padding: 1rem;
      background: #f5f5f5;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-style: italic;
      color: #333;
    }
  
    textarea {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 1rem;
      resize: vertical;
      font-size: 1rem;
      font-family: inherit;
    }
  
    .dialog-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
  
      button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.3s, color 0.3s;
        font-size: 1rem;
      }
  
      .primary {
        background: var(--primary-color);
        color: white;
      
        &:hover {
          background: var(--primary-color-dark);
        }
      }
      
  
      button:not(.primary) {
        background: #f0f0f0;
        color: #333;
  
        &:hover {
          background: #e0e0e0;
        }
      }
    }
  }
  
  .selection-toolbar {
    position: fixed;
    transform: translate(-50%, -100%);
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 8px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: opacity 0.3s, transform 0.3s;
  
    &::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid white;
    }
  
    .toolbar-colors {
      display: flex;
      gap: 4px;
      padding: 4px;
  
      .color-btn {
        width: 20px;
        height: 20px;
        border: 2px solid transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: transform 0.2s, border-color 0.3s;
  
        &:hover {
          transform: scale(1.1);
        }
  
        &.active {
          border-color: #333;
        }
      }
    }
  
    .toolbar-actions {
      display: flex;
      gap: 4px;
      padding: 4px;
  
      button {
        background: none;
        border: none;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        color: #666;
        transition: all 0.3s;
  
        &:hover {
          background: #f5f5f5;
          color: var(--primary-color);
        }
      }
    }
  }
  
  /* Transition Styles */
  .slide-enter-active, .slide-leave-active {
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
  .slide-enter, .slide-leave-to /* .slide-leave-active in <2.1.8 */ {
    transform: translateX(100%);
    opacity: 0;
  }
  
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.3s ease;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }
  </style>
  
  <script setup lang="ts">
  import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useBookStore } from '../stores/bookStore'
  import { Icon } from '@iconify/vue'
  import epub from 'epubjs'
  import type { Book } from '../types/book'
  
  // 路由和状态管理
  const route = useRoute()
  const router = useRouter()
  const bookStore = useBookStore()
  
  // 参考元素
  const readerContainer = ref<HTMLElement | null>(null)
  
  // 状态变量
  const book = ref<any>(null)
  const rendition = ref<any>(null)
  const currentBook = ref<Book | null>(null)
  const progress = ref(0)
  const theme = ref('light')
  const fontSize = ref(16)
  const showToc = ref(false)
  const navigation = ref<any[]>([])
  const readingMode = ref<'scroll' | 'paginated'>('paginated')
  const containerWidth = ref(0)
  const containerHeight = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(0)
  
  // 计算控制点位置
  const handlePosition = ref({
    x: 18,
    y: 2.0845
  })
  
  // 添加更新句柄位置的函数
  const updateHandlePosition = (progressValue: number) => {
    const radius = 15.9155
    const center = 18
    const angle = (progressValue / 100) * 2 * Math.PI - (Math.PI / 2)
    handlePosition.value = {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    }
  }
  
  // 防抖函数
  function debounce(fn: Function, delay: number) {
    let timeoutId: number
    return function (...args: any[]) {
      clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => fn.apply(null, args), delay)
    }
  }
  
  // 主题定义
  const themes = {
    light: {
      body: {
        color: '#333 !important',
        background: '#fff !important'
      }
    },
    dark: {
      body: {
        color: '#fff !important',
        background: '#333 !important'
      }
    },
    sepia: {
      body: {
        color: '#5b4636 !important',
        background: '#f4ecd8 !important'
      }
    }
  }
  
  // 一次性注册所有主题的函数
  const registerThemes = () => {
    if (!rendition.value) return
  
    Object.entries(themes).forEach(([name, styles]) => {
      rendition.value.themes.register(name, styles)
    })
  }
  
  // 主题应用函数
  const applyTheme = async (themeName: string) => {
    if (!rendition.value) return
  
    try {
      // 选择主题
      await rendition.value.themes.select(themeName)
  
      // 更新容器背景色
      if (readerContainer.value) {
        const bgColors = {
          dark: '#333',
          sepia: '#f4ecd8',
          light: '#fff'
        }
        readerContainer.value.style.backgroundColor = bgColors[themeName as keyof typeof bgColors]
      }
    } catch (error) {
      console.warn('Error applying theme:', error)
    }
  }
  
  // 展平目录结构，添加层级信息
  const flattenNavigation = (items: any[], level = 0): any[] => {
    return items.reduce((acc: any[], item) => {
      const newItem = {
        id: item.id || `${item.href}-${level}`,
        href: item.href,
        label: item.label || item.title,
        level
      }
      acc.push(newItem)
      if (item.subitems?.length) {
        acc.push(...flattenNavigation(item.subitems, level + 1))
      }
      return acc
    }, [])
  }
  
  // TOC 切换
  const toggleToc = () => {
    showToc.value = !showToc.value
  }
  
  // 跳转到指定章节
  const jumpToChapter = async (href: string) => {
    try {
      if (href.startsWith('epubcfi')) {
        await rendition.value?.display(href)
      } else {
        await rendition.value?.display(href)
      }
      showToc.value = false
    } catch (e) {
      console.warn('Failed to jump to chapter:', e)
    }
  }
  
  // 处理位置变化
  const handleLocationChange = async (location: any) => {
    if (!book.value || !currentBook.value) return
  
    try {
      const currentLocation = location?.start || location?.end || location
  
      if (!currentLocation) {
        console.warn('Invalid location object:', location)
        return
      }
  
      // 确保位置信息已生成
      if (!book.value.locations.length()) {
        await book.value.locations.generate(1600)
      }
  
      let currentCfi = currentLocation.cfi || rendition.value?.location?.start?.cfi
      let currentPageIndex = 0
      let percentage = 0
  
      try {
        if (currentCfi) {
          // 获取精确的页码
          currentPageIndex = book.value.locations.locationFromCfi(currentCfi)
          // 计算百分比用于显示
          percentage = currentPageIndex / book.value.locations.total
        } else if (currentLocation.href) {
          const spineItem = book.value.spine.get(currentLocation.href)
          if (spineItem) {
            const index = book.value.spine.items.indexOf(spineItem)
            percentage = index / book.value.spine.items.length
            currentPageIndex = Math.floor(percentage * book.value.locations.total)
          }
        }
      } catch (e) {
        console.warn('Error calculating page:', e)
        percentage = currentLocation.percentage || 0
        currentPageIndex = Math.floor(percentage * book.value.locations.total)
      }
  
      // 更新显示的进度
      const progressValue = Math.round(percentage * 100)
      progress.value = progressValue
      updateHandlePosition(progressValue)
  
      // 更新页码信息
      if (book.value.locations?.total) {
        totalPages.value = book.value.locations.total
        currentPage.value = currentPageIndex
      }
  
      // 保存阅读位置和页码
      try {
        if (currentCfi) {
          // 保存 CFI 到 localStorage
          localStorage.setItem(`book-${currentBook.value.id}-position`, currentCfi)
          
          // 更新 Store 中的信息
          await bookStore.updateBook({
            ...currentBook.value,
            progress: progressValue,
            currentPage: currentPageIndex,
            totalPages: totalPages.value,
            currentCfi: currentCfi
          })
        }
      } catch (error) {
        console.error('Error saving reading progress:', error)
      }
  
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }
  
  // 处理进度环点击
  const handleProgressClick = async (event: MouseEvent) => {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const percentage = (event.clientX - rect.left) / rect.width
  
    if (!book.value?.locations?.total) return
  
    const targetLocation = Math.floor(percentage * book.value.locations.total)
    const cfi = book.value.locations.cfiFromLocation(targetLocation)
    await rendition.value?.display(cfi)
  }
  
  // 回到图书馆
  const goBack = () => {
    router.push('/')
  }
  
  // 翻页函数
  const nextPage = async () => {
    await rendition.value?.next()
  }
  
  const prevPage = async () => {
    await rendition.value?.prev()
  }
  
  // 字体大小控制
  const increaseFontSize = () => {
    fontSize.value = Math.min(fontSize.value + 2, 24)
    rendition.value?.themes.fontSize(`${fontSize.value}px`)
  }
  
  const decreaseFontSize = () => {
    fontSize.value = Math.max(fontSize.value - 2, 12)
    rendition.value?.themes.fontSize(`${fontSize.value}px`)
  }
  
  // 滚轮事件处理函数
  const handleReaderWheel = (event: WheelEvent) => {
    // 如果事件在进度环上，则忽略
    if ((event.target as Element).closest('.progress-circle')) {
      return
    }
  
    // 在滚动模式下，保持原生滚动行为
    if (readingMode.value === 'scroll') {
      return // 直接返回，不阻止默认行为
    }
  
    // 只在分页模式下阻止默认滚动行为
    event.preventDefault()
    event.stopPropagation()
  
    // 在分页模式下，使用节流来控制翻页频率
    if (wheelThrottleTimeout.value === null) {
      wheelThrottleTimeout.value = window.setTimeout(() => {
        if (event.deltaY > 0) {
          nextPage()
        } else {
          prevPage()
        }
        wheelThrottleTimeout.value = null
      }, 150)
    }
  }
  
  // 节流变量
  const wheelThrottleTimeout = ref<number | null>(null)
  
  // 处理进度环滚轮
  const handleProgressWheel = async (event: WheelEvent) => {
    event.preventDefault()
  
    if (!book.value?.locations?.total) return
  
    const scrollIntensity = Math.abs(event.deltaY)
    const baseStep = 1
    const step = Math.min(Math.max(scrollIntensity / 100, baseStep), 5)
  
    const delta = event.deltaY > 0 ? -step : step
    let newProgress = progress.value + delta
    newProgress = Math.max(0, Math.min(100, Math.round(newProgress)))
  
    if (newProgress !== progress.value) {
      progress.value = newProgress
      updateHandlePosition(newProgress)
      
      if (wheelThrottleTimeout.value === null) {
        wheelThrottleTimeout.value = window.setTimeout(async () => {
          try {
            const percentage = newProgress / 100
            const cfi = book.value.locations.cfiFromPercentage(percentage)
            await rendition.value?.display(cfi)
          } catch (error) {
            console.error('Error navigating to location:', error)
          }
          wheelThrottleTimeout.value = null
        }, 100)
      }
    }
  }
  
  // 切换阅读模式
  const toggleReadingMode = async () => {
    // 保存当前位置的 CFI
    const currentCfi = rendition.value?.location?.start?.cfi
    
    // 切换阅读模式
    readingMode.value = readingMode.value === 'paginated' ? 'scroll' : 'paginated'
    
    // 更新渲染器
    await updateRendition()
    
    // 恢复阅读位置
    if (currentCfi) {
      try {
        await rendition.value.display(currentCfi)
      } catch (e) {
        console.warn('Failed to restore position after mode switch:', e)
      }
    }
  
    // 应用主题
    await applyTheme(theme.value)
  }
  
  // 键盘事件处理函数
  const handleKeyPress = (event: KeyboardEvent) => {
    // 防止事件重复触发
    event.stopPropagation()
  
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        prevPage()
        break
      case 'ArrowRight':
      case 'ArrowDown':
        nextPage()
        break
    }
  }
  
  // 触摸事件处理
  let touchStartX = 0
  const handleTouchStart = (event: TouchEvent) => {
    touchStartX = event.changedTouches[0].screenX
  }
  
  const handleTouchEnd = (event: TouchEvent) => {
    const touchEndX = event.changedTouches[0].screenX
    const delta = touchEndX - touchStartX
  
    if (Math.abs(delta) > 50) {
      if (delta > 0) {
        prevPage()
      } else {
        nextPage()
      }
    }
  }
  
  // 笔记相关的状态
  const showNotes = ref(false)
  const isHighlightMode = ref(false)
  const currentHighlightColor = ref('#ffeb3b')
  const showNoteDialog = ref(false)
  const noteText = ref('')
  const currentAnnotation = ref<Annotation | null>(null)
  
  // 高亮颜色选项
  const highlightColors = [
    '#ffeb3b', // 黄色
    '#ff9800', // 橙色
    '#4caf50', // 绿色
    '#03a9f4', // 蓝色
    '#e91e63'  // 粉色
  ]
  
  // 计算属性：按时间排序的笔记
  const sortedAnnotations = computed(() => {
    return [...(currentBook.value?.annotations || [])].sort((a, b) => b.createdAt - a.createdAt)
  })
  
  // 切换笔记面板
  const toggleNotes = () => {
    showNotes.value = !showNotes.value
  }
  
  // 切换高亮模式
  const toggleHighlightMode = () => {
    isHighlightMode.value = !isHighlightMode.value
    console.log('Highlight mode toggled to:', isHighlightMode.value)
    if (rendition.value) {
      if (isHighlightMode.value) {
        // 启用高亮模式，注册 'selected' 事件
        rendition.value.on('selected', handleTextSelection)
        console.log('Registered handleTextSelection to rendition.selected')
      } else {
        // 关闭高亮模式，移除 'selected' 事件
        rendition.value.off('selected', handleTextSelection)
        console.log('Unregistered handleTextSelection from rendition.selected')
        clearSelection() // 清除任何现有的选择和工具栏
      }
    }
  }
  
  // 设置高亮颜色
  const setHighlightColor = (color: string) => {
    currentHighlightColor.value = color
  }
  
  // 在 script setup 部分添加 Annotation 类型定义
  interface Annotation {
    id: string
    cfi: string
    text: string
    color: string
    createdAt: number
    note?: string
  }
  
  // 在状态变量部分添加
  const selectionToolbar = ref<{
    show: boolean
    x: number
    y: number
  }>({
    show: false,
    x: 0,
    y: 0
  })
  
  // 修改 handleTextSelection 函数
  const handleTextSelection = async (cfiRange: string, contents: any) => {
    try {
      console.log('handleTextSelection called with CFI:', cfiRange)
  
      // 确保 contents 和 window 对象存在
      if (!contents?.window) {
        console.warn('Contents window not available')
        return
      }
  
      // 获取选中的文本
      const selection = contents.window.getSelection()
      if (!selection) {
        console.warn('No selection available')
        return
      }
  
      const text = selection.toString().trim()
      if (!text) {
        selectionToolbar.value.show = false
        return
      }
  
      // 检查是否已经有相同的CFI标注
      if (currentBook.value?.annotations.some(a => a.cfi === cfiRange)) {
        alert('此段文字已被标记或添加过笔记。')
        clearSelection()
        return
      }
  
      // 获取选区位置
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
  
      // 获取 iframe 的位置信息
      const iframe = contents.document.defaultView?.frameElement
      if (!iframe) {
        console.warn('Iframe not found')
        return
      }
      const iframeRect = iframe.getBoundingClientRect()
  
      // 计算工具栏的绝对位置（相对于视口）
      const absoluteX = iframeRect.left + rect.left + rect.width / 2
      const absoluteY = iframeRect.top + rect.top
  
      // 确保工具栏不会超出视口边界
      const toolbarX = Math.max(50, Math.min(absoluteX, window.innerWidth - 50))
      const toolbarY = Math.max(50, absoluteY)
  
      // 更新工具栏位置
      selectionToolbar.value = {
        show: true,
        x: toolbarX,
        y: toolbarY
      }
  
      // 创建新的标注
      currentAnnotation.value = {
        id: Date.now().toString(),
        cfi: cfiRange,
        text,
        color: currentHighlightColor.value,
        createdAt: Date.now()
      }
  
      console.log('Selection toolbar position set to:', selectionToolbar.value)
    } catch (error) {
      console.error('Error handling text selection:', error)
      selectionToolbar.value.show = false
    }
  }
  
  // 修改 saveHighlight 函数
  const saveHighlight = async () => {
    if (!currentAnnotation.value || !currentBook.value) return
  
    try {
      // 检查是否已存在相同的CFI标注
      if (currentBook.value.annotations.some(a => a.cfi === currentAnnotation.value.cfi)) {
        alert('此段文字已被标记或添加过笔记。')
        clearSelection()
        return
      }
  
      // 添加高亮
      rendition.value.annotations.highlight(
        currentAnnotation.value.cfi,
        {},
        (e: Event) => {
          editNote(currentAnnotation.value!)
        },
        '',
        { fill: currentAnnotation.value.color }
      )
  
      // 更新书籍数据
      const updatedAnnotations = [...(currentBook.value.annotations || []), currentAnnotation.value]
      currentBook.value.annotations = updatedAnnotations
      await bookStore.updateBook(currentBook.value)
  
      // 清除选择和工具栏
      clearSelection()
  
    } catch (error) {
      console.error('Error saving highlight:', error)
    }
  }
  
  // 添加清除选择的通用函数
  const clearSelection = () => {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selectionToolbar.value.show = false
    currentAnnotation.value = null
  }
  
  // 修改 addNoteDirectly 函数
  const addNoteDirectly = () => {
    if (currentAnnotation.value) {
      showNoteDialog.value = true
    }
  }
  
  // 修改 saveNote 函数
  const saveNote = async () => {
    if (!currentAnnotation.value || !currentBook.value) return
  
    try {
      // 检查是否已存在相同的CFI标注
      if (currentBook.value.annotations.some(a => a.cfi === currentAnnotation.value.cfi)) {
        alert('此段文字已被标记或添加过笔记。')
        closeNoteDialog()
        clearSelection()
        return
      }
  
      const updatedAnnotation = {
        ...currentAnnotation.value,
        note: noteText.value
      }
  
      // 先添加高亮
      rendition.value.annotations.highlight(
        updatedAnnotation.cfi,
        {},
        (e: Event) => {
          editNote(updatedAnnotation)
        },
        '',
        { fill: updatedAnnotation.color }
      )
  
      // 更新书籍数据
      const updatedAnnotations = [...(currentBook.value.annotations || []), updatedAnnotation]
      currentBook.value.annotations = updatedAnnotations
      await bookStore.updateBook(currentBook.value)
  
      // 关闭对话框并清除选择
      closeNoteDialog()
      clearSelection()
    } catch (error) {
      console.error('Error saving note:', error)
    }
  }
  
  // 关闭笔记对话框
  const closeNoteDialog = () => {
    showNoteDialog.value = false
    currentAnnotation.value = null
    noteText.value = ''
  }
  
  // 跳转到标注位置
  const jumpToAnnotation = async (annotation: Annotation) => {
    try {
      await rendition.value.display(annotation.cfi)
      // 高亮显示跳转后的标注
      rendition.value.annotations.highlight(annotation.cfi, {}, () => {}, '', { fill: annotation.color })
    } catch (error) {
      console.error('Error jumping to annotation:', error)
    }
  }
  
  // 删除标注
  const removeAnnotation = async (annotation: Annotation) => {
    if (!currentBook.value) return
  
    try {
      // 移除高亮
      rendition.value.annotations.remove(annotation.cfi, 'highlight')
  
      // 更新书籍数据
      currentBook.value.annotations = currentBook.value.annotations.filter(a => a.id !== annotation.id)
      await bookStore.updateBook(currentBook.value)
    } catch (error) {
      console.error('Error removing annotation:', error)
    }
  }
  
  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }
  
  // 主初始化逻辑
  onMounted(async () => {
    const bookId = route.params.bookId as string
    currentBook.value = bookStore.books.find(b => b.id === bookId) || null
  
    if (!currentBook.value) {
      router.push('/')
      return
    }
  
    // 设置初始进度
    const initialProgress = currentBook.value.progress || 0
    progress.value = initialProgress
    updateHandlePosition(initialProgress)
  
    try {
      // 从 Base64 字符串加载电子书
      const base64Data = currentBook.value.file.split(',')[1]
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
  
      book.value = epub(bytes.buffer)
  
      // 等待书籍加载完成
      await book.value.ready
  
      // 加载目录
      try {
        const nav = await book.value.loaded.navigation
        if (nav && nav.toc) {
          navigation.value = flattenNavigation(nav.toc)
        } else {
          const spineItems = book.value.spine.items
          navigation.value = spineItems.map((item: any, index: number) => ({
            id: index,
            href: item.href,
            label: `章节 ${index + 1}`,
            level: 0
          }))
        }
      } catch (e) {
        console.warn('Failed to load navigation:', e)
        navigation.value = []
      }
  
      // 初始化渲染器
      if (readerContainer.value) {
        window.addEventListener('resize', handleResize)
        await updateRendition()
  
        // 添加键盘事件监听
        document.addEventListener('keyup', handleKeyPress)
  
        // 恢复上次阅读位置
        try {
          const lastCfi = localStorage.getItem(`book-${currentBook.value.id}-position`)
          if (lastCfi && book.value.spine) {
            try {
              // 先生成位置信息
              if (!book.value.locations.length()) {
                await book.value.locations.generate(1600)
              }
  
              // 验证 CFI 是否有效
              const isValidCfi = await new Promise((resolve) => {
                try {
                  const location = book.value.locations.locationFromCfi(lastCfi)
                  resolve(location !== -1)
                } catch {
                  resolve(false)
                }
              })
  
              if (isValidCfi) {
                await rendition.value.display(lastCfi)
              } else if (currentBook.value.currentCfi) {
                // 尝试使用存储在 store 中的 CFI
                await rendition.value.display(currentBook.value.currentCfi)
              } else if (currentBook.value.currentPage > 0) {
                // 尝试使用存储的页码
                const cfi = book.value.locations.cfiFromLocation(currentBook.value.currentPage)
                await rendition.value.display(cfi)
              } else {
                await rendition.value.display()
              }
            } catch (error) {
              console.warn('Failed to restore position:', error)
              await rendition.value.display()
            }
          } else {
            await rendition.value.display()
          }
        } catch (error) {
          console.error('Error initializing reader:', error)
          await rendition.value.display()
        }
      }
    } catch (error) {
      console.error('Error loading book:', error)
      alert('加载电子书时出错')
    }
  
    // 恢复高亮
    if (currentBook.value?.annotations) {
      currentBook.value.annotations.forEach(annotation => {
        rendition.value.annotations.highlight(
          annotation.cfi,
          {},
          (e: Event) => {
            editNote(annotation)
          },
          '',
          { fill: annotation.color }
        )
      })
    }
  })
  
  // 更新渲染器
  const updateRendition = async () => {
    if (!readerContainer.value || !book.value) return
  
    try {
      const rect = readerContainer.value.getBoundingClientRect()
      containerWidth.value = rect.width
      containerHeight.value = rect.height
  
      // 销毁旧的渲染器
      if (rendition.value) {
        rendition.value.destroy()
      }
  
      let options = {
        width: rect.width,
        height: rect.height,
        allowScriptedContent: true,
        allowPopups: false,
        spread: readingMode.value === 'paginated' ? 'always' : 'none',
        flow: readingMode.value === 'paginated' ? 'paginated' : 'scrolled-doc',
        minSpreadWidth: rect.width * 0.8,
        manager: readingMode.value === 'paginated' ? 'default' : 'continuous',
      }
  
      // 创建新的渲染器
      rendition.value = book.value.renderTo(readerContainer.value, options)
  
      // 注册所有主题
      registerThemes()
  
      // 设置默认样式
      rendition.value.themes.default({
        'body': {
          'padding': readingMode.value === 'paginated' ? '40px 60px' : '40px 80px',
          'max-width': readingMode.value === 'paginated' ? 'none' : '1200px',
          'margin': '0 auto',
          'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          'line-height': '1.8',
          'text-align': 'justify',
          'font-size': `${fontSize.value}px`,
          'column-gap': readingMode.value === 'paginated' ? '60px' : 'inherit'
        }
      })
  
      // 确保在设置渲染器后生成位置信息
      if (!book.value.locations.length()) {
        await book.value.locations.generate(1600)
      }
  
      // 添加位置变化监听
      rendition.value.on('locationChanged', (location: any) => {
        // 确保传入有效的位置对象
        if (location) {
          handleLocationChange(location)
        }
      })
  
      // 添加额外的进度更新监听
      rendition.value.on('rendered', (section: any) => {
        if (section && rendition.value?.location) {
          handleLocationChange(rendition.value.location)
        }
      })
  
      // 注册内容钩子
      rendition.value.hooks.content.register((contents: any) => {
        if (contents && contents.document) {
          contents.document.addEventListener('keyup', handleKeyPress)
          contents.document.addEventListener('wheel', handleReaderWheel, { passive: false })
        }
      })
  
      // 等待渲染器准备就绪
      await rendition.value.display()
  
      // 应用当前主题
      await applyTheme(theme.value)
  
      // 生成分页信息
      if (!book.value.locations.length()) {
        await book.value.locations.generate(1600)
        // book.value.locations.total 已经设置
      }
  
      // 设置字体大小
      rendition.value.themes.fontSize(`${fontSize.value}px`)
  
      // 更新进度环
      progress.value = currentBook.value?.progress || 0
    } catch (error) {
      console.error('Error updating rendition:', error)
    }
  }
  
  // 监听主题变化
  watch(theme, async (newTheme) => {
    await applyTheme(newTheme)
  })
  
  // 监听窗口大小变化
  const handleResize = debounce(async () => {
    await updateRendition()
  }, 300)
  
  // 编辑笔记（暂未实现，可以根据需要添加）
  const editNote = (annotation: Annotation) => {
    // 实现编辑笔记的逻辑
    // 例如，打开笔记编辑对话框并加载现有笔记
    noteText.value = annotation.note || ''
    currentAnnotation.value = annotation
    showNoteDialog.value = true
  }
  
  // 清理事件监听
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  
    if (rendition.value) {
      // 移除所有内容的事件监听
      rendition.value.views().forEach((view: any) => {
        if (view?.contents?.document) {
          view.contents.document.removeEventListener('keyup', handleKeyPress)
          view.contents.document.removeEventListener('wheel', handleReaderWheel)
        }
      })
      rendition.value.destroy()
    }
  
    // 移除键盘事件监听
    document.removeEventListener('keyup', handleKeyPress)
  
    if (wheelThrottleTimeout.value) {
      clearTimeout(wheelThrottleTimeout.value)
    }
  })
  </script>
  