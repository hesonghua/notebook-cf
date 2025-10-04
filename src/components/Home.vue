<template>
  <div class="container">
    <!-- 移动端侧边栏遮罩 -->
    <div
      v-if="isMobile && sidebarVisible"
      class="sidebar-overlay"
      @click="toggleSidebar"
    ></div>
    
    <!-- 侧边栏 -->
    <Sidebar
      :class="{ 'sidebar-mobile': isMobile, 'sidebar-visible': sidebarVisible }"
      :isSidebarCollapsed="isSidebarCollapsed"
      @toggle-sidebar="toggleSidebar"
      :style="!isMobile ? { width: isSidebarCollapsed ? '50px' : `${sidebarWidth}px` } : {}"
    />
    
    <!-- 桌面端调整器 -->
    <div
      v-if="!isMobile && !isSidebarCollapsed"
      class="resizer"
      @mousedown="startResize"
    ></div>
    
    <main class="main-content" v-if="noteStore.selectedNote">
        <div class="editor-header">
          <!-- 移动端菜单按钮 -->
          <button
            v-if="isMobile"
            class="mobile-menu-btn"
            @click="toggleSidebar"
            data-tooltip="菜单"
          >
            ☰
          </button>
          
          <div class="editor-controls">
            <div class="view-mode-buttons">
              <button
                class="view-mode-btn"
                :class="{ active: viewMode === 'edit' }"
                @click="setViewMode('edit')"
                data-tooltip="编辑模式"
              >
                📝
              </button>
              <button
                v-if="!isMobile"
                class="view-mode-btn"
                :class="{ active: viewMode === 'split' }"
                @click="setViewMode('split')"
                data-tooltip="分屏模式"
              >
                📄
              </button>
              <button
                class="view-mode-btn"
                :class="{ active: viewMode === 'preview' }"
                @click="setViewMode('preview')"
                data-tooltip="预览模式"
              >
                👁️
              </button>
            </div>
            
            <button
              class="save-btn"
              @click="saveCurrentNote"
              :disabled="!noteStore.selectedNote?.dirty"
              data-tooltip="保存文章 (Ctrl+S)"
            >
              💾
            </button>
            
            <button
              class="logout-btn"
              @click="logout"
              data-tooltip="注销登录"
            >
              🚪
            </button>
          </div>
        </div>
        <div class="editor-container" :class="`view-mode-${viewMode}`">
            <textarea
              v-show="viewMode === 'edit' || (viewMode === 'split' && !isMobile)"
              class="markdown-source"
              :value="noteStore.selectedNote.content"
              @input="updateNoteContent"
              ref="editorRef"
              @scroll="handleEditorScroll"
            ></textarea>
            <MarkdownPreview
              v-show="viewMode === 'preview' || (viewMode === 'split' && !isMobile)"
              :selectedNote="noteStore.selectedNote"
              ref="previewRef"
              @scroll="handlePreviewScroll"
            />
        </div>
    </main>
    <main class="main-content" v-else>
      <div class="editor-header" v-if="isMobile">
        <button
          class="mobile-menu-btn"
          @click="toggleSidebar"
          data-tooltip="菜单"
        >
          ☰
        </button>
        <div class="editor-controls"></div> <!-- 添加空的控制区域以保持布局一致 -->
      </div>
      <div class="no-note-selected">
        <p>Select a note to view, or create a new one.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useNoteStore } from '../stores/noteStore.js';
import Sidebar from './Sidebar.vue';
import MarkdownPreview from './MarkdownPreview.vue';

const emitter = inject('emitter');
const router = useRouter();
const noteStore = useNoteStore();
const editorRef = ref(null);
const previewRef = ref(null);
let isSyncing = false;

const sidebarWidth = ref(280);
const isResizing = ref(false);
const viewMode = ref('preview'); // 'edit', 'split', 'preview' - 默认为预览模式

// 移动端相关状态
const isMobile = ref(false);
const sidebarVisible = ref(false);
const isSidebarCollapsed = ref(false);

function toggleDesktopSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
}

// 检测是否为移动端
function checkMobile() {
  isMobile.value = window.innerWidth <= 768;
  if (!isMobile.value) {
    sidebarVisible.value = false; // 桌面端时重置侧边栏状态
  }
}

