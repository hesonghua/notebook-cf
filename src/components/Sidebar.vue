<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import draggable from 'vuedraggable';
import { useNoteStore } from '../stores/noteStore.js';
import { useCategoryStore } from '../stores/categoryStore.js';
import NoteItem from './NoteItem.vue';

const noteStore = useNoteStore();
const categoryStore = useCategoryStore();

const props = defineProps({
  isSidebarCollapsed: Boolean,
});

const emit = defineEmits(['toggle-sidebar']);

const expandedCategories = ref(new Set());
const notesListRef = ref(null);
const editingCategoryId = ref(null);
const newCategoryName = ref('');
const contextMenu = ref({
  visible: false,
  categoryId: null,
  category: null,
  top: 0,
  left: 0,
});

async function toggleCategory(categoryId) {
  if (editingCategoryId.value === categoryId) return;
  const newSet = new Set(expandedCategories.value);
  if (newSet.has(categoryId)) {
    newSet.delete(categoryId);
  } else {
    newSet.add(categoryId);
  }
  expandedCategories.value = newSet;
}

function onNoteDrop(event) {
  const noteId = event.item.dataset.noteId;
  let newCategoryId = event.to.dataset.categoryId;
  if (newCategoryId === 'null') {
    newCategoryId = null;
  }
  noteStore.updateNoteCategory({ noteId, newCategoryId });
}

function handleScroll(event) {
  // 滚动处理函数，目前没有分页功能
}

onMounted(() => {
  notesListRef.value?.addEventListener('scroll', handleScroll);
  document.addEventListener('click', hideContextMenu);
});

onBeforeUnmount(() => {
  notesListRef.value?.removeEventListener('scroll', handleScroll);
  document.removeEventListener('click', hideContextMenu);
});

async function handleDeleteCategory(category) {
  const confirmed = confirm(`确定要删除分类 "${category.name}" 吗？该分类下的所有日记将被移动到未分类。`);
  if (!confirmed) return;
  
  try {
    await categoryStore.deleteCategoryAndMoveNotes(category);
  } catch (error) {
    console.error('删除分类失败:', error);
    alert('删除分类失败，请重试');
  }
}

function showContextMenu(event, category) {
  event.preventDefault();
  contextMenu.value = {
    visible: true,
    categoryId: category.id,
    category: category,
    top: event.clientY,
    left: event.clientX,
  };
}

function hideContextMenu() {
  if (contextMenu.value.visible) {
    contextMenu.value.visible = false;
  }
}

function startRename(category) {
  editingCategoryId.value = category.id;
  newCategoryName.value = category.name;
}

async function finishRename(category) {
  if (editingCategoryId.value === null) return;
  if (newCategoryName.value && newCategoryName.value !== category.name) {
    await categoryStore.handleRenameCategory(category, newCategoryName.value);
  }
  editingCategoryId.value = null;
  newCategoryName.value = '';
}
</script>

