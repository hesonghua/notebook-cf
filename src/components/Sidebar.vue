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

onMounted(() => {
  document.addEventListener('click', hideContextMenu);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', hideContextMenu);
});

async function handleDeleteCategory(category) {
  const confirmed = confirm(`确定要删除分类 "${category.name}" 吗？该分类下的所有日记将被移动到未分类。`);
  hideContextMenu();
  if (confirmed) {
    try {
      await categoryStore.deleteCategoryAndMoveNotes(category);
    } catch (error) {
      console.error('删除分类失败:', error);
      alert('删除分类失败，请重试');
    }
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
        <!-- Categories -->
        <div v-for="category in categoryStore.categories" :key="category.id" class="category-item">
            <div class="category-header" @click="toggleCategory(category.id)" @contextmenu.prevent="showContextMenu($event, category)">
              <span class="category-toggle" :class="{ 'is-expanded': expandedCategories.has(category.id) }">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
    <div v-if="contextMenu.visible" class="category-menu" :style="{ top: contextMenu.top + 'px', left: contextMenu.left + 'px' }" @click.stop>
      <button @click="startRename(contextMenu.category)">重命名</button>
      <button @click="handleDeleteCategory(contextMenu.category)">删除</button>
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

.category-item {
  margin-bottom: 0.125rem;
}

.category-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-weight: 500;
  color: var(--nord2);
  transition: background-color 0.2s ease;
}
.category-header:hover {
  background-color: var(--nord5);
}

.category-toggle {
  margin-right: 0.5rem;
  color: var(--nord9);
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
}
.category-toggle.is-expanded {
  transform: rotate(90deg);
}

.category-name {
  flex-grow: 1;
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

.uncategorized-section {
  margin-top: 0.75rem;
}
.uncategorized-header {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  color: var(--nord3);
}
.uncategorized-label {
  flex-grow: 1;
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

.rename-input {
  flex-grow: 1;
  background-color: var(--nord6);
  border: 1px solid var(--nord9);
  color: var(--nord1);
  border-radius: 5px;
  padding: 0.125rem 0.375rem;
  font-size: 1em;
  font-weight: 500;
  outline: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.category-drop-zone {
  min-height: 1px;
  border-radius: 6px;
  transition: background-color 0.2s;
  margin: 2px 0;
}
.category-drop-zone:hover {
  background-color: rgba(129, 161, 193, 0.1);
}

.category-notes-list {
  padding-left: 1.5rem;
  min-height: 10px;
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
