<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { useNoteStore } from '../stores/noteStore.js';
import { useCategoryStore } from '../stores/categoryStore.js';
import NoteItem from './NoteItem.vue';

const noteStore = useNoteStore();
const categoryStore = useCategoryStore();

const props = defineProps({
  isSidebarCollapsed: Boolean,
});

const treeRef = ref(null);
const editingCategoryId = ref(null);
const newCategoryName = ref('');
// 使用路径ID管理展开状态
const expandedPathIds = ref([]);

// 简化的localStorage加载逻辑
function loadExpandedPathIdsFromStorage() {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('expandedPathIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) expandedPathIds.value = parsed;
      }
    }
  } catch (e) {
    console.warn('读取 expandedPathIds 本地存储失败', e);
  }
}

loadExpandedPathIdsFromStorage();

// 节点展开/折叠事件处理
function onNodeExpand(data) {
  if (data?.pathId && !expandedPathIds.value.includes(data.pathId)) {
    expandedPathIds.value.push(data.pathId);
  }
}

function onNodeCollapse(data) {
  if (data?.pathId) {
    const index = expandedPathIds.value.indexOf(data.pathId);
    if (index !== -1) expandedPathIds.value.splice(index, 1);
  }
}

const contextMenu = ref({
  visible: false,
  categoryId: null,
  category: null,
  node: null,
  top: 0,
  left: 0,
  type: 'category',
});

// 构建树形数据
const treeData = computed(() => {
  // 递归计算分类下的日记总数
  const getNoteCount = (category) => {
    let count = (noteStore.titlesByCategory[category.id]?.length || 0);
    category.children?.forEach(child => count += getNoteCount(child));
    return count;
  };

  // 递归构建树节点
  const buildNode = (category, parentPath = []) => {
    const currentPath = [...parentPath, category.id];
    const pathId = currentPath.join('-');
    
    const children = [];
    
    // 添加子分类
    if (category.children && category.children.length > 0) {
      category.children.forEach(child => {
        children.push(buildNode(child, currentPath));
      });
    }
    
    // 添加该分类的日记
    const notes = noteStore.titlesByCategory[category.id] || [];
    notes.forEach(note => {
      children.push({
        id: note.id,
        title: note.title,
        isNote: true,
        categoryId: category.id,
        pathId: `${pathId}-note-${note.id}`,
      });
    });
    
    // 如果没有子分类和日记，添加一个占位符以确保显示展开图标
    if (children.length === 0) {
      children.push({
        id: `${category.id}-placeholder`,
        title: '',
        isPlaceholder: true,
        categoryId: category.id,
        pathId: `${pathId}-placeholder`,
      });
    }
    
    const node = {
      id: category.id,
      name: category.name,
      note_count: getNoteCount(category),
      isCategory: true,
      pathId: pathId,
      children: children,
    };
    
    return node;
  };

  const nodes = categoryStore.categories.map(category => buildNode(category));

  // 添加未分类日记
  noteStore.uncategorizedNoteTitles.forEach(note => {
    nodes.push({
      id: note.id,
      title: note.title,
      isNote: true,
      categoryId: null,
      isUncategorized: true,
      pathId: `note-${note.id}`,
    });
  });

  return nodes;
});

onMounted(() => {
  document.addEventListener('click', hideContextMenu);
}); 

onBeforeUnmount(() => {
  document.removeEventListener('click', hideContextMenu);
});

function showContextMenu(event, data, node) {
  event.preventDefault();
  event.stopPropagation();
  contextMenu.value = {
    visible: true,
    categoryId: data.id,
    category: data,
    node: node,
    top: event.clientY,
    left: event.clientX,
    type: 'category',
  };
}

function showNoteContextMenu(event, noteId) {
  event.preventDefault();
  event.stopPropagation();
  contextMenu.value = {
    visible: true,
    noteId: noteId,
    top: event.clientY,
    left: event.clientX,
    type: 'note',
  };
}

function hideContextMenu() {
  if (contextMenu.value.visible) {
    contextMenu.value.visible = false;
  }
}

function handleDeleteNoteFromMenu() {
  if (contextMenu.value.type === 'note') {
    const note = noteStore.notes.find(n => n.id === contextMenu.value.noteId);
    if (note) {
      noteStore.handleDeleteNote(note);
      hideContextMenu();
    }
  }
}