// 切换侧边栏显示
function toggleSidebar() {
  if (isMobile.value) {
    sidebarVisible.value = !sidebarVisible.value;
  } else {
    toggleDesktopSidebar();
  }
}

function setViewMode(mode) {
  // 移动端不支持分屏模式，自动切换为编辑模式
  if (isMobile.value && mode === 'split') {
    viewMode.value = 'edit';
  } else {
    viewMode.value = mode;
  }
  
  // 移动端切换视图模式时关闭侧边栏
  if (isMobile.value && sidebarVisible.value) {
    sidebarVisible.value = false;
  }
}

function updateNoteContent(event) {
 noteStore.updateSelectedNoteContent(event.target.value);
}

function startResize(event) {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

function handleResize(event) {
  if (!isResizing.value) return;
  const newWidth = event.clientX;
  if (newWidth > 200 && newWidth < 600) { // 设置最小和最大宽度
    sidebarWidth.value = newWidth;
  }
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
}

function handleEditorScroll() {
  if (isSyncing) return;
  isSyncing = true;
  const editor = editorRef.value;
  const preview = previewRef.value.previewRef; // Access the exposed ref from the preview component
  if (editor && preview) {
    const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
  }
  requestAnimationFrame(() => {
    isSyncing = false;
  });
}

function handlePreviewScroll() {
  if (isSyncing) return;
  isSyncing = true;
  const editor = editorRef.value;
  const preview = previewRef.value.previewRef;
  if (editor && preview) {
    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);
  }
  requestAnimationFrame(() => {
    isSyncing = false;
  });
}

function saveCurrentNote() {
   if (noteStore.selectedNote && noteStore.selectedNote.dirty) {
       noteStore.saveNote(noteStore.selectedNote);
   }
}

function handleKeyDown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveCurrentNote();
  }
}

function logout() {
  // 清除本地存储的token
  localStorage.removeItem('token');
  
  // 清空store数据
  noteStore.clearData();
  
  // 跳转到登录页
  router.push('/login');
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', checkMobile);
  
  // 初始化移动端检测
  checkMobile();

  emitter.on('onAddNote', () => {
    // 移动端添加笔记时使用编辑模式，桌面端使用分屏模式
    setViewMode(isMobile.value ? 'edit' : 'split');
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', checkMobile);

  emitter.off('onAddNote');
});

</script>

<style scoped>
.container {
  display: flex;
  height: 100vh;
  position: relative;
}

/* 移动端侧边栏遮罩 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
  backdrop-filter: blur(2px);
}

.resizer {
  width: 5px;
  cursor: col-resize;
  background-color: #d8dee9;
  z-index: 10;
  transition: background-color 0.2s;
}

.resizer:hover {
  background-color: #007bff;
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #d8dee9;
  min-height: 60px;
  box-sizing: border-box;
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: var(--touch-target-size);
  min-height: var(--touch-target-size);
}

.mobile-menu-btn:hover {
  background: #0056b3;
}

.mobile-menu-btn:active {
  transform: scale(0.95);
}

.editor-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-mode-buttons {
  display: flex;
  gap: 0.25rem;
  background: #e9ecef;
  border-radius: 6px;
  padding: 0.25rem;
}

.save-btn {
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: var(--touch-target-size);
}

.save-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
}

.save-btn:active:not(:disabled) {
  transform: translateY(0);
}

.save-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.logout-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: var(--touch-target-size);
}

.logout-btn:hover {
  background: #c82333;
  transform: translateY(-1px);
}

.logout-btn:active {
  transform: translateY(0);
}

/* 自定义快速tooltip */
.save-btn,
.logout-btn,
.view-mode-btn,
.mobile-menu-btn {
  position: relative;
}

.save-btn::after,
.logout-btn::after,
.view-mode-btn::after,
.mobile-menu-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 1000;
  margin-top: 0.5rem;
}

.save-btn::before,
.logout-btn::before,
.view-mode-btn::before,
.mobile-menu-btn::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-bottom-color: rgba(0, 0, 0, 0.8);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  pointer-events: none;
  z-index: 1000;
  margin-top: 0.1rem;
}

.save-btn:hover::after,
.logout-btn:hover::after,
.view-mode-btn:hover::after,
.mobile-menu-btn:hover::after {
  opacity: 1;
  visibility: visible;
  transition-delay: 0.5s;
}

