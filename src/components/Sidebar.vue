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
        if (Array.isArray(parsed)) {
          expandedPathIds.value = parsed;
        }
      }
    }
  } catch (e) {
    console.warn('读取 expandedPathIds 本地存储失败', e);
  }
}

loadExpandedPathIdsFromStorage();

// 节点展开/折叠事件处理 - 使用路径ID
// 注意：el-tree的@node-expand和@node-collapse事件直接传递节点数据对象，而非包装的node对象
function onNodeExpand(data) {
  if (!data) {
    console.warn('[Sidebar] onNodeExpand: data is undefined', data);
    return;
  }
  const pathId = data.pathId;
  console.log('[Sidebar] onNodeExpand:', pathId, 'current expanded:', expandedPathIds.value);
  if (pathId && !expandedPathIds.value.includes(pathId)) {
    expandedPathIds.value.push(pathId);
  }
}

function onNodeCollapse(data) {
  if (!data) {
    console.warn('[Sidebar] onNodeCollapse: data is undefined', data);
    return;
  }
  const pathId = data.pathId;
  console.log('[Sidebar] onNodeCollapse:', pathId, 'current expanded:', expandedPathIds.value);
  if (pathId) {
    const index = expandedPathIds.value.indexOf(pathId);
    if (index !== -1) {
      expandedPathIds.value.splice(index, 1);
    }
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
  // 先缓存所有分类的日记总数，包含所有子分类日记数量
  const getTotalNoteCount = (category) => {
    let count = (noteStore.titlesByCategory[category.id]?.length || 0);
    if (category.children && category.children.length > 0) {
      category.children.forEach(child => {
        count += getTotalNoteCount(child);
      });
    }
    return count;
  };

  const nodes = categoryStore.categories.map(category => {
    const node = buildTreeNode(category, []);
    // 使用递归计算的总日记数赋值给每个节点的 note_count
    node.note_count = getTotalNoteCount(category);
    return node;
  });

  // 添加未分类日记作为顶层节点
  noteStore.uncategorizedNoteTitles.forEach(note => {
    nodes.push({
      id: note.id,
      title: note.title,
      isNote: true,
      categoryId: null,
      isUncategorized: true,
      pathId: `note-${note.id}`, // 未分类笔记的路径ID
    });
  });

  return nodes;
});

// 构建带路径ID的树节点
function buildTreeNode(category, parentPath = []) {
  const currentPath = [...parentPath, category.id];
  const pathId = currentPath.join('-');
  
  const node = {
    id: category.id,
    name: category.name,
    note_count: category.note_count,
    isCategory: true,
    pathId: pathId,
    children: [],
  };
  
  // 添加子分类
  if (category.children && category.children.length > 0) {
    category.children.forEach(child => {
      node.children.push(buildTreeNode(child, currentPath));
    });
  }
  
  // 添加该分类的日记作为子节点
  const notes = noteStore.titlesByCategory[category.id];
  if (notes && notes.length > 0) {
    notes.forEach(note => {
      node.children.push({
        id: note.id,
        title: note.title,
        isNote: true,
        categoryId: category.id,
        pathId: `${pathId}-note-${note.id}`, // 笔记的路径ID
      });
    });
  }
  
  return node;
}

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
  
  const originalCategory = findCategoryById(categoryStore.categories, editingCategoryId.value);
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
      const originalCategory = findCategoryById(categoryStore.categories, category.id);
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

function findCategoryById(categoriesList, id) {
  for (const cat of categoriesList) {
    if (cat.id === id) return cat;
    if (cat.children) {
      const found = findCategoryById(cat.children, id);
      if (found) return found;
    }
  }
  return null;
} 

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

// 查找分类的父分类
function findParentCategory(categoriesList, childId) {
  for (const category of categoriesList) {
    if (category.children) {
      const foundInChildren = category.children.find(child => child.id === childId);
      if (foundInChildren) return category;
      
      const found = findParentCategory(category.children, childId);
      if (found) return found;
    }
  }
  return null;
}

// 获取当前树中所有存在的路径ID
function getAllPathIds(nodes) {
  const pathIds = new Set();
  function traverse(list) {
    if (!list) return;
    for (const node of list) {
      if (node.pathId) {
        pathIds.add(node.pathId);
      }
      if (node.children) traverse(node.children);
    }
  }
  traverse(nodes);
  return pathIds;
}

