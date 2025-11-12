<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject } from 'vue';
import { useNoteStore } from '../stores/noteStore.js';
import { useCategoryStore } from '../stores/categoryStore.js';

const props = defineProps({
  note: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['select']);

const noteStore = useNoteStore();
const categoryStore = useCategoryStore();
const emitter = inject('emitter');

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0
});

const otherCategories = computed(() => {
  const categories = categoryStore.categories.filter(c => c.id !== props.note.category_id);
  if (props.note.category_id !== null) {
    categories.unshift({ id: null, name: '未分类' });
  }
  return categories;
});

// 计算高亮标题
const highlightedTitle = computed(() => {
  if (!props.searchQuery || !props.note.title) {
    return props.note.title;
  }
  
  const regex = new RegExp(`(${props.searchQuery})`, 'gi');
  return props.note.title.replace(regex, '<mark>$1</mark>');
});

function showContextMenu(event) {
  emitter.emit('close-context-menus'); // Close other menus first
  contextMenu.value.show = true;
  contextMenu.value.x = event.clientX;
  contextMenu.value.y = event.clientY;
  // Use a timeout to prevent the same click from closing the menu immediately
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu);
  }, 0);
}

function closeContextMenu() {
  contextMenu.value.show = false;
  document.removeEventListener('click', closeContextMenu);
}

function deleteNote() {
  noteStore.handleDeleteNote(props.note);
}

function moveNote(categoryId) {
  noteStore.updateNoteCategory({ noteId: props.note.id, newCategoryId: categoryId });
}

onMounted(() => {
  emitter.on('close-context-menus', closeContextMenu);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu);
  emitter.off('close-context-menus', closeContextMenu);
});
</script>

<template>
  <div
    class="note-item"
    :class="{ selected }"
    @click="$emit('select')"
    @contextmenu.prevent="showContextMenu"
    :data-note-id="note.id"
  >
    <span class="note-title" v-html="highlightedTitle"></span>
    <div class="note-actions">
      <span v-if="note.favorite" class="favorite-star">★</span>
    </div>

    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <ul>
        <li @click.stop="deleteNote">删除</li>
        <li v-if="note.id > 0 && otherCategories.length > 0" class="separator"></li>
        <li v-if="note.id > 0 && otherCategories.length > 0" class="has-submenu">
          移动
          <ul class="submenu">
            <li
              v-for="category in otherCategories"
              :key="category.id"
              @click.stop="moveNote(category.id)"
            >
              {{ category.name }}
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Nord Theme Colors */
:root {
  --nord0: #2e3440; --nord1: #3b4252; --nord2: #434c5e; --nord3: #4c566a;
  --nord4: #d8dee9; --nord5: #e5e9f0; --nord6: #eceff4;
  --nord7: #8fbcbb; --nord8: #88c0d0; --nord9: #81a1c1; --nord10: #5e81ac;
  --nord11: #bf616a; --nord12: #d08770; --nord13: #ebcb8b; --nord14: #a3be8c;
  --nord15: #b48ead;
}

.note-item {
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 6px;
  font-size: 0.9rem;
  margin-bottom: 2px;
  transition: background-color 0.2s, color 0.2s;
  color: var(--nord2);
  font-weight: 500;
}

.note-item:hover {
  background-color: var(--nord5);
}

.note-item.selected {
  background-color: var(--nord10);
  color: var(--nord6);
}

.note-item.selected:hover {
  background-color: var(--nord9);
}

.note-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-actions {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.favorite-star {
  color: var(--nord13);
}

.context-menu {
  position: fixed;
  background: var(--nord6);
  border: 1px solid var(--nord4);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 1000;
  border-radius: 8px;
  padding: 0.5rem;
  font-size: 0.9rem;
  min-width: 160px;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 0.6rem 0.8rem;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--nord1);
  padding-right: 1.0rem;
}

.context-menu li:hover {
  background-color: var(--nord5);
}

.context-menu .separator {
  height: 1px;
  background-color: var(--nord5);
  margin: 0.25rem 0;
  padding: 0;
}

.context-menu .has-submenu {
  position: relative;
}

.context-menu .has-submenu::after {
  content: '›';
  font-size: 1.2em;
  color: var(--nord3);
}

.context-menu .submenu {
  position: absolute;
  top: -0.5rem;
  left: 99%;
  background: var(--nord6);
  border: 1px solid var(--nord4);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 0.5rem;
  display: none;
  min-width: 150px;
}

.context-menu .has-submenu:hover .submenu {
  display: block;
}

/* 搜索高亮样式 */
.note-title :deep(mark) {
  background-color: var(--nord13);
  color: var(--nord0);
  padding: 0.1em 0.2em;
  border-radius: 2px;
  font-weight: 600;
}

.dark-mode .note-title :deep(mark) {
  background-color: var(--nord13);
  color: var(--nord6);
}
</style>