<template>
  <div class="sidebar" :class="{ 'sidebar-collapsed': props.isSidebarCollapsed }">
    <div class="sidebar-header">
        <input
          type="text"
          class="search-input"
          placeholder="Search notes..."
          v-model="noteStore.searchQuery"
        />
        <div class="header-controls">
          <button class="action-btn toggle-btn" @click="emit('toggle-sidebar')" title="Toggle Sidebar">
            <span v-if="props.isSidebarCollapsed">▶</span>
            <span v-else>◀</span>
          </button>
          <div class="sidebar-actions">
            <button class="action-btn" @click="noteStore.handleAddNote" title="New Note">📄</button>
            <button class="action-btn" @click="categoryStore.handleAddCategory" title="New Category">📁</button>
            <button class="action-btn" @click="noteStore.forceRefreshNotes(); categoryStore.fetchCategories()" title="Refresh">🔄</button>
          </div>
        </div>
    </div>
    <div class="notes-list" ref="notesListRef">
      <!-- Search Results -->
      <div v-if="noteStore.searchQuery" class="search-results">
        <NoteItem
          v-for="noteTitle in noteStore.searchResults"
          :key="noteTitle.id"
          :note="noteTitle"
          :selected="noteTitle.id === noteStore.selectedNote?.id"
          @select="noteStore.handleSelectNote(noteTitle)"
        />
      </div>

      <!-- Categories and Notes (original view) -->
      <div v-else>
        <!-- Categories -->
        <div v-for="category in categoryStore.categories" :key="category.id" class="category-item">
            <div class="category-header" @click="toggleCategory(category.id)" @contextmenu.prevent="showContextMenu($event, category)">
              <span class="category-toggle">
                {{ expandedCategories.has(category.id) ? '▼' : '▶' }}
              </span>
              <input
                v-if="editingCategoryId === category.id"
                type="text"
                v-model="newCategoryName"
                class="rename-input"
                @blur="finishRename(category)"
                @keyup.enter="finishRename(category)"
                @click.stop
                v-focus
              />
              <span v-else class="category-name">{{ category.name }}</span>
              <span class="note-count">({{ category.note_count || 0 }})</span>
            </div>
            <!-- Drop zone for collapsed categories -->
            <draggable
              v-if="!expandedCategories.has(category.id)"
              :list="[]"
              item-key="id"
              group="notes"
              :data-category-id="category.id"
              @add="onNoteDrop"
              class="category-drop-zone"
            >
              <template #item="{element}">
                <!-- This won't render anything, just serves as drop zone -->
              </template>
            </draggable>
            <!-- Note titles in expanded categories -->
            <div v-if="expandedCategories.has(category.id)" class="notes-in-category">
              <draggable
                :list="noteStore.titlesByCategory[category.id] || []"
                item-key="id"
                group="notes"
                :data-category-id="category.id"
                @add="onNoteDrop"
                class="category-notes-list"
              >
                <template #item="{ element: noteTitle }">
                  <NoteItem
                    :note="noteTitle"
                    :selected="noteTitle.id === noteStore.selectedNote?.id"
                    @select="noteStore.handleSelectNote(noteTitle)"
                  />
                </template>
              </draggable>
            </div>
        </div>

        <!-- Uncategorized Notes -->
        <div class="uncategorized-section">
          <div class="uncategorized-header">
            <span class="uncategorized-label">未分类</span>
            <span class="note-count">({{ noteStore.uncategorizedNoteTitles.length }})</span>
          </div>
          <draggable
            :list="noteStore.uncategorizedNoteTitles"
            item-key="id"
            group="notes"
            data-category-id="null"
            @add="onNoteDrop"
            class="uncategorized-list"
          >
            <template #item="{ element: noteTitle }">
              <NoteItem
                :note="noteTitle"
                :selected="noteTitle.id === noteStore.selectedNote?.id"
                @select="noteStore.handleSelectNote(noteTitle)"
              />
            </template>
          </draggable>
        </div>
      </div>

      <div class="loading-indicator" v-if="noteStore.isLoading">
        <p>Loading...</p>
      </div>
    </div>

    <!-- Context Menu -->
    <div v-if="contextMenu.visible" class="category-menu" :style="{ top: contextMenu.top + 'px', left: contextMenu.left + 'px' }">
      <button @click="startRename(contextMenu.category)">Rename</button>
      <button @click="handleDeleteCategory(contextMenu.category)">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  min-width: 200px;
  max-width: 600px;
  background-color: #f8f9fa;
  color: #343a40;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  transition: min-width 0.3s ease;
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

.toggle-btn {
  font-size: 1em;
  padding: 0.3rem;
}

/* 移动端侧边栏样式 */
.sidebar-mobile {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width-mobile);
  height: 100vh;
  height: 100dvh;
  z-index: 999;
  transform: translateX(-100%);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  min-width: var(--sidebar-width-mobile);
  max-width: var(--sidebar-width-mobile);
}

.sidebar-mobile.sidebar-visible {
  transform: translateX(0);
}
.sidebar-header {
    padding: 12px 15px;
    border-bottom: 1px solid #dee2e6;
}
.header-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.search-input {
  width: 100%;
  padding: 8px 12px;
  background-color: #ffffff;
  border: 1px solid #ced4da;
  color: #495057;
  border-radius: 6px;
  box-sizing: border-box;
  margin-bottom: 10px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}
