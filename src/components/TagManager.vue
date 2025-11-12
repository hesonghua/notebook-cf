<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useTagStore } from '../stores/tagStore.js';
import { useNoteStore } from '../stores/noteStore.js';

const props = defineProps({
  noteId: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['close']);

const tagStore = useTagStore();
const noteStore = useNoteStore();
const emitter = inject('emitter');

const newTagName = ref('');
const newTagColor = ref('#5e81ac');
const showAddForm = ref(false);
const isAdding = ref(false);

const noteTags = computed(() => {
  return tagStore.getTagsByNoteId(props.noteId);
});

const availableTags = computed(() => {
  const noteTagIds = noteTags.value.map(tag => tag.id);
  return tagStore.tags.filter(tag => !noteTagIds.includes(tag.id));
});

async function addTag() {
  if (!newTagName.value.trim() || isAdding.value) return;
  
  isAdding.value = true;
  try {
    const newTag = await tagStore.handleAddTag({
      name: newTagName.value.trim(),
      color: newTagColor.value
    });
    
    await tagStore.addTagToNote(props.noteId, newTag.id);
    
    // 重置表单
    newTagName.value = '';
    newTagColor.value = '#5e81ac';
    showAddForm.value = false;
  } catch (error) {
    console.error('添加标签失败:', error);
    alert('添加标签失败: ' + error.message);
  } finally {
    isAdding.value = false;
  }
}

async function addExistingTag(tagId) {
  try {
    await tagStore.addTagToNote(props.noteId, tagId);
  } catch (error) {
    console.error('添加标签到笔记失败:', error);
    alert('添加标签失败: ' + error.message);
  }
}

async function removeTag(tagId) {
  try {
    await tagStore.removeTagFromNote(props.noteId, tagId);
  } catch (error) {
    console.error('移除标签失败:', error);
    alert('移除标签失败: ' + error.message);
  }
}

function close() {
  emit('close');
}

onMounted(() => {
  // 加载笔记的标签
  tagStore.fetchNoteTags(props.noteId);
});
</script>

<template>
  <div class="tag-manager">
    <div class="tag-manager-header">
      <h3>管理标签</h3>
      <button class="close-btn" @click="close">×</button>
    </div>
    
    <div class="tag-manager-content">
      <!-- 当前标签 -->
      <div class="current-tags">
        <h4>当前标签</h4>
        <div v-if="noteTags.length === 0" class="no-tags">
          暂无标签
        </div>
        <div v-else class="tag-list">
          <span 
            v-for="tag in noteTags" 
            :key="tag.id"
            class="tag-item"
            :style="{ backgroundColor: tag.color }"
          >
            {{ tag.name }}
            <button class="remove-tag" @click="removeTag(tag.id)">×</button>
          </span>
        </div>
      </div>
      
      <!-- 添加新标签 -->
      <div class="add-tag-section">
        <h4>添加标签</h4>
        
        <!-- 现有标签 -->
        <div v-if="availableTags.length > 0" class="available-tags">
          <div class="tag-list">
            <span 
              v-for="tag in availableTags" 
              :key="tag.id"
              class="tag-item available"
              :style="{ backgroundColor: tag.color }"
              @click="addExistingTag(tag.id)"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>
        
        <!-- 新建标签表单 -->
        <div class="new-tag-form">
          <button 
            v-if="!showAddForm" 
            class="add-new-tag-btn"
            @click="showAddForm = true"
          >
            + 新建标签
          </button>
          
          <div v-else class="tag-form">
            <input 
              v-model="newTagName"
              placeholder="标签名称"
              class="tag-name-input"
              @keyup.enter="addTag"
            />
            <input 
              v-model="newTagColor"
              type="color"
              class="tag-color-input"
            />
            <button 
              @click="addTag"
              :disabled="!newTagName.trim() || isAdding"
              class="save-tag-btn"
            >
              {{ isAdding ? '添加中...' : '添加' }}
            </button>
            <button 
              @click="showAddForm = false"
              class="cancel-tag-btn"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-manager {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--nord6);
  border: 1px solid var(--nord4);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 1.5rem;
}

.tag-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--nord4);
}

.tag-manager-header h3 {
  margin: 0;
  color: var(--nord1);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--nord3);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: var(--nord4);
  color: var(--nord1);
}

.tag-manager-content h4 {
  margin: 0 0 0.75rem 0;
  color: var(--nord2);
  font-size: 0.9rem;
}

.no-tags {
  color: var(--nord3);
  font-style: italic;
  padding: 1rem;
  text-align: center;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 16px;
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  gap: 0.25rem;
  transition: all 0.2s ease;
}

.tag-item.available {
  cursor: pointer;
}

.tag-item.available:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.remove-tag:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.add-new-tag-btn {
  background: none;
  border: 1px dashed var(--nord4);
  color: var(--nord9);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  margin-bottom: 1rem;
}

.add-new-tag-btn:hover {
  border-color: var(--nord9);
  background-color: rgba(129, 161, 193, 0.1);
}

.tag-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.tag-name-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--nord4);
  border-radius: 6px;
  background-color: var(--nord6);
  color: var(--nord1);
  min-width: 150px;
}

.tag-color-input {
  width: 40px;
  height: 36px;
  border: 1px solid var(--nord4);
  border-radius: 6px;
  cursor: pointer;
}

.save-tag-btn, .cancel-tag-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-tag-btn {
  background-color: var(--nord10);
  color: var(--nord6);
  border: 1px solid var(--nord10);
}

.save-tag-btn:hover:not(:disabled) {
  background-color: var(--nord9);
}

.save-tag-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-tag-btn {
  background-color: transparent;
  color: var(--nord3);
  border: 1px solid var(--nord4);
}

.cancel-tag-btn:hover {
  background-color: var(--nord4);
  color: var(--nord1);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .tag-manager {
    width: 95%;
    padding: 1rem;
  }
  
  .tag-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .tag-name-input {
    min-width: auto;
  }
}
</style>