async function startRename() {
  const category = contextMenu.value.category;
  hideContextMenu();
  editingCategoryId.value = category.id;
  newCategoryName.value = category.name;
} 

async function finishRename() {
  if (editingCategoryId.value === null) return;
  
  const originalCategory = categoryStore.findCategoryById(categoryStore.categories, editingCategoryId.value);
  if (!originalCategory) return;
  
  if (newCategoryName.value && newCategoryName.value !== originalCategory.name) {
    await categoryStore.handleRenameCategory(originalCategory, newCategoryName.value);
  }
  editingCategoryId.value = null;
  newCategoryName.value = '';
} 

async function handleAddChildCategory() {
  const parentId = contextMenu.value.categoryId;
  hideContextMenu();
  await categoryStore.handleAddCategory(parentId);
} 

async function handleDeleteCategory() {
  const category = contextMenu.value.category;
  hideContextMenu();
  
  const confirmed = await ElMessageBox.confirm(
    `确定要删除分类 "${category.name}" 及其子分类吗？该分类下的所有日记将被移动到未分类。`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).catch(() => false);
  
  if (confirmed) {
    try {
      const originalCategory = categoryStore.findCategoryById(categoryStore.categories, category.id);
      if (originalCategory) {
        await categoryStore.deleteCategoryAndMoveNotes(originalCategory);
        ElMessage.success('分类已删除');
      }
    } catch (error) {
      console.error('删除分类失败:', error);
      ElMessage.error('删除分类失败，请重试');
    }
  }
}

// 简化的localStorage保存逻辑 - 节流500ms
let saveTimeout = null;
watch(expandedPathIds, (newPathIds) => {
  if (typeof window === 'undefined') return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem('expandedPathIds', JSON.stringify(newPathIds));
    } catch (e) {
      console.warn('保存 expandedPathIds 到 localStorage 失败:', e);
    }
  }, 500);
}, { deep: true });

// 全文搜索功能
const isFullSearching = ref(false); 

async function performFullTextSearch() {
  if (!noteStore.searchQuery || isFullSearching.value) return;
  
  isFullSearching.value = true;
  try {
    await noteStore.fullTextSearch(noteStore.searchQuery);
  } catch (error) {
    console.error('全文搜索失败:', error);
  } finally {
    isFullSearching.value = false;
  }
}

// 获取当前树中所有存在的路径ID
function getAllPathIds(nodes) {
  const pathIds = new Set();
  function traverse(list) {
    if (!list) return;
    for (const node of list) {
      if (node.pathId) pathIds.add(node.pathId);
      if (node.children) traverse(node.children);
    }
  }
  traverse(nodes);
  return pathIds;
}

// 基于路径ID的展开状态保存和恢复逻辑
async function saveAndRestoreExpandedState(callback) {
  const savedPathIds = [...expandedPathIds.value].filter(pathId => pathId && pathId.trim() !== '');
  await callback();
  await nextTick();
  await nextTick();
  const validPathIds = getAllPathIds(treeData.value);
  expandedPathIds.value = savedPathIds.filter(pathId => validPathIds.has(pathId));
}

// 统一的拖拽处理逻辑
async function handleDrop(event, targetType, targetId) {
  event.preventDefault();
  event.stopPropagation();

  const noteId = event.dataTransfer.getData('text/plain');
  const sourceCategoryId = event.dataTransfer.getData('category-id');

  await saveAndRestoreExpandedState(async () => {
    if (noteId) {
      // 移动笔记
      const newCategoryId = targetType === 'category' ? targetId : (targetType === 'top' ? null : undefined);
      // 如果是拖拽到另一个笔记上，targetId 是笔记ID，我们需要传入 categoryId
      // 这里需要区分处理，或者在调用处传入正确的 categoryId
      if (targetType === 'note') {
         // 对于笔记到笔记的拖拽，targetId 是目标笔记ID，但我们需要的是目标分类ID
         // 这里的 targetId 参数在 handleNoteDropOnNote 中实际上是 targetNoteId
         // 所以我们需要第四个参数或者在调用时处理
         // 为了简化，我们保持原有的调用方式，但在模板中直接调用 handleNoteDropOnNote
      } else {
         await noteStore.updateNoteCategory({
          noteId: parseInt(noteId),
          newCategoryId: newCategoryId,
          refreshCategories: false
        });
      }
    } else if (sourceCategoryId) {
      // 移动分类
      const sourceId = parseInt(sourceCategoryId);
      const targetCatId = targetType === 'category' ? targetId : (targetType === 'top' ? 0 : null);
      
      if (targetCatId !== null && sourceId !== targetCatId) {
        try {
          await categoryStore.moveCategory(sourceId, targetCatId);
          ElMessage.success(targetType === 'top' ? '分类已移至顶层' : '分类已移动');
        } catch (error) {
          ElMessage.error(error.message || '移动分类失败，请重试');
        }
      }
    }
  });
}