.sidebar-actions {
  display: flex;
  justify-content: space-around;
  flex-grow: 1;
  margin-left: 10px;
}
.action-btn {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 1.5em;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0.5rem;
  border-radius: 6px;
  min-width: var(--touch-target-size);
  min-height: var(--touch-target-size);
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn:hover {
  color: #343a40;
  background-color: #e9ecef;
}
.action-btn:active {
  transform: scale(0.95);
}
.notes-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px;
}
.category-item {
  margin-bottom: 2px;
}
.category-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
  position: relative;
  color: #495057;
  transition: background-color 0.2s;
}
/* .category-header:hover {
  background-color: #e9ecef;
} */
.category-toggle {
  margin-right: 8px;
  width: 1em;
  display: inline-block;
  font-size: 0.7em;
  color: #6c757d;
}
.category-name {
  flex-grow: 1;
}
.note-count {
  font-size: 0.8em;
  color: #adb5bd;
  margin-left: 8px;
  font-weight: 500;
}
.uncategorized-section {
  margin-top: 12px;
}
.uncategorized-header {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  font-weight: 600;
  color: #6c757d;
}
.uncategorized-label {
  flex-grow: 1;
}
.category-menu {
  position: fixed;
  background-color: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 5px 0;
  min-width: 120px;
}
.category-menu button {
  background: none;
  border: none;
  color: #343a40;
  padding: 8px 15px;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
}
.category-menu button:hover {
  background-color: #f1f3f5;
} 
.rename-input {
  flex-grow: 1;
  background-color: #fff;
  border: 1px solid #80bdff;
  color: #495057;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 1em;
  font-weight: 600;
}
.category-drop-zone {
  min-height: 10px;
  border-radius: 6px;
  transition: background-color 0.2s;
  margin: 2px 0;
}
.category-drop-zone:hover {
  background-color: rgba(0, 123, 255, 0.05);
}
.category-notes-list {
  padding-left: 1em;
  min-height: 10px;
}
.notes-in-category .note-item {
  padding-left: 1em;
}












.loading-indicator {
  padding: 1em;
  text-align: center;
  color: #6c757d;
}

/* 移动端适配 */
@media (max-width: var(--mobile-breakpoint)) {
  .sidebar-header {
    padding: var(--spacing-lg) var(--spacing-xl);
  }
  
  .search-input {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 16px; /* 防止iOS缩放 */
    margin-bottom: var(--spacing-md);
  }
  
  .sidebar-actions {
    gap: var(--spacing-sm);
  }
  
  .action-btn {
    font-size: 1.3em;
    padding: var(--spacing-md);
  }
  
  .notes-list {
    padding: var(--spacing-md);
  }
  
  .category-header {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1.05rem;
  }
  
  .category-toggle {
    margin-right: var(--spacing-md);
    font-size: 0.8em;
  }
  
  /* NoteItem组件样式已移至单独的NoteItem.vue文件 */
  
  .category-menu {
    padding: var(--spacing-sm) 0;
    min-width: 120px;
  }
  
  .category-menu button {
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: 1rem;
  }
  
  .menu-btn {
    font-size: 1.4em;
    padding: var(--spacing-sm);
    display: inline-block; /* 移动端始终显示菜单按钮 */
  }
  
  .uncategorized-header {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1.05rem;
  }
  
  .note-count {
    font-size: 0.9em;
  }
}

/* 平板端适配 */
@media (min-width: 769px) and (max-width: var(--tablet-breakpoint)) {
  .sidebar-header {
    padding: var(--spacing-md) var(--spacing-lg);
  }
  
  .search-input {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 15px;
  }
  
  /* NoteItem组件样式已移至单独的NoteItem.vue文件 */
  
  .category-header {
    padding: var(--spacing-sm) var(--spacing-md);
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .action-btn:hover {
    background-color: initial;
  }
  
  
  .category-header:hover {
    background-color: initial;
  }
  
  .delete-note-btn:hover {
    color: #dc3545;
  }
  
  /* 触摸设备上始终显示交互元素 */
  .delete-note-btn {
    display: flex !important;
    opacity: 0.6;
  }
  
  .menu-btn {
    display: inline-block !important;
    opacity: 0.8;
  }
}
</style>
