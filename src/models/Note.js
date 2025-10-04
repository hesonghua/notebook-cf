import { getNote, addNote, updateNote, deleteNote } from '../utils/api.js';

function getTitleFromContent(content) {
  if (!content) return 'Untitled';
  const firstLine = content.split('\n')[0];
  return firstLine.replace(/^#+\s*/, '') || 'Untitled';
}

export class Note {
  constructor({ id, title, content, category_id, favorite, created_at, dirty = false }) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.category_id = category_id;
    this.favorite = favorite;
    this.created_at = created_at;
    this.dirty = dirty;

    // 临时ID，用于新笔记
    this.isNew = id < 0;
  }

  async fetchContent() {
    if (this.content !== null) {
      return this;
    }
    try {
      const fullNote = await getNote(this.id);
      if (fullNote) {
        this.content = fullNote.content;
        this.dirty = false;
      }
      return this;
    } catch (error) {
      console.error(`Failed to fetch content for note ${this.id}:`, error);
      throw error;
    }
  }

  updateContent(newContent) {
    if (this.content !== newContent) {
      this.content = newContent;
      this.dirty = true;
    }
  }

  async save() {
    if (!this.dirty) return this;

    const noteData = {
      id: this.id,
      content: this.content,
      category_id: this.category_id,
      favorite: this.favorite,
      title: getTitleFromContent(this.content),
    };

    try {
      if (this.isNew) {
        // 创建新笔记
        const { id: tempId, ...dataToSave } = noteData;
        const newNoteData = await addNote(dataToSave);
        // 用服务器返回的真实数据更新实例
        Object.assign(this, newNoteData, { dirty: false, isNew: false });
      } else {
        // 更新现有笔记
        await updateNote(noteData);
        this.title = noteData.title;
        this.dirty = false;
      }
      return this;
    } catch (error) {
      console.error(`Failed to save note ${this.id}:`, error);
      throw error;
    }
  }

  async delete() {
    try {
      if (!this.isNew) {
        await deleteNote(this.id);
      }
    } catch (error) {
      console.error(`Failed to delete note ${this.id}:`, error);
      throw error;
    }
  }

  async updateCategory(newCategoryId) {
    if (this.category_id === newCategoryId) return;
    
    this.category_id = newCategoryId;
    this.dirty = true;

    // 如果笔记内容已加载或是新笔记，通过save方法保存
    if (this.content !== null || this.isNew) {
      await this.save();
    } else {
      // 如果内容未加载，直接调用API更新，避免不必要的内容加载
      try {
        await updateNote({ id: this.id, category_id: newCategoryId });
        this.dirty = false;
      } catch (error) {
        console.error(`Failed to update category for note ${this.id}:`, error);
        this.dirty = true; // 如果失败，保持dirty状态
        throw error;
      }
    }
  }
}
