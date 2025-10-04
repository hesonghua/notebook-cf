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
    <span class="note-title">{{ note.title }}</span>
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
.note-item {
  padding: 3px 5px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 6px;
  font-size: 0.95em;
  margin-bottom: 2px;
  transition: background-color 0.2s, color 0.2s;
  min-height: var(--touch-target-size);
  box-sizing: border-box;
}

.note-item:hover {
  background-color: #e9ecef;
}

.note-item.selected {
  background-color: #007bff;
  color: white;
}

.note-item.selected:hover {
  background-color: #0069d9;
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
  color: #ffc107;
}

.context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 1000;
  border-radius: 8px;
  padding: 6px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  min-width: 160px;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 9px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #333;
}

.context-menu li:hover {
  background-color: #f5f5f5;
}

.context-menu .separator {
  height: 1px;
  background-color: #f0f0f0;
  margin: 4px 0;
  padding: 0;
}

.context-menu .has-submenu {
  position: relative;
}

.context-menu .has-submenu::after {
  content: '▶';
  font-size: 10px;
  color: #999;
}

.context-menu .submenu {
  position: absolute;
  top: -7px;
  left: 100%;
  background: #fff;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-radius: 8px;
  padding: 6px;
  display: none;
  min-width: 150px;
}

.context-menu .has-submenu:hover .submenu {
  display: block;
}


/* 移动端适配 */
@media (max-width: var(--mobile-breakpoint)) {
  .note-item {
    padding: 12px 16px;
    font-size: 1rem;
    margin-bottom: 4px;
  }
  
  .note-title {
    font-size: 1rem;
    line-height: 1.4;
  }
}

/* 平板端适配 */
@media (min-width: 769px) and (max-width: var(--tablet-breakpoint)) {
  .note-item {
    padding: 10px 14px;
    font-size: 0.98rem;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  .note-item:hover {
    background-color: initial;
  }
}
</style>