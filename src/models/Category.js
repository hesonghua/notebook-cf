import { updateCategory, deleteCategory } from '../utils/api.js';

export class Category {
  constructor({ id, name, note_count }) {
    this.id = id;
    this.name = name;
    this.note_count = note_count;
  }

  async rename(newName) {
    if (!newName || newName.trim() === '' || newName === this.name) {
      return this;
    }
    try {
      const updatedCategory = await updateCategory({ id: this.id, name: newName.trim() });
      this.name = updatedCategory.name;
      return this;
    } catch (error) {
      console.error(`Failed to rename category ${this.id}:`, error);
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
}
