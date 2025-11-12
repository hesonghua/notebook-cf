import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getTags, addTag, updateTag, deleteTag, addNoteTag, removeNoteTag, getNoteTags } from '../utils/api.js';
import { Tag } from '../models/Tag.js';

export const useTagStore = defineStore('tags', () => {
  // --- State ---
  const tags = ref([]);
  const isLoading = ref(false);
  const noteTags = ref({}); // 按笔记ID存储标签

  // --- Getters ---
  const tagOptions = computed(() => {
    return tags.value.map(tag => ({
      value: tag.id,
      label: tag.name,
      color: tag.color
    }));
  });

  const getTagsByNoteId = computed(() => {
    return (noteId) => noteTags.value[noteId] || [];
  });

  // --- Actions ---
  async function fetchTags() {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      const data = await getTags();
      tags.value = data.tags.map(tag => new Tag(tag));
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchNoteTags(noteId) {
    try {
      const data = await getNoteTags(noteId);
      noteTags.value[noteId] = data.tags;
    } catch (error) {
      console.error('Failed to fetch note tags:', error);
    }
  }

  async function handleAddTag(tagData) {
    try {
      const newTagData = await addTag(tagData);
      const newTag = new Tag(newTagData);
      tags.value.unshift(newTag);
      return newTag;
    } catch (error) {
      console.error('Failed to add tag:', error);
      throw error;
    }
  }

  async function handleUpdateTag(tag) {
    try {
      await updateTag(tag);
      const index = tags.value.findIndex(t => t.id === tag.id);
      if (index !== -1) {
        tags.value[index] = new Tag(tag);
      }
    } catch (error) {
      console.error('Failed to update tag:', error);
      throw error;
    }
  }

  async function handleDeleteTag(tagId) {
    try {
      await deleteTag(tagId);
      tags.value = tags.value.filter(t => t.id !== tagId);
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw error;
    }
  }

  async function addTagToNote(noteId, tagId) {
    try {
      await addNoteTag(noteId, tagId);
      if (!noteTags.value[noteId]) {
        noteTags.value[noteId] = [];
      }
      const tag = tags.value.find(t => t.id === tagId);
      if (tag && !noteTags.value[noteId].find(t => t.id === tagId)) {
        noteTags.value[noteId].push(tag);
      }
    } catch (error) {
      console.error('Failed to add tag to note:', error);
      throw error;
    }
  }

  async function removeTagFromNote(noteId, tagId) {
    try {
      await removeNoteTag(noteId, tagId);
      if (noteTags.value[noteId]) {
        noteTags.value[noteId] = noteTags.value[noteId].filter(t => t.id !== tagId);
      }
    } catch (error) {
      console.error('Failed to remove tag from note:', error);
      throw error;
    }
  }

  function clearNoteTags(noteId) {
    delete noteTags.value[noteId];
  }

  return {
    tags,
    isLoading,
    noteTags,
    tagOptions,
    getTagsByNoteId,
    fetchTags,
    fetchNoteTags,
    handleAddTag,
    handleUpdateTag,
    handleDeleteTag,
    addTagToNote,
    removeTagFromNote,
    clearNoteTags,
  };
});