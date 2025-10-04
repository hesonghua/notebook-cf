import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCategories, addCategory } from '../utils/api.js';
import { Category } from '../models/Category.js';
import { useNoteStore } from './noteStore.js';

export const useCategoryStore = defineStore('categories', () => {
  // --- State ---
  const categories = ref([]);
  const isLoading = ref(false);

  // --- Actions ---
  async function fetchCategories() {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      const data = await getCategories();
      categories.value = data.map(c => new Category(c));
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function handleAddCategory() {
    const name = prompt('Enter category name:');
    if (!name || name.trim() === '') return;
    try {
      const newCategoryData = await addCategory({ name: name.trim() });
      categories.value.push(new Category(newCategoryData));
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  }

  async function deleteCategoryAndMoveNotes(category) {
    const index = categories.value.findIndex(c => c.id === category.id);
    if (index !== -1) {
      await category.deleteAndMoveNotes();
      categories.value.splice(index, 1);
  
      const noteStore = useNoteStore();
      await noteStore.forceRefreshNotes();
    }
  }

  async function handleRenameCategory(category, newName) {
    await category.rename(newName);
  }

  return {
    categories,
    isLoading,
    fetchCategories,
    handleAddCategory,
    handleRenameCategory,
    deleteCategoryAndMoveNotes,
  };
});