// 具体的拖拽处理函数，调用统一逻辑
async function handleDropOnCategory(event, targetCategoryId) {
  await handleDrop(event, 'category', targetCategoryId);
}

async function handleDropOnTopLevel(event) {
  await handleDrop(event, 'top', null);
}

async function handleNoteDropOnNote(event, targetNoteId, categoryId) {
  event.preventDefault();
  event.stopPropagation();
  const sourceNoteId = event.dataTransfer.getData('text/plain');
  
  if (sourceNoteId && parseInt(sourceNoteId) !== targetNoteId) {
    await saveAndRestoreExpandedState(async () => {
      await noteStore.updateNoteCategory({
        noteId: parseInt(sourceNoteId),
        newCategoryId: categoryId,
        refreshCategories: false
      });
    });
  }
}

function handleNoteStartDrag(event, noteId) {
  event.dataTransfer.setData('text/plain', noteId.toString());
  event.dataTransfer.effectAllowed = 'move';
}

function selectNoteFromTree(noteId) {
  const note = noteStore.notes.find(n => n.id === noteId);
  if (note) noteStore.handleSelectNote(note);
}

function handleCategoryStartDrag(event, categoryId) {
  event.dataTransfer.setData('category-id', categoryId.toString());
  event.dataTransfer.effectAllowed = 'move';
}

// ESC key handler to exit search mode
function handleEscapeKey() {
  // Only clear if there's an active search query
  if (noteStore.searchQuery) {
    noteStore.searchQuery = '';
  }
}

</script> 

<template>
  <div class="sidebar" :class="{ 'sidebar-collapsed': props.isSidebarCollapsed }">
    <div class="sidebar-header">
      <input
        type="text"
        class="search-input"
        placeholder="搜索笔记..."
        v-model="noteStore.searchQuery"
        @keyup.esc="handleEscapeKey"
      />
    </div>
    <div class="notes-list" ref="notesListRef">
      <!-- Search Results -->
      <div v-if="noteStore.searchQuery" class="search-results">
        <div class="search-info">
          <p>找到 {{ noteStore.searchResults.length }} 个结果</p>
          <button v-if="noteStore.searchQuery" class="full-search-btn" @click="performFullTextSearch">
            全文搜索
          </button>
        </div>
        
        <!-- 搜索结果列表 -->
        <div class="search-results-list">
          <NoteItem
            v-for="noteTitle in noteStore.searchResults"
            :key="noteTitle.id"
            :note="noteTitle"
            :selected="noteTitle.id === noteStore.selectedNote?.id"
            :search-query="noteStore.searchQuery"
            @select="noteStore.handleSelectNote(noteTitle)"
          />
        </div>
      </div> 

      <!-- Categories and Notes (original view) -->
      <div v-else>
        <!-- 顶层拖拽区域 -->
        <div
          class="top-level-drop-zone"
          @dragover.prevent
          @dragenter="$event.currentTarget.classList.add('drag-over')"
          @dragleave="$event.currentTarget.classList.remove('drag-over')"
          @drop="handleDropOnTopLevel($event); $event.currentTarget.classList.remove('drag-over')"
        >
          拖拽到此处以移至顶层
        </div>
        <!-- Category Tree using Element Plus el-tree -->
        <div class="category-tree">
          <el-tree
            ref="treeRef"
            :data="treeData"
            node-key="pathId"
            :expand-on-click-node="true"
            :default-expanded-keys="expandedPathIds"
            :highlight-current="false"
            :show-checkbox="false"
            :draggable="false"
            :props="{ children: 'children', hasChildren: 'hasChildren' }"
            @node-contextmenu="showContextMenu"
            @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse"
          >
            <template #default="{ data, node }">
              <!-- 隐藏占位符节点 -->
              <div v-if="data.isPlaceholder" style="display: none;"></div>
              
              <!-- 分类节点 -->
              <div
                v-else-if="data.isCategory"
                class="custom-tree-node"
                draggable="true"
                @dragstart="handleCategoryStartDrag($event, data.id)"
                @dragover.prevent
                @drop.stop="handleDropOnCategory($event, data.id)"
              >
                <div class="category-content">
                  <input
                    v-if="editingCategoryId === data.id"
                    type="text"
                    v-model="newCategoryName"
                    @blur="finishRename"
                    @keyup.enter="finishRename"
                    @click.stop
                    class="rename-input"
                  />
                  <span v-else class="category-name">
                    {{ data.name }}
                  </span>
                  <span class="note-count">({{ data.note_count || 0 }})</span>
                </div>
              </div>
              
              <!-- 日记节点 -->
              <div
                v-else-if="data.isNote"
                class="note-item"
                :class="{ 'is-selected': noteStore.selectedNote?.id === data.id }"
                @click="selectNoteFromTree(data.id)"
                @contextmenu.prevent="showNoteContextMenu($event, data.id)"
                draggable="true"
                @dragstart="handleNoteStartDrag($event, data.id)"
                @dragover.prevent
                @drop.stop="handleNoteDropOnNote($event, data.id, data.categoryId)"
              >
                {{ data.title }}
              </div>
            </template>
          </el-tree>
        </div> 
  
      </div> 
  
      <div class="loading-indicator" v-if="noteStore.isLoading">
        <p>Loading...</p>
      </div>
    </div> 
  
    <!-- Context Menu -->
    <div v-if="contextMenu.visible" class="category-menu" :style="{ top: contextMenu.top + 'px', left: contextMenu.left + 'px' }" @click.stop>
      <template v-if="contextMenu.type === 'category'">
        <button @click="startRename">重命名</button>
        <button @click="handleAddChildCategory">添加子分类</button>
        <button class="delete-btn" @click="handleDeleteCategory">删除</button>
      </template>
      <template v-else-if="contextMenu.type === 'note'">
        <button class="delete-btn" @click="handleDeleteNoteFromMenu">删除</button>
      </template>
    </div>
  </div>
