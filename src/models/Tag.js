import { getTags, addTag, updateTag, deleteTag } from '../utils/api.js';

export class Tag {
  constructor({ id, name, color, user_id, created_at }) {
    this.id = id;
    this.name = name;
    this.color = color || '#5e81ac';
    this.user_id = user_id;
    this.created_at = created_at;
  }

  static async fetchAll() {
    try {
      const data = await getTags();
      return data.tags.map(tag => new Tag(tag));
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      return [];
    }
  }

  async save() {
    try {
      if (this.id) {
        await updateTag(this);
      } else {
        const newTagData = await addTag({
          name: this.name,
          color: this.color
        });
        Object.assign(this, newTagData);
      }
      return this;
    } catch (error) {
      console.error('Failed to save tag:', error);
      throw error;
    }
  }

  async delete() {
    try {
      await deleteTag(this.id);
    } catch (error) {
      console.error('Failed to delete tag:', error);
      throw error;
    }
  }
}