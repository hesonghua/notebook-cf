<template>
  <div class="container" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
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
      :style="!isMobile && !isSidebarCollapsed ? { width: sidebarWidth + 'px' } : {}"
    />
    
    <!-- 桌面端调整器 -->
    <div
      v-if="!isMobile && !isSidebarCollapsed"
      class="resizer"
      @mousedown="startResize"
    ></div>
    
    <main class="main-content">
      <div class="editor-header">
        <div class="header-left">
          <button class="icon-btn" @click="toggleSidebar" data-tooltip="切换侧边栏">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
          <div class="separator"></div>
          <button class="icon-btn" @click="noteStore.handleAddNote" data-tooltip="新笔记">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
          </button>
          <button class="icon-btn" @click="categoryStore.handleAddCategory" data-tooltip="新分类">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
          </button>
          <button v-if="!isMobile" class="icon-btn" @click="noteStore.forceRefreshNotes(); categoryStore.fetchCategories()" data-tooltip="刷新">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </button>
        </div>
        
        <div class="header-right">
          <div v-if="noteStore.selectedNote" class="view-mode-buttons">
            <button class="icon-btn view-mode-btn" :class="{ active: viewMode === 'edit' }" @click="setViewMode('edit')" data-tooltip="编辑模式">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button v-if="!isMobile" class="icon-btn view-mode-btn" :class="{ active: viewMode === 'split' }" @click="setViewMode('split')" data-tooltip="分屏模式">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 3v18h18V3H3z"></path></svg>
            </button>
            <button class="icon-btn view-mode-btn" :class="{ active: viewMode === 'preview' }" @click="setViewMode('preview')" data-tooltip="预览模式">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </div>
          <button v-if="noteStore.selectedNote" class="icon-btn save-btn" @click="saveCurrentNote" :disabled="!noteStore.selectedNote?.dirty" data-tooltip="保存 (Ctrl+S)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          </button>
     
          <button v-if="noteStore.selectedNote && !isMobile" class="icon-btn" @click="handlePrint" data-tooltip="打印/导出PDF">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
          <button class="icon-btn logout-btn" @click="logout" data-tooltip="注销">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </div>
      
      <div v-if="noteStore.selectedNote" class="editor-container" :class="`view-mode-${viewMode}`">
        <textarea
          v-show="viewMode === 'edit' || (viewMode === 'split' && !isMobile)"
          class="markdown-source"
          :value="noteStore.selectedNote.content"
          @input="updateNoteContent"
          @keydown="handleEditorKeyDown"
          @paste="handlePaste"
          @drop="handleDrop"
          @dragover="handleDragOver"
          ref="editorRef"
          @scroll="handleEditorScroll"
        ></textarea>
        <MarkdownPreview
          v-show="viewMode === 'preview' || (viewMode === 'split' && !isMobile)"
          :selectedNote="noteStore.selectedNote"
          ref="previewRef"
          @scroll="handlePreviewScroll"
          id="print-area"
        />
      </div>
      
      <div v-else class="no-note-selected">
        <p>Select a note to view, or create a new one.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useNoteStore } from '../stores/noteStore.js';
import { useCategoryStore } from '../stores/categoryStore.js';
import { uploadImage } from '../utils/api.js';
import Sidebar from './Sidebar.vue';
import MarkdownPreview from './MarkdownPreview.vue';

const emitter = inject('emitter');
const router = useRouter();
const noteStore = useNoteStore();
const categoryStore = useCategoryStore();
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