</template> 

<style scoped>
/* Sidebar 组件样式，使用全局定义的 Nord 主题颜色 */ 

.sidebar {
  min-width: 280px;
  max-width: 600px;
  background-color: var(--nord6);
  color: var(--nord1);
  border-right: 1px solid var(--nord4);
  display: flex;
  flex-direction: column;
  height: 100vh;
  transition: min-width 0.3s ease, transform 0.3s ease;
} 

.sidebar-collapsed {
  min-width: 50px;
} 

.sidebar-collapsed .search-input,
.sidebar-collapsed .sidebar-actions,
.sidebar-collapsed .notes-list {
  display: none;
} 

.sidebar-collapsed .header-controls {
    justify-content: center;
} 

.sidebar-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--nord4);
  flex-shrink: 0;
} 

.search-input {
  width: 100%;
  padding: 0.6rem 0.9rem;
  background-color: var(--nord5);
  border: 1px solid var(--nord4);
  color: var(--nord1);
  border-radius: 8px;
  box-sizing: border-box;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}
.search-input::placeholder {
  color: var(--nord3);
}
.search-input:focus {
  border-color: var(--nord9);
  outline: 0;
  box-shadow: 0 0 0 3px rgba(129, 161, 193, 0.2);
  background-color: var(--nord6);
} 

.header-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
} 

.sidebar-actions {
  display: flex;
  gap: 0.5rem;
} 

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  color: var(--nord3);
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-btn:hover {
  color: var(--nord0);
  background-color: var(--nord5);
}
.action-btn:active {
  transform: scale(0.95);
}
.toggle-btn {
  transform: rotate(180deg);
}
.sidebar-collapsed .toggle-btn {
  transform: rotate(0deg);
} 

.notes-list {
  overflow-y: auto;
  flex: 1;
  padding: 0.5rem;
} 

/* Category Tree Styles */
.category-tree {
  margin-bottom: 0.75rem;
}

/* 顶层拖拽区域 */
.top-level-drop-zone {
  min-height: 50px;
  border: 2px dashed var(--nord4);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  color: var(--nord3);
  font-size: 0.85rem;
  transition: all 0.2s ease;
  cursor: default;
}

.top-level-drop-zone:hover,
.top-level-drop-zone.drag-over {
  background-color: var(--nord5);
  border-color: var(--nord9);
  color: var(--nord9);
}

:deep(.el-tree) {
  background: transparent;
  color: var(--nord2);
}

