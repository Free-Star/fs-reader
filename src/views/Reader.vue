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
        <button class="tool-btn" @click="toggleReadingMode" v-if="!isPortrait">
          <Icon :icon="readingMode === 'scroll' ? 'mdi:book-open-page-variant' : 'mdi:format-pilcrow'" />
          <span>{{ readingMode === 'scroll' ? '滚动' : '分页' }}</span>
        </button>
        <button class="tool-btn" @click="toggleNotes">
          <Icon icon="mdi:notebook" />
          <span>笔记</span>
        </button>
      </div>

      <div class="sidebar-middle">
        <button class="tool-btn" @click="prevPage" v-if="!isPortrait">
          <Icon icon="mdi:chevron-up" />
        </button>
        <div class="progress-info">
          <div class="progress-circle" @wheel.prevent="handleProgressWheel" @click="handleProgressClick">
            <svg viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#eee"
                stroke-width="2"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
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
          <div class="page-info" v-if="!isPortrait">
            {{ currentPage + 1 }}/{{ totalPages || '-' }}
          </div>
        </div>
        <button class="tool-btn" @click="nextPage" v-if="!isPortrait">
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
          <option value="green">墨绿色</option>
        </select>
      </div>
    </div>

    <!-- 主阅读区域 -->
    <div class="reader-main">
      <!-- 目录侧边栏 -->
      <transition name="fade">
        <div class="toc-overlay" v-if="showToc" @click="toggleToc"></div>
      </transition>

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
      <div 
        class="reader-container" 
        :class="{ 'scroll-mode': readingMode === 'scroll' }"
        ref="readerContainer"></div>

      <!-- 新增右侧笔记栏 -->
      <transition name="fade">
        <div class="notes-overlay" v-if="showNotes" @click="toggleNotes"></div>
      </transition>

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
              <div v-if="!sortedAnnotations.length" class="no-annotations">
                暂无笔记和标注
              </div>
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
              <button @click="saveNote" >保存</button>
            </div>
          </div>
        </div>
      </transition>

      <!-- 选择工具栏 -->
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
            <button @click="openNoteDialog" title="添加笔记">
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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: #fafafa;
  overflow: hidden;

  // 添加竖屏模式的媒体查询
  @media screen and (orientation: portrait) {
    flex-direction: column;
    
    .reader-sidebar {
      width: 100%;
      height: 60px;
      flex-direction: row;
      justify-content: space-between;
      padding: 0 1rem;
      border-right: none;
      border-bottom: 1px solid #eee;

      .sidebar-top,
      .sidebar-middle,
      .sidebar-bottom {
        flex-direction: row;
        padding: 0;
        gap: 0.5rem;
      }

      .tool-btn {
        width: 40px;
        height: 40px;
        
        span {
          display: none;
        }
      }

      .progress-info {
        flex-direction: row;
        gap: 1rem;
        align-items: center;

        .progress-circle {
          width: 40px;
          height: 40px;
        }

        .page-info {
          min-width: 60px;
        }
      }

      .font-size-controls {
        flex-direction: row;
        gap: 0.5rem;
      }
    }

    .reader-main {
      height: calc(100% - 60px);

      :deep(.epub-container) {
        width: 100% !important;
        margin-left: 0 !important;
        height: 100% !important;
      }
    }
  }
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
      /* 修改 opacity 使文字始终可见 */
      opacity: 1;
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
  left: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: white;
  z-index: 300;
  border-right: 1px solid #eee;
  transform: translateX(0);
  
  &.slide-enter-from,
  &.slide-leave-to {
    transform: translateX(-100%);
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
      text-indent: 1rem;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;
      color: #333;
      border-left: 3px solid transparent;

      &:hover {
        background: #f5f5f5;
        color: var(--primary-color);
        border-left-color: var(--primary-color);
      }
    }
  }
}

.reader-container {
  height: 100%;
  padding: 0;
  transition: background-color 0.3s;
  display: block;

  :deep(.epub-container) {
    height: 100% !important;
    width: calc(100% - 80px) !important;
    margin-left: 80px !important;
    transition: background-color 0.3s;

    iframe {
      transition: background-color 0.3s;
      overflow: hidden;

      &::-webkit-scrollbar {
        width: 0;
      }
      
      scrollbar-width: none;
      -ms-overflow-style: none;
      scroll-behavior: smooth;
    }
  }

  // 修改阅读容器在竖屏模式下的样式
  &.scroll-mode {
    @media screen and (orientation: portrait) {
      :deep(.epub-container) {
        iframe {
          padding: 0 20px;
          
          body {
            max-width: 100% !important;
            padding: 20px !important;
          }
        }
      }
    }
  }
}