function handleEditorKeyDown(event) {
  // 处理 Tab 键缩进
  if (event.key === 'Tab') {
    event.preventDefault();
    const textarea = event.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const indent = '    '; // 4个空格
    
    // 检查是否有选中文本
    if (start !== end) {
      // 多行缩进处理
      // 找到选中区域的起始行和结束行
      const beforeSelection = value.substring(0, start);
      const selection = value.substring(start, end);
      const afterSelection = value.substring(end);
      
      // 找到选中区域开始位置所在行的行首
      const startLineBegin = beforeSelection.lastIndexOf('\n') + 1;
      const realStart = startLineBegin;
      
      // 获取需要处理的文本（从行首到选中结束）
      const textToIndent = value.substring(realStart, end);
      
      let newText;
      let newSelectionStart;
      let newSelectionEnd;
      
      if (event.shiftKey) {
        // Shift+Tab: 反向缩进（删除每行开头的4个空格或更少）
        newText = textToIndent.split('\n').map(line => {
          // 删除行首最多4个空格
          if (line.startsWith(indent)) {
            return line.substring(4);
          } else if (line.startsWith('   ')) {
            return line.substring(3);
          } else if (line.startsWith('  ')) {
            return line.substring(2);
          } else if (line.startsWith(' ')) {
            return line.substring(1);
          }
          return line;
        }).join('\n');
        
        // 计算新的选中范围
        const removedChars = textToIndent.length - newText.length;
        newSelectionStart = start;
        newSelectionEnd = end - removedChars;
      } else {
        // Tab: 正向缩进（在每行开头添加4个空格）
        newText = textToIndent.split('\n').map(line => indent + line).join('\n');
        
        // 计算新的选中范围
        const addedChars = newText.length - textToIndent.length;
        newSelectionStart = start;
        newSelectionEnd = end + addedChars;
      }
      
      // 构建新内容
      const newValue = value.substring(0, realStart) + newText + afterSelection;
      
      // 更新内容
      noteStore.updateSelectedNoteContent(newValue);
      
      // 恢复选中范围
      setTimeout(() => {
        textarea.selectionStart = newSelectionStart;
        textarea.selectionEnd = newSelectionEnd;
      }, 0);
    } else {
      // 单行缩进：插入4个空格
      const newValue = value.substring(0, start) + indent + value.substring(end);
      
      // 更新内容
      noteStore.updateSelectedNoteContent(newValue);
      
      // 恢复光标位置
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
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


// 打印功能
function handlePrint() {
  // 保存原始标题
  const originalTitle = document.title;
  
  // 设置打印时的文档标题为笔记标题
  if (noteStore.selectedNote?.title) {
    document.title = noteStore.selectedNote.title;
  }
  
  // 执行打印
  window.print();
  
  // 打印对话框关闭后恢复原始标题
  // 使用 setTimeout 确保在打印对话框关闭后执行
  setTimeout(() => {
    document.title = originalTitle;
  }, 100);
}

// 图片上传相关函数
async function handleImageUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    console.error('Invalid file type');
    return;
  }

  try {
    // 在光标位置插入上传中的占位符（使用 data URI 避免触发网络请求）
    const textarea = editorRef.value;
    const cursorPos = textarea.selectionStart;
    const currentContent = noteStore.selectedNote.content;
    const uploadingText = `![上传中...](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)`;
    
    const newContent =
      currentContent.substring(0, cursorPos) +
      uploadingText +
      currentContent.substring(cursorPos);
    
    noteStore.updateSelectedNoteContent(newContent);

    // 上传图片
    const result = await uploadImage(file);
    
    if (result.success) {
      // 替换占位符为实际的图片链接
      const finalContent = noteStore.selectedNote.content.replace(
        uploadingText,
        `![${file.name}](${result.url})`
      );
      noteStore.updateSelectedNoteContent(finalContent);
      
      // 恢复光标位置
      setTimeout(() => {
        const newPos = cursorPos + `![${file.name}](${result.url})`.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
        textarea.focus();
      }, 0);
    } else {
      // 上传失败，移除占位符
      const failedContent = noteStore.selectedNote.content.replace(uploadingText, '');
      noteStore.updateSelectedNoteContent(failedContent);
      alert('图片上传失败: ' + (result.message || '未知错误'));
    }
  } catch (error) {
    console.error('Upload error:', error);
    // 移除占位符
    const uploadingPlaceholder = `![上传中...](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==)`;
    const errorContent = noteStore.selectedNote.content.replace(uploadingPlaceholder, '');
    noteStore.updateSelectedNoteContent(errorContent);
    alert('图片上传失败: ' + error.message);
  }
}

// 处理粘贴事件
async function handlePaste(event) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        await handleImageUpload(file);
      }
      break;
    }
  }
}

// 处理拖拽放置事件
async function handleDrop(event) {
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/')) {
      await handleImageUpload(file);
    }
  }
}

// 处理拖拽悬停事件
function handleDragOver(event) {
  event.preventDefault();
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
/* Nord Theme Colors */
:root {
  --nord0: #2e3440; /* Dark text, backgrounds */
  --nord1: #3b4252;
  --nord2: #434c5e;
  --nord3: #4c566a; /* Comments, secondary text */
  --nord4: #d8dee9; /* UI elements, borders */
  --nord5: #e5e9f0;
  --nord6: #eceff4; /* Backgrounds, primary text */
  --nord7: #8fbcbb; /* Teal */
  --nord8: #88c0d0; /* Light blue */
  --nord9: #81a1c1; /* Blue */
  --nord10: #5e81ac; /* Darker blue */
  --nord11: #bf616a; /* Red */
  --nord12: #d08770; /* Orange */
  --nord13: #ebcb8b; /* Yellow */
  --nord14: #a3be8c; /* Green */
  --nord15: #b48ead; /* Purple */
}

.container {
  display: flex;
  height: 100vh;
  position: relative;
  background-color: var(--nord6);
  color: var(--nord0);
  transition: all 0.3s ease;
}

.container.sidebar-collapsed .sidebar {
  min-width: 0;
  width: 0;
  transform: translateX(-100%);
}

/* Sidebar Overlay */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(46, 52, 64, 0.6);
  z-index: 998;
  backdrop-filter: blur(3px);
}