/* 修正暗色模式下分类节点背景色，避免白色底 */
.custom-tree-node {
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

/* 覆盖 el-tree 选中节点背景色，避免暗色模式下白底 */
:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: var(--nord4) !important;
  color: var(--nord9) !important;
  transition: background-color 0.3s ease;
  font-weight: 500;
}

/* 统一 el-tree 节点内容背景，防止白底 */
:deep(.el-tree-node__content) {
  background-color: var(--nord6);
}

:deep(.el-tree-node) {
  margin-bottom: 0;
}

:deep(.el-tree-node__content) {
  height: auto;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-weight: 500;
  color: var(--nord2);
  transition: background-color 0.2s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--nord5);
}

/* 日记节点重置样式，覆盖整行 */
:deep(.el-tree-node .note-item) {
  width: calc(100% + 24px);
  margin-left: -24px;
  padding: 0.3rem 0.6rem;
  position: relative;
  z-index: 1;
}

:deep(.el-tree-node__expand-icon) {
  color: var(--nord9);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  width: 24px;
}

:deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
}

:deep(.el-tree-node__children) {
  padding-left: 0;
  border-left: none;
  margin: 0;
  padding-top: 0;
  display: block;
}

/* 隐藏占位符节点的整个行 */
:deep(.el-tree-node[data-key*="-placeholder"]) {
  display: none !important;
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  width: 100%;
} 

.category-content {
  flex: 1;
  display: flex;
  align-items: center;
  width: 100%;
}

.category-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-count {
  font-size: 0.8em;
  color: var(--nord3);
  margin-left: 0.5rem;
  font-weight: 400;
} 

.rename-input {
  flex: 1;
  background-color: var(--nord6);
  border: 1px solid var(--nord9);
  color: var(--nord1);
  border-radius: 5px;
  padding: 0.125rem 0.375rem;
  font-size: 1em;
  font-weight: 500;
  outline: none;
  transition: background-color 0.2s ease, color 0.2s ease;
  margin-right: 0.5rem;
}

.note-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-weight: 400;
  font-size: 0.9rem;
  color: var(--nord3);
  transition: background-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 1;
}

.note-item:hover {
  background-color: var(--nord5);
  color: var(--nord2);
}

.note-item.is-selected {
  background-color: var(--nord4) !important;
  color: var(--nord9) !important;
  font-weight: 500;
  transition: background-color 0.2s ease;
  /* 防止点击后未立即更新背景导致白色闪烁 */
  will-change: background-color;
}
.custom-tree-node.is-selected {
  background-color: var(--nord5) !important; /* 调整为更柔和背景色 */
  color: var(--nord9) !important;
  font-weight: 500;
  transition: background-color 0.2s ease;
  will-change: background-color;
}

.category-menu {
  position: fixed;
  background-color: var(--nord5);
  border: 1px solid var(--nord4);
  border-radius: 8px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  padding: 0.5rem;
  min-width: 140px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.category-menu button {
  background: none;
  border: none;
  color: var(--nord1);
  padding: 0.6rem 1rem;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  border-radius: 6px;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.category-menu button:hover {
  background-color: var(--nord4);
} 

.category-menu button.delete-btn {
  color: var(--nord11);
} 

.category-menu button.delete-btn:hover {
  background-color: rgba(191, 97, 106, 0.2);
} 

.loading-indicator {
  padding: 1em;
  text-align: center;
  color: var(--nord3);
} 

.search-results-list {
  /* 移除固定高度，使用自然滚动 */
} 

.search-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.3rem 0.75rem;
  font-size: 0.9rem;
  color: var(--nord3);
  border-bottom: 1px solid var(--nord4);
  margin-bottom: 0.5rem;
} 

.full-search-btn {
  background: none;
  border: 1px solid var(--nord4);
  color: var(--nord9);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
} 

.full-search-btn:hover {
  background-color: var(--nord9);
  color: var(--nord6);
} 

.full-search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
} 

/* Mobile Styles */
.sidebar-mobile {
  position: fixed;
  top: 0;
  left: 0;
  width: 80vw;
  max-width: 320px;
  height: 100%;
  z-index: 999;
  transform: translateX(-100%);
  box-shadow: 2px 0 15px rgba(0,0,0,0.1);
  min-width: auto;
}
.sidebar-mobile.sidebar-visible {
  transform: translateX(0);
}
</style>