// 在 style 部分添加全局滚动条样式
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    background: rgba(0, 0, 0, 0.3);
  }
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
  z-index: 400;
  border-left: 1px solid #eee;
  transform: translateX(0);
  display: flex;
  flex-direction: column;
  
  &.slide-enter-from,
  &.slide-leave-to {
    transform: translateX(100%);
  }

  .notes-header {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
    flex-shrink: 0;

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
    height: 0;
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
  z-index: 500;
}

.note-dialog {
  background: white;
  padding: 0;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: transform 0.3s, opacity 0.3s;

  h3 {
    margin: 0;
    padding: 1rem;
    color: var(--primary-color);
    border-bottom: 1px solid #eee;
    font-size: 1.2rem;
  }

  .highlighted-text {
    margin: 1rem;
    padding: 0.8rem;
    background: #f5f5f5;
    border-radius: 4px;
    border-left: 3px solid var(--primary-color);
    margin-bottom: 1rem;
    font-style: italic;
    color: #333;
    font-size: 0.9rem;
    line-height: 1.6;
  }

  textarea {
    width: 100%;
    padding: 1rem;
    margin: 0 1rem;
    width: calc(100% - 4rem);
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 1rem;
    resize: vertical;
    font-size: 1rem;
    font-family: inherit;
    min-height: 100px;
    line-height: 1.6;
    
    &:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
    }
  }

  .dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem;
    background: #f8f8f8;
    border-top: 1px solid #eee;
    border-radius: 0 0 8px 8px;

    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 0.9rem;
      font-weight: 500;

      &:hover {
        background: var(--primary-color-dark);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }

    .primary {
      background: var(--primary-color);
      color: white;
    
      &:hover {
        background: var(--primary-color-dark);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }
    

    button:not(.primary) {
      background: #f0f0f0;
      color: #333;

      &:hover {
        background: #e0e0e0;
        transform: translateY(-1px);
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
  z-index: 600; /* 提高 z-index 以确保在所有层级之上 */
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

  // 修改选择工具栏在竖屏模式下的样式
  @media screen and (orientation: portrait) {
    .toolbar-colors {
      flex-wrap: wrap;
      justify-content: center;
    }

    .toolbar-actions {
      justify-content: center;
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

.toc-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 299;
}

.notes-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 399;
}

// 添加滚动模式下的特殊滚动条样式
.reader-container.scroll-mode {
  :deep(.epub-container) {
    width: 800px !important;
    margin: 0 auto !important;
    padding: 0 20px;
    
    iframe {
      overflow-y: auto;
      
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
        
        &:hover {
          background: rgba(0, 0, 0, 0.3);
        }
      }
    }
  }
}

// 修改目录和笔记面板在竖屏模式下的样式
.toc-panel,
.notes-panel {
  @media screen and (orientation: portrait) {
    width: 85%;
    max-width: 300px;
    
    .toc-header,
    .notes-header {
      padding: 0.8rem;
      
      h3 {
        font-size: 1.1rem;
      }
    }
    
    .toc-content {
      .toc-item {
        padding: 0.7rem 1rem;
        font-size: 0.9rem;
      }
    }
  }
}

// 优化目录内容在竖屏模式下的显示
.toc-content {
  @media screen and (orientation: portrait) {
    .toc-item {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

// 修改竖屏模式下的工具栏样式
.reader {
  @media screen and (orientation: portrait) {
    .reader-sidebar {
      height: 50px; // 减小高度
      padding: 0 0.5rem;
      
      .sidebar-top,
      .sidebar-middle,
      .sidebar-bottom {
        flex-direction: row;
        padding: 0;
        gap: 0.25rem; // 减小间距
      }

      .tool-btn {
        width: 36px; // 减小按钮尺寸
        height: 36px;
        padding: 0;
      }

      .progress-info {
        .progress-circle {
          width: 36px; // 减小进度环尺寸
          height: 36px;
        }
      }

      .font-size-controls {
        gap: 0.25rem;
        
        .font-size {
          min-width: 40px;
          text-align: center;
        }
      }

      .theme-select {
        width: 60px; // 增加宽度
        height: 28px; // 增加高度
        padding: 0 0.3rem;
        font-size: 0.8rem;
        margin-left: 0.5rem; // 添加左边距
      }

      .sidebar-bottom {
        .font-size-controls {
          gap: 0.25rem;
          margin-right: 0.5rem; // 添加右边距，与主题选择器分开
        }
      }
    }

    .reader-main {
      height: calc(100% - 50px); // 调整主内容区域高度
    }
  }
}

// 优化竖屏模式下的工具栏布局
.reader-sidebar {
  @media screen and (orientation: portrait) {
    display: grid;
    grid-template-columns: 1fr auto 1fr; // 三等分布局
    align-items: center;
    gap: 0.5rem; // 添加整体间距
    
    .sidebar-top {
      justify-self: start;
      display: flex;
      gap: 0.25rem;
    }
    
    .sidebar-middle {
      justify-self: center;
    }
    
    .sidebar-bottom {
      justify-self: end;
      display: flex;
      align-items: center; // 确保垂直居中
      gap: 0.5rem; // 增加组件间距
    }
  }
}

// 调整进度环在竖屏模式下的显示
.progress-circle {
  @media screen and (orientation: portrait) {
    svg {
      width: 36px;
      height: 36px;
    }
    
    span {
      font-size: 0.7rem;
    }
  }
}
</style>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookStore } from '../stores/bookStore'
import { Icon } from '@iconify/vue'
import ePub from 'epubjs'
import type { Book } from '../types/book'

// 路由和状管理
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

// 添加更新句柄位的函数
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
  },
  green: {  // 添加墨绿色主题
    body: {
      color: '#333 !important',
      background: '#c8e6c9 !important'  // 使用较浅的墨绿色作为背景
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
    // 保存当前位置
    const currentCfi = rendition.value?.location?.start?.cfi

    // 重新渲染阅读器
    await updateRendition()

    // 选择主题
    await rendition.value.themes.select(themeName)

    // 恢位置
    if (currentCfi) {
      await rendition.value.display(currentCfi)
    }

    // 更新容器背景色
    if (readerContainer.value) {
      const bgColors = {
        dark: '#333',
        sepia: '#f4ecd8',
        light: '#fff',
        green: '#c8e6c9'
      }
      readerContainer.value.style.backgroundColor = bgColors[themeName as keyof typeof bgColors]
    }
  } catch (error) {
    console.error('Error applying theme:', error)
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
    if (readingMode.value === 'scroll') {
      // 在滚动模式下，切换章节时重新渲染
      const currentCfi = href.startsWith('epubcfi') ? href : undefined
      await updateRendition()
      
      if (currentCfi) {
        await rendition.value?.display(currentCfi)
      } else {
        await rendition.value?.display(href)
      }
    } else {
      // 分页模式下保持原有逻辑
      if (href.startsWith('epubcfi')) {
        await rendition.value?.display(href)
      } else {
        await rendition.value?.display(href)
      }
    }
    showToc.value = false
  } catch (e) {
    console.error('Failed to jump to chapter:', e)
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
  if (readingMode.value === 'scroll') {
    const nextSpineItem = rendition.value?.book?.spine?.next()
    if (nextSpineItem) {
      await updateRendition()
      await rendition.value?.display(nextSpineItem.href)
    }
  } else {
    await rendition.value?.next()
  }
}

const prevPage = async () => {
  if (readingMode.value === 'scroll') {
    const prevSpineItem = rendition.value?.book?.spine?.prev()
    if (prevSpineItem) {
      await updateRendition()
      await rendition.value?.display(prevSpineItem.href)
    }
  } else {
    await rendition.value?.prev()
  }
}

// 字体小控制
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
  try {
    const currentLocation = rendition.value?.location?.start?.cfi
    readingMode.value = readingMode.value === 'paginated' ? 'scroll' : 'paginated'
    
    await updateRendition()
    
    if (currentLocation) {
      await rendition.value.display(currentLocation)
    }
  } catch (error) {
    console.error('Error toggling reading mode:', error)
  }
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

// 切换笔记板
const toggleNotes = () => {
  showNotes.value = !showNotes.value
}

// 修改 setHighlightColor 函数
const setHighlightColor = async (color: string) => {
  currentHighlightColor.value = color
  
  // 立即更新渲染器的高亮样式
  if (rendition.value) {
    try {
      // 移除所有现有高亮
      rendition.value.annotations.remove('highlight')
      
      // 重新应用所有高亮
      if (currentBook.value?.annotations) {
        for (const annotation of currentBook.value.annotations) {
          rendition.value.annotations.highlight(
            annotation.cfi,
            {},
            (e: Event) => {
              editNote(annotation)
            },
            '',
            { fill: annotation.color }
          )
        }
      }
      
      // 如果当前有选中的文本，更新选择工具栏的颜色
      if (currentAnnotation.value) {
        currentAnnotation.value.color = color
      }
    } catch (error) {
      console.error('Error updating highlight colors:', error)
    }
  }
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

// 状态变量部分添加
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
    if (currentBook.value?.annotations && currentBook.value.annotations.some(a => a.cfi === cfiRange)) {
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

    // 创建新的标注对象,但不立即应用高亮
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
    if (currentBook.value.annotations && currentBook.value.annotations.some(a => a.cfi === currentAnnotation.value.cfi)) {
      alert('此段文字已被标记或添加过笔记。')
      clearSelection()
      return
    }

    // 在这里应用高亮
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
    await bookStore.updateBook({
      ...currentBook.value,
      annotations: updatedAnnotations
    })
    // 更新本地的 currentBook
    currentBook.value = bookStore.books.find(b => b.id === currentBook.value?.id) || null

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
const openNoteDialog = () => {
  if (currentAnnotation.value) {
    showNoteDialog.value = true
  }
}

// 修改 saveNote 函数
const saveNote = async () => {
  if (!currentAnnotation.value || !currentBook.value) return

  try {
    // 如果是辑现有笔记
    if (currentBook.value.annotations?.some(a => a.id === currentAnnotation.value?.id)) {
      const index = currentBook.value.annotations.findIndex(a => a.id === currentAnnotation.value?.id)
      if (index !== -1) {
        const updatedAnnotations = [...currentBook.value.annotations]
        updatedAnnotations[index] = {
          ...currentAnnotation.value,
          note: noteText.value
        }
        await bookStore.updateBook({
          ...currentBook.value,
          annotations: updatedAnnotations
        })
        // 更新本地的 currentBook
        currentBook.value = bookStore.books.find(b => b.id === currentBook.value?.id) || null
        closeNoteDialog()
        return
      }
    }

    // 如果是新笔记
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

    // 更新��籍数据
    const updatedAnnotations = [...(currentBook.value.annotations || []), updatedAnnotation]
    await bookStore.updateBook({
      ...currentBook.value,
      annotations: updatedAnnotations
    })
    // 更新本地的 currentBook
    currentBook.value = bookStore.books.find(b => b.id === currentBook.value?.id) || null

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
    if (currentBook.value.annotations) {
      currentBook.value.annotations = currentBook.value.annotations.filter(a => a.id !== annotation.id)
      await bookStore.updateBook(currentBook.value)
    }
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

// 在 script setup 的开头添加 isPortrait ref 声明
const isPortrait = ref(window.matchMedia('(orientation: portrait)').matches)

// 在 onMounted 中移动竖屏检测相关代码到外面
const mediaQuery = window.matchMedia('(orientation: portrait)')
const handleOrientationChange = (e: MediaQueryListEvent) => {
  isPortrait.value = e.matches
  if (e.matches) {
    // 竖屏模式下强制使用分页模式
    readingMode.value = 'paginated'
  }
}

onMounted(async () => {
  const bookId = route.params.bookId as string
  currentBook.value = bookStore.books.find(b => b.id === bookId)

  if (!currentBook.value) {
    router.push('/')
    return
  }

  // 初始化 annotations 数组
  if (!Array.isArray(currentBook.value.annotations)) {
    currentBook.value.annotations = []
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

    book.value = ePub(bytes.buffer)

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
          id: index.toString(),
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
      // 添加触摸事件监听
      readerContainer.value.addEventListener('touchstart', handleTouchStart)
      readerContainer.value.addEventListener('touchend', handleTouchEnd)

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

      // 注册 selected 事件，默认启用
      rendition.value.on('selected', handleTextSelection)
    }
  } catch (error) {
    console.error('Error loading book:', error)
    alert('加载电子书时出错')
  }

  // 添加屏幕方向变化监听
  window.matchMedia('(orientation: portrait)').addEventListener('change', async () => {
    await updateRendition()
  })

  // 添加竖屏检测监听
  mediaQuery.addEventListener('change', handleOrientationChange)
})

// 更新渲染器
const updateRendition = async () => {
  if (!readerContainer.value || !book.value) return

  try {
    const rect = readerContainer.value.getBoundingClientRect()
    containerWidth.value = rect.width
    containerHeight.value = rect.height

    // 保存当前位置
    const currentLocation = rendition.value?.location?.start?.cfi

    // 销毁旧的渲染器
    if (rendition.value) {
      rendition.value.destroy()
    }

    // 等待一小段时间确保旧渲染器完全销毁
    await new Promise(resolve => setTimeout(resolve, 100))

    let options = {
      width: rect.width,
      height: rect.height,
      allowScriptedContent: true,
      allowPopups: false,
      spread: isPortrait.value ? 'none' : 'auto', // 使用 ref 值来判断
      flow: readingMode.value === 'paginated' ? 'paginated' : 'scrolled-doc',
      minSpreadWidth: 0,
      manager: readingMode.value === 'paginated' ? 'default' : 'continuous'
    }

    // 创建新的渲染器
    rendition.value = book.value.renderTo(readerContainer.value, options)

    // 等待渲染器准备就绪
    await new Promise(resolve => {
      book.value.ready.then(() => {
        resolve(true)
      }).catch((error: any) => {
        console.error('Book ready error:', error)
        resolve(false)
      })
    })

    // 注册所有主题
    registerThemes()

    // 设置默认样式
    rendition.value.themes.default({
      'body': {
        'padding': readingMode.value === 'paginated' 
          ? (isPortrait.value ? '20px 15px' : '40px 20px')
          : '40px 20px',
        'max-width': readingMode.value === 'paginated' ? 'none' : '800px',
        'margin': '0 auto',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        'line-height': '1.8',
        'text-align': 'justify',
        'font-size': `${fontSize.value}px`,
        'column-gap': readingMode.value === 'paginated' ? '20px' : 'inherit',
        'width': readingMode.value === 'paginated' ? 'auto' : '100%'
      }
    })

    // 应用当前主题
    await rendition.value.themes.select(theme.value)

    // 注册事件监听器
    rendition.value.on('locationChanged', handleLocationChange)
    rendition.value.on('rendered', (section: any) => {
      if (section && rendition.value?.location) {
        handleLocationChange(rendition.value.location)
      }
    })
    rendition.value.on('selected', handleTextSelection)

    // 注册内容钩子
    rendition.value.hooks.content.register((contents: any) => {
      if (contents && contents.document) {
        contents.document.addEventListener('keyup', handleKeyPress)
        contents.document.addEventListener('wheel', handleReaderWheel, { passive: false })
        contents.document.addEventListener('touchstart', handleTouchStart)
        contents.document.addEventListener('touchend', handleTouchEnd)
      }
    })

    // 确保位置信息已生成
    if (!book.value.locations.length()) {
      await book.value.locations.generate(1600)
    }

    // 恢复阅读位置
    if (currentLocation) {
      await rendition.value.display(currentLocation)
    } else {
      await rendition.value.display()
    }

    // 重新应用所有高亮
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

  } catch (error) {
    console.error('Error updating rendition:', error)
  }
}

// 监听主题变化
watch(theme, async (newTheme) => {
  try {
    await applyTheme(newTheme)
  } catch (error) {
    console.error('Error changing theme:', error)
  }
})

// 监听窗口大小变化
const handleResize = debounce(async () => {
  const previousCfi = rendition.value?.location?.start?.cfi
  await updateRendition()
  if (previousCfi) {
    try {
      await rendition.value.display(previousCfi)
    } catch (error) {
      console.warn('Failed to restore position after resize:', error)
    }
  }
}, 300)

// 编辑笔记可以根据需添加更多功能）
const editNote = (annotation: Annotation) => {
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
        view.contents.document.removeEventListener('touchstart', handleTouchStart)
        view.contents.document.removeEventListener('touchend', handleTouchEnd)
      }
    })
    rendition.value.destroy()
  }

  // 移除键盘事件监听
  document.removeEventListener('keyup', handleKeyPress)

  if (wheelThrottleTimeout.value) {
    clearTimeout(wheelThrottleTimeout.value)
  }

  // 移除屏幕方向变化监听
  window.matchMedia('(orientation: portrait)').removeEventListener('change', async () => {
    await updateRendition()
  })

  // 移除竖屏检测监听
  mediaQuery.removeEventListener('change', handleOrientationChange)
})
</script>