.save-btn:hover::before,
.logout-btn:hover::before,
.view-mode-btn:hover::before,
.mobile-menu-btn:hover::before {
  opacity: 1;
  visibility: visible;
  transition-delay: 0.5s;
}

.view-mode-btn {
  background: transparent;
  color: #6c757d;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  min-width: 40px;
  justify-content: center;
}

.view-mode-btn:hover {
  background: #dee2e6;
  color: #495057;
}

.view-mode-btn.active {
  background: #007bff;
  color: white;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

.editor-container {
    display: flex;
    width: 100%;
    height: calc(100% - 60px);
    transition: all 0.3s ease;
}

/* 编辑模式：只显示编辑区 */
.editor-container.view-mode-edit .markdown-source {
  flex: 1;
  border-right: none;
}

/* 分屏模式：编辑区和预览区各占50% */
.editor-container.view-mode-split .markdown-source {
  flex: 0 0 50%;
  border-right: 1px solid #d8dee9;
}

.editor-container.view-mode-split .preview {
  flex: 0 0 50%;
}

/* 预览模式：只显示预览区 */
.editor-container.view-mode-preview .preview {
  flex: 1;
}

.markdown-source {
  padding: 1em;
  border: none;
  resize: none;
  font-family: monospace;
  font-size: 1rem;
  line-height: 1.5;
  height: 100%;
  box-sizing: border-box;
  background-color: #eceff4;
  color: #2e3440;
  outline: none;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.no-note-selected {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #999;
  font-size: 1.2rem;
  text-align: center;
  padding: 2rem;
}

/* 移动端适配 */
@media (max-width: var(--mobile-breakpoint)) {
  .container {
    height: 100vh;
    height: 100dvh;
  }
  
  .editor-header {
    padding: var(--spacing-md);
    justify-content: space-between;
  }
  
  .editor-controls {
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }
  
  .view-mode-buttons {
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
  }
  
  .view-mode-btn {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1.1rem;
    min-width: var(--touch-target-size);
    min-height: var(--touch-target-size);
  }
  
  .save-btn {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1.1rem;
    min-width: var(--touch-target-size);
    min-height: var(--touch-target-size);
  }
  
  .logout-btn {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1.1rem;
    min-width: var(--touch-target-size);
    min-height: var(--touch-target-size);
  }
  
  .markdown-source {
    padding: var(--spacing-lg);
    font-size: 1.1rem;
    line-height: 1.6;
    overflow-x: hidden;
    word-wrap: break-word;
    word-break: break-word;
    white-space: pre-wrap;
  }
  
  .no-note-selected {
    font-size: 1.1rem;
    padding: var(--spacing-xl) var(--spacing-xl);
  }
  
  /* 移动端时隐藏调整器 */
  .resizer {
    display: none;
  }
}

/* 平板端适配 */
@media (min-width: 769px) and (max-width: var(--tablet-breakpoint)) {
  .view-mode-btn {
    padding: 0.6rem 0.8rem;
    min-width: 42px;
  }
  
  .markdown-source {
    font-size: 1.05rem;
  }
}

/* 横屏模式优化 */
@media (max-width: var(--mobile-breakpoint)) and (orientation: landscape) {
  .editor-header {
    padding: var(--spacing-sm) var(--spacing-md);
    min-height: 50px;
  }
  
  .mobile-menu-btn {
    padding: var(--spacing-sm);
    font-size: 1.1rem;
  }
  
  .editor-controls {
    gap: var(--spacing-sm);
  }
  
  .view-mode-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 1rem;
  }
  
  .save-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 1rem;
    min-height: 40px;
  }
  
  .logout-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 1rem;
    min-height: 40px;
  }
  
  .editor-container {
    height: calc(100% - 50px);
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .save-btn:hover {
    background: #28a745;
    transform: none;
  }
  
  .save-btn:active:not(:disabled) {
    background: #218838;
    transform: scale(0.95);
  }
  
  .view-mode-btn:hover {
    background: transparent;
  }
  
  .view-mode-btn:active {
    background: #dee2e6;
    transform: scale(0.95);
  }
  
  .mobile-menu-btn:hover {
    background: #007bff;
  }
  
  .mobile-menu-btn:active {
    background: #0056b3;
    transform: scale(0.95);
  }
  
  .logout-btn:hover {
    background: #dc3545;
    transform: none;
  }
  
  .logout-btn:active {
    background: #c82333;
    transform: scale(0.95);
  }
}
</style>
