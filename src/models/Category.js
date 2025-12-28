import { updateCategory, deleteCategory } from '../utils/api.js';

export class Category {
  constructor({ id, name, note_count, parent_id, children = [] }) {
    this.id = id;
    this.name = name;
    this.note_count = note_count;
    this.parent_id = parent_id;
    // 递归处理子分类，确保它们也是 Category 对象
    this.children = children.map(child => new Category(child));
  }

  async rename(newName) {
    if (!newName || newName.trim() === '' || newName === this.name) {
      return this;
    }
    try {
      const updatedCategory = await updateCategory({
        id: this.id,
        name: newName.trim(),
        parent_id: this.parent_id
      });
      this.name = updatedCategory.name;
      return this;
    } catch (error) {
      console.error(`Failed to rename category ${this.id}:`, error);
      throw error;
    }
  }

  async moveTo(newParentId) {
    try {
      const updatedCategory = await updateCategory({
        id: this.id,
        name: this.name,
        parent_id: newParentId
      });
      this.parent_id = updatedCategory.parent_id;
      return this;
    } catch (error) {
      console.error(`Failed to move category ${this.id}:`, error);
      throw error;
    }
  }

  async deleteAndMoveNotes() {
    try {
      await deleteCategory(this.id);
    } catch (error) {
      console.error(`Failed to delete category ${this.id}:`, error);
      throw error;
    }
  }

  // 添加子分类
  addChild(category) {
    this.children.push(category);
    category.parent_id = this.id;
  }

  // 移除子分类
  removeChild(categoryId) {
    this.children = this.children.filter(child => child.id !== categoryId);
  }

  // 获取所有子孙分类（递归）
  getAllDescendants() {
    let descendants = [...this.children];
    this.children.forEach(child => {
      descendants = descendants.concat(child.getAllDescendants());
    });
    return descendants;
  }
}
