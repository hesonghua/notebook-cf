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

  async function handleAddCategory(parentId = null) {
    const name = prompt('Enter category name:');
    if (!name || name.trim() === '') return;
    try {
      const newCategoryData = await addCategory({ name: name.trim(), parent_id: parentId });
      const newCategory = new Category(newCategoryData);
      
      if (parentId) {
        // 查找父分类并添加子分类
        const parent = findCategoryById(categories.value, parentId);
        if (parent) {
          parent.addChild(newCategory);
        }
      } else {
        categories.value.push(newCategory);
      }
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  }

  // 递归查找分类
  function findCategoryById(categoriesList, id) {
    for (const category of categoriesList) {
      if (category.id === id) return category;
      if (category.children && category.children.length > 0) {
        const found = findCategoryById(category.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // 查找父分类
  function findParentCategory(categoriesList, childId) {
    for (const category of categoriesList) {
      if (category.children) {
        if (category.children.some(child => child.id === childId)) {
          return category;
        }
        const found = findParentCategory(category.children, childId);
        if (found) return found;
      }
    }
    return null;
  }

  // 递归删除分类
  function removeCategoryFromTree(categoriesList, id) {
    for (let i = 0; i < categoriesList.length; i++) {
      if (categoriesList[i].id === id) {
        categoriesList.splice(i, 1);
        return true;
      }
      if (categoriesList[i].children && categoriesList[i].children.length > 0) {
        if (removeCategoryFromTree(categoriesList[i].children, id)) {
          return true;
        }
      }
    }
    return false;
  }

  async function deleteCategoryAndMoveNotes(category) {
    const removed = removeCategoryFromTree(categories.value, category.id);
    if (removed) {
      await category.deleteAndMoveNotes();
      const noteStore = useNoteStore();
      await noteStore.forceRefreshNotes();
    }
  }

  async function handleRenameCategory(category, newName) {
    await category.rename(newName);
  }

  async function moveCategory(sourceId, targetId) {
    const sourceCategory = findCategoryById(categories.value, sourceId);
    if (!sourceCategory) return;

    // 检查是否移动到自己或自己的子分类中
    if (sourceId === targetId) return;
    const descendants = sourceCategory.getAllDescendants();
    if (descendants.some(d => d.id === targetId)) {
      console.warn("Cannot move category into its own descendant");
      return;
    }

    await sourceCategory.moveTo(targetId);

    // 更新本地树结构
    // 1. 从旧父节点移除
    const oldParent = findParentCategory(categories.value, sourceId);
    if (oldParent) {
      oldParent.removeChild(sourceId);
    } else {
      // 曾是顶层分类
      const index = categories.value.findIndex(c => c.id === sourceId);
      if (index !== -1) categories.value.splice(index, 1);
    }

    // 2. 添加到新父节点
    if (targetId) {
      const newParent = findCategoryById(categories.value, targetId);
      if (newParent) {
        newParent.addChild(sourceCategory);
      }
    } else {
      // 移动到顶层
      sourceCategory.parent_id = 0;
      categories.value.push(sourceCategory);
    }
  }

  return {
    categories,
    isLoading,
    fetchCategories,
    handleAddCategory,
    handleRenameCategory,
    deleteCategoryAndMoveNotes,
    findCategoryById,
    moveCategory,
  };
});