// 基于路径ID的展开状态保存和恢复逻辑
async function saveAndRestoreExpandedState(callback) {
  // 保存当前展开状态（路径ID）
  const savedPathIds = [...expandedPathIds.value].filter(pathId => pathId && pathId.trim() !== '');
  console.log('[Sidebar] 保存展开状态(路径ID):', savedPathIds);
  
  // 执行数据变更操作
  await callback();
  
  // 等待DOM更新
  await nextTick();
  await nextTick();
  
  // 获取新树中所有有效的路径ID
  const validPathIds = getAllPathIds(treeData.value);
  
  // 过滤出仍然存在的展开节点路径
  const validExpandedPathIds = savedPathIds.filter(pathId => validPathIds.has(pathId));
  
  console.log('[Sidebar] 恢复展开状态(路径ID):', validExpandedPathIds);
  
  // 更新展开状态
  expandedPathIds.value = validExpandedPathIds;
}

// 处理拖拽笔记到分类
async function handleDropOnCategory(event, targetCategoryId) {
  event.preventDefault();
  event.stopPropagation();

  const noteId = event.dataTransfer.getData('text/plain');
  if (noteId) {
    await saveAndRestoreExpandedState(async () => {
      await noteStore.updateNoteCategory({
        noteId: parseInt(noteId),
        newCategoryId: targetCategoryId,
        refreshCategories: false
      });
    });
    return;
  }

  const sourceCategoryId = event.dataTransfer.getData('category-id');
  if (sourceCategoryId) {
    const sourceId = parseInt(sourceCategoryId);
    if (sourceId === targetCategoryId) return;

    try {
      await saveAndRestoreExpandedState(async () => {
        const sourceCategory = findCategoryById(categoryStore.categories, sourceId);
        if (!sourceCategory) return;
        
        await sourceCategory.moveTo(targetCategoryId);

        const oldParent = findParentCategory(categoryStore.categories, sourceId);
        if (oldParent) {
          oldParent.removeChild(sourceId);
        } else {
          const index = categoryStore.categories.findIndex(c => c.id === sourceId);
          if (index !== -1) {
            categoryStore.categories.splice(index, 1);
          }
        }

        const newParent = findCategoryById(categoryStore.categories, targetCategoryId);
        if (newParent) {
          newParent.addChild(sourceCategory);
        }
      });

      ElMessage.success('分类已移动');
    } catch (error) {
      ElMessage.error(error.message || '移动分类失败，请重试');
    }
  }
}

// 处理笔记开始拖拽
function handleNoteStartDrag(event, noteId) {
  event.dataTransfer.setData('text/plain', noteId.toString());
  event.dataTransfer.effectAllowed = 'move';
}

// 处理笔记拖拽到另一个笔记
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

// 处理拖拽到顶层
async function handleDropOnTopLevel(event) {
  event.preventDefault();
  event.stopPropagation();

  const noteId = event.dataTransfer.getData('text/plain');
  if (noteId) {
    await saveAndRestoreExpandedState(async () => {
      await noteStore.updateNoteCategory({
        noteId: parseInt(noteId),
        newCategoryId: null,
        refreshCategories: false
      });
    });
    return;
  }

  const sourceCategoryId = event.dataTransfer.getData('category-id');
  if (sourceCategoryId) {
    const sourceId = parseInt(sourceCategoryId);
    try {
      await saveAndRestoreExpandedState(async () => {
        const sourceCategory = findCategoryById(categoryStore.categories, sourceId);
        if (!sourceCategory || sourceCategory.parent_id === 0) return;
        
        await sourceCategory.moveTo(0);

        const oldParent = findParentCategory(categoryStore.categories, sourceId);
        if (oldParent) {
          oldParent.removeChild(sourceId);
        } else {
          return;
        }

        sourceCategory.parent_id = 0;
        categoryStore.categories.push(sourceCategory);
      });

      ElMessage.success('分类已移至顶层');
    } catch (error) {
      ElMessage.error(error.message || '移动分类失败，请重试');
    }
  }
}

// 从树中选择笔记
function selectNoteFromTree(noteId) {
  const note = noteStore.notes.find(n => n.id === noteId);
  if (note) {
    noteStore.handleSelectNote(note);
  }
}

// 处理分类开始拖拽
function handleCategoryStartDrag(event, categoryId) {
  event.dataTransfer.setData('category-id', categoryId.toString());
  event.dataTransfer.effectAllowed = 'move';
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
            @node-contextmenu="showContextMenu"
            @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse"
          >
            <template #default="{ data, node }">
              <!-- 分类节点 -->
              <div
                v-if="data.isCategory"
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
  background-color: var(--nord6);
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.custom-tree-node:hover {
  background-color: var(--nord5);
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

  /* 选中时文字背景与边框背景保持一致 */
}
.custom-tree-node.is-selected > .category-content > .category-name {
  background-color: var(--nord5);
  padding: 0 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;
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