.resizer {
  width: 5px;
  cursor: col-resize;
  background-color: var(--nord4);
  z-index: 10;
  transition: background-color 0.2s ease;
}

.resizer:hover {
  background-color: var(--nord10);
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
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: var(--nord5);
  border-bottom: 1px solid var(--nord4);
  min-height: 56px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.separator {
  width: 1px;
  height: 24px;
  background-color: var(--nord4);
  margin: 0 0.5rem;
}

/* Common Icon Button Style */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: 1px solid transparent;
  color: var(--nord3);
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.icon-btn:hover:not(:disabled) {
  background-color: var(--nord4);
  color: var(--nord0);
}

.icon-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.icon-btn svg {
  stroke-width: 2;
}

.mobile-menu-btn {
  color: var(--nord1);
}

.view-mode-buttons {
  display: flex;
  gap: 0.25rem;
  background-color: var(--nord4);
  border-radius: 8px;
  padding: 0.25rem;
}

.view-mode-btn {
  padding: 0.375rem;
}

.view-mode-btn.active {
  background-color: var(--nord10);
  color: var(--nord6);
  box-shadow: 0 2px 8px rgba(94, 129, 172, 0.3);
}
.view-mode-btn.active:hover {
  background-color: var(--nord9);
}

.save-btn {
  color: var(--nord14); /* Green */
}
.save-btn:hover:not(:disabled) {
  background-color: rgba(163, 190, 140, 0.15);
  color: var(--nord14);
}
.save-btn:disabled {
  color: var(--nord3);
  opacity: 0.5;
  cursor: not-allowed;
}

.logout-btn {
  color: var(--nord11); /* Red */
}
.logout-btn:hover {
  background-color: rgba(191, 97, 106, 0.15);
  color: var(--nord11);
}

/* Tooltip Styles */
.icon-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--nord1);
  color: var(--nord6);
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s, transform 0.2s;
  pointer-events: none;
  z-index: 1000;
  margin-top: 0.75rem;
}

.icon-btn:hover::after {
  opacity: 1;
  visibility: visible;
  transition-delay: 0.5s;
  transform: translateX(-50%) translateY(0);
}

.editor-container {
  display: flex;
  width: 100%;
  height: calc(100% - 56px);
}

.markdown-source {
  padding: 1.5rem;
  border: none;
  resize: none;
  font-family: 'Fira Code', monospace;
  font-size: 1rem;
  line-height: 1.6;
  height: 100%;
  box-sizing: border-box;
  background-color: #f8f9fa;
  color: var(--nord0);
  outline: none;
  overflow-y: auto;
}

.no-note-selected {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--nord3);
  font-size: 1.2rem;
  text-align: center;
  padding: 2rem;
}

/* Mobile & Responsive */
@media (max-width: 768px) {
  .editor-header {
    padding: 0.5rem;
    justify-content: space-between;
  }
  .resizer {
    display: none;
  }
}

/* Full View Adjustments */
.editor-container.view-mode-edit .markdown-source,
.editor-container.view-mode-preview .preview {
  flex: 1;
}

/* Split View Adjustments */
.editor-container.view-mode-split .markdown-source {
  flex: 0 0 50%;
  border-right: 1px solid var(--nord4);
}
.editor-container.view-mode-split .preview {
  flex: 0 0 50%;
}

/* 打印时的样式 */
@media print {
  /* 设置打印页面 */
  @page {
    size: A4;
    margin: 15mm 20mm;
  }

  /* 全局重置所有容器 */
  * {
    overflow: visible !important;
  }

  html, body {
    height: auto !important;
    overflow: visible !important;
  }

  /* 隐藏所有非打印内容 */
  .container > *:not(.main-content) {
    display: none !important;
  }
  
  .editor-header,
  .markdown-source {
    display: none !important;
  }
  
  /* 确保容器不限制高度 */
  .container {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    display: block !important;
  }
  
  .main-content {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    flex: none !important;
  }
  
  .editor-container {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  
  /* 显示打印区域 */
  #print-area {
    display: block !important;
    visibility: visible !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
  }
}

</style>